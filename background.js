/**
 * background.js — Service Worker (CoStar → Survey Pusher)
 *
 * Handles:
 *  1. Supabase email-OTP auth (see supabase.js) — session in chrome.storage.local,
 *     refreshed lazily so MV3 worker suspension is harmless.
 *  2. Supabase PostgREST: surveys + survey_properties (same tables the master-app
 *     web UI writes to — zero server-side changes needed).
 *  3. CoStar read: ONE on-demand DOM read of the active CoStar tab, only when the
 *     user clicks / navigates. No automated navigation, no CoStar APIs, no crawling.
 */

importScripts("config.js", "supabase.js", "survey-fields.js", "survey-rent.js", "survey-spaces.js");

// ─── CoStar read (on-demand, single DOM read of the active CoStar tab) ───────────

async function readCoStar() {
  // Prefer the tab the user is actually looking at; fall back to the most-recent
  // CoStar tab only if the active tab isn't CoStar.
  const isCostar = (t) => t && /^https:\/\/[^/]*costar\.com\//.test(t.url || "");
  let tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!isCostar(tab)) {
    const costarTabs = await chrome.tabs.query({ url: "https://*.costar.com/*" });
    if (!costarTabs || costarTabs.length === 0) {
      throw new Error("No CoStar tab found. Open the CoStar property's Summary page first.");
    }
    tab = costarTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  }

  // CoStar property ID comes straight from the URL — no scraping needed.
  const idMatch = (tab.url || "").match(/\/detail\/[^/]+\/(\d+)/);
  const costarId = idMatch ? idMatch[1] : "";

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    // This function runs IN the CoStar tab. It reads ONLY the already-rendered
    // text the user is looking at — no network calls, no navigation.
    func: () => {
      const txt = document.body.innerText || "";
      const lines = txt.split(/\n/).map((s) => s.trim()).filter(Boolean);

      // ---- city / state / zip : "Phoenix, AZ 85040" (prefer a clean standalone line) ----
      let city = "", state = "", zip = "", cszIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
        if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; cszIdx = i; break; }
      }
      if (cszIdx === -1) {
        const m = txt.match(/([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/);
        if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; }
      }

      // ---- street: a line like "4821 S 33rd St" — prefer the one just above the city line ----
      let street = "";
      // CoStar headers can tack a name / note onto the address, e.g.
      // "4625 E Cotton Center Blvd - Cotton Flex Center (Multi-Property Sale)".
      // Strip the " - <name>" and " (<note>)" suffix so we keep just the street.
      // (Only splits on " - " with surrounding spaces, so ranges like "901-909 S X" survive.)
      const cleanStreet = (s) =>
        s.replace(/\s+[-–]\s+.*$/, "").replace(/\s*\(.*$/, "").trim();
      const looksStreet = (s) =>
        // allow ranges like "901-909 S Hohokam Dr" and 5-digit street numbers like "23320 N 18th Dr"
        /^\d{1,6}(?:-\d{1,5})?\s+[A-Za-z]/.test(s) && s.length < 60 &&
        !/\bof\s+\d/i.test(s) &&          // reject "23 of 36 Records" pagination
        // reject stat lines like "966 days", "2014 Built", "11,533 SF", "0.7 AC"
        !/^\d[\d,.]*\s+(?:days?|months?|years?|built|sf|ac|acres?|stories|story|spaces?|psf)\b/i.test(s) &&
        !/submarket|record|\bSF\b|\bRBA\b/i.test(s);
      if (cszIdx > 0) {
        for (let j = cszIdx - 1; j >= 0 && j >= cszIdx - 6; j--) {
          const cand = cleanStreet(lines[j]);
          if (looksStreet(cand)) { street = cand; break; }
        }
      }
      if (!street) {
        for (const l of lines) { const c = cleanStreet(l); if (looksStreet(c)) { street = c; break; } }
      }

      // ---- submarket : "... - S Airport N of Roeser Submarket" ----
      let submarket = "";
      const sm = txt.match(/[-–]\s*([A-Za-z0-9/&'’ .]+?)\s+Submarket/);
      if (sm) submarket = sm[1].trim();

      // ---- numeric stats : value appears just before its label ----
      // value BEFORE the label — property pages: "18,885\nSF RBA", "0.7\nAC Lot"
      const grab = (label) => {
        const m = txt.match(new RegExp("([\\d,.]+)\\s*\\n?\\s*" + label, "i"));
        return m ? m[1].replace(/,/g, "") : "";
      };
      // value AFTER the label — sale-comp pages: "Land Acres   1.40 AC", "RBA  21,000"
      const grabAfter = (label) => {
        const m = txt.match(new RegExp(label + "\\s*\\n?\\s*([\\d,.]+)", "i"));
        return m ? m[1].replace(/,/g, "") : "";
      };
      const rba = grab("SF RBA") || grab("RBA") || grabAfter("RBA");
      const acLot = grab("AC Lot") || grabAfter("Land Acres") || grabAfter("AC Lot");

      // ---- sale price : "For Sale  $5,400,000" (Sale section) or header "$5.4M Sale Price" ----
      let salePrice = "";
      const spSection = txt.match(/For Sale\s*\n?\s*\$([\d,]+)/i);
      if (spSection) salePrice = spSection[1].replace(/,/g, "");
      if (!salePrice) {
        const spHeader = txt.match(/\$\s*([\d.]+)\s*([MK]?)\s*\n?\s*Sale Price/i);
        if (spHeader) {
          let n = parseFloat(spHeader[1]);
          if (/M/i.test(spHeader[2])) n *= 1e6; else if (/K/i.test(spHeader[2])) n *= 1e3;
          if (!isNaN(n)) salePrice = String(Math.round(n));
        }
      }

      // ---- lease rate $/SF ----
      // Order matters: the header prints "Asking Industrial Rent" too, so match the
      // header's value-before-label form and the section's line-start "Rent" — never a
      // bare "Rent" (which also hits "Industrial Rent" and grabs the sale price beside it).
      let leaseRate = "";
      const lr = txt.match(/\$([\d.]+)\s*\n?\s*\/\s*\w+\s*\n?\s*Asking[\w ]*Rent/i) ||  // "$0.80 /NNN Asking … Rent"
                 txt.match(/(?:^|\n)Rent\s*\n?\s*\$([\d.]+)/i) ||                       // "Rent\n$0.80"
                 txt.match(/\$([\d.]+)\s*\n?\s*\/\s*(?:NNN|Gross|FSG|MG|IG)\b/i);        // "$0.80/NNN"
      if (lr) leaseRate = lr[1];

      // Additive Survey review evidence. Keep leaseRate unchanged for the separate
      // Comp intake. A detected amount is a suggestion, never an adopted quote.
      const quoteLineIndex = lines.findIndex((line) => /(?:asking.*rent|^rent\b)/i.test(line));
      const quoteWindow = quoteLineIndex >= 0 ? lines.slice(Math.max(0, quoteLineIndex - 2), quoteLineIndex + 4).join("\n") : "";
      const explicitQuote = (quoteWindow || txt).match(/\$\s*[\d,.]+(?:\s*[-–]\s*\$?\s*[\d,.]+)?\s*(?:\/\s*(?:sf|sq\.?\s*ft|ac|acres?|mo(?:nth)?|yr|year)\b|per\s+(?:sf|square\s+foot|acre|month|year)\b)[^\n]{0,160}/i);
      const quoteSnippet = quoteWindow || explicitQuote?.[0] || lr?.[0] || "";
      const annual = /annual|yearly|per[\s_-]*year|\/\s*(?:yr|year)|\bp\.?a\.?\b/i.test(quoteSnippet);
      const monthly = /monthly|per[\s_-]*month|\/\s*mo(?:nth)?\b/i.test(quoteSnippet);
      const perSF = /(?:\/\s*|per\s+)(?:sf\b|sq\.?\s*ft\b|square\s+foot\b)/i.test(quoteSnippet);
      const perAcre = /(?:\/\s*|per\s+)(?:ac\b|acres?\b)/i.test(quoteSnippet);
      const leaseQuote = {
        rawText: quoteSnippet.slice(0, 500),
        amountText: (quoteSnippet.match(/\$\s*([\d,.]+(?:\s*[-–]\s*\$?\s*[\d,.]+)?)/) || [])[1] || "",
        basis: perSF && !perAcre ? "sf" : perAcre && !perSF ? "acre" : /\btotal\b/i.test(quoteSnippet) ? "total" : "unknown",
        period: annual && !monthly ? "annual" : monthly && !annual ? "monthly" : "unknown",
        ranged: /\d\s*[-–]\s*\$?\s*\d/.test(quoteSnippet),
        gross: /\b(?:gross|fsg|mg|ig)\b/i.test(quoteSnippet),
        reviewed: false,
      };

      // ---- lease type : "Service Type  Triple Net" or "/NNN" ----
      let leaseType = "";
      const stM = txt.match(/Service Type\s*\n?\s*([A-Za-z ]+?)\s*(?:\n|CAM|$)/i);
      let ltRaw = stM ? stM[1].trim() : "";
      if (!ltRaw) { const nn = txt.match(/\/\s*(NNN|FSG|MG|IG)\b/); if (nn) ltRaw = nn[1]; }
      const ltLow = ltRaw.toLowerCase();
      if (/triple net|nnn/.test(ltLow)) leaseType = "NNN";
      else if (/full service/.test(ltLow)) leaseType = "Full Service Gross";
      else if (/industrial gross|(?:^|\b)ig\b/.test(ltLow)) leaseType = "Industrial Gross";
      else if (/modified|(?:^|\b)mg\b/.test(ltLow)) leaseType = "Modified Gross";
      leaseQuote.serviceType = ltRaw;
      leaseQuote.gross ||= /\b(?:gross|fsg|mg|ig)\b/i.test(ltRaw);

      // ---- cap rate : "Cap Rate  6.50%" ----
      let capRate = "";
      const cr = txt.match(/Cap Rate\s*\n?\s*([\d.]+)\s*%/i);
      if (cr) capRate = cr[1];

      // ---- year built : a 4-digit year near a "Built" label ----
      let yearBuilt = "";
      const yb = txt.match(/Year Built\s*\n?\s*((?:19|20)\d{2})/i) ||   // "Year Built\n1998"
                 txt.match(/\b((?:19|20)\d{2})\s*\n?\s*(?:Year )?Built\b/i); // "1998 Built" / "1998 Year Built"
      if (yb) yearBuilt = yb[1];

      // ---- optional descriptive content: Sale Highlights / Sale Notes ----
      // These are returned separately and are NEVER saved automatically. The panel
      // asks the user which sections, if any, should be appended to comp notes.
      const sectionLines = (heading, stopHeadings) => {
        const headingKey = (line) => line.replace(/\s*>{1,2}\s*$/, "").replace(/:$/, "").trim().toLowerCase();
        const start = lines.findIndex((line) => headingKey(line) === heading.toLowerCase());
        if (start < 0) return [];
        const stops = new Set(stopHeadings.map((line) => line.toLowerCase()));
        const out = [];
        for (let i = start + 1; i < lines.length; i++) {
          if (stops.has(headingKey(lines[i]))) break;
          out.push(lines[i]);
        }
        return out;
      };
      const saleHighlightLines = sectionLines("Sale Highlights", [
        "Sale Notes", "Documents", "Sale Contacts", "Building", "For Lease",
      ]);
      const saleNoteLines = sectionLines("Sale Notes", [
        "Documents", "Sale Contacts", "Building", "For Lease", "Lease Highlights", "Lease Notes",
      ]);
      const saleHighlights = saleHighlightLines
        .map((line) => line.replace(/^[•·▪◦*-]\s*/, "").trim())
        .filter(Boolean)
        .map((line) => `• ${line}`)
        .join("\n")
        .slice(0, 6000);
      const saleNotes = saleNoteLines
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);

      // Diagnostic: sample of the text actually seen, so we can tell whether the
      // scraper hit the right frame/tab when a scrape comes back empty.
      const _debug = { textLen: txt.length, sample: txt.slice(0, 400) };
      return {
        street, city, state, zip, submarket, rba, acLot, salePrice, leaseRate,
        leaseType, leaseQuote, capRate, yearBuilt, saleHighlights, saleNotes, _debug,
      };
    },
  });

  const data = results[0]?.result || {};
  data.costarId = costarId;
  data.sourceUrl = tab.url;
  data.scrapedTabUrl = tab.url;
  if (data.leaseQuote) data.leaseQuote.sourceUrl = tab.url;
  return data;
}

// ─── Surveys ───────────────────────────────────────────────────────────────────

const SURVEY_COLS = "id,name,client_name,survey_type,created_at,updated_at";

function listSurveys() {
  return sbSelect("surveys", `select=${SURVEY_COLS}&order=updated_at.desc&limit=50`);
}

function getSurvey(id) {
  return sbSelect("surveys", `select=${SURVEY_COLS}&id=eq.${encodeURIComponent(id)}`)
    .then((rows) => rows[0] || null);
}

function createSurvey({ name, client_name, survey_type }) {
  // Mirrors the web app's insert (useSurveys.ts createSurvey): created_by and
  // share_token are left to the DB, is_public defaults false.
  return sbInsert("surveys", {
    name,
    client_name: client_name || "",
    survey_type: survey_type || "lease",
    description: null,
    is_public: false,
    hidden_fields: [],
  });
}

// ─── Flyer capture: grab the open CoStar PDF → upload to survey-files bucket ──────

async function findFlyerTab() {
  const tabs = await chrome.tabs.query({});
  const cands = tabs.filter((t) => t.url && (
    /csgpimgs\.com/i.test(t.url) ||
    /\.pdf(\?|$)/i.test(t.url) ||
    /\.pdf/i.test(t.title || "")
  ));
  if (!cands.length) return null;
  return cands.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

// Download the open CoStar flyer PDF → { blob, name }. Shared by survey + comp flyers.
async function downloadOpenFlyer() {
  const tab = await findFlyerTab();
  if (!tab) {
    throw new Error("No open flyer PDF found. In CoStar, click the flyer/brochure so its PDF opens in a tab, then try again.");
  }
  // Signed CDN URL; include credentials in case it needs the CoStar session.
  const resp = await fetch(tab.url, { credentials: "include" });
  if (!resp.ok) throw new Error(`Couldn't download the flyer (${resp.status}). Make sure the PDF tab is fully loaded.`);
  const blob = await resp.blob();

  let name = "flyer.pdf";
  try { name = decodeURIComponent((new URL(tab.url).pathname.split("/").pop()) || name); } catch { /* keep default */ }
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return { blob, name };
}

// Upload a blob to the survey-files storage bucket at `path` → public URL.
async function uploadToSurveyFiles(path, blob) {
  const session = await sbGetSession();
  const up = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/survey-files/${path}`, {
    method: "POST",
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": blob.type || "application/pdf",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    throw new Error(`Upload failed: ${t.slice(0, 160) || up.status}`);
  }
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/survey-files/${path}`;
}

async function attachFlyer(surveyId) {
  const { blob, name } = await downloadOpenFlyer();
  const safe = name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const url = await uploadToSurveyFiles(`flyers/${surveyId}/${Date.now()}_${safe}`, blob);
  return { url, name };
}

async function attachCompFlyer() {
  const { blob, name } = await downloadOpenFlyer();
  const safe = name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const url = await uploadToSurveyFiles(`comps/flyers/${Date.now()}_${safe}`, blob);
  return { url, name };
}

function listSurveyProperties(surveyId) {
  return sbListAllSurveyProperties(surveyId);
}

// ─── Survey reviewed-request transport ────────────────────────────────────────
// Durable exact requests survive panel closure and worker suspension. The map
// only serializes messages in this worker; storage is the recovery authority.
const surveySavesInFlight = new Map();

async function surveySaveContext(surveyId, accountId) {
  const session = await sbGetSession();
  if (!session.user_id || (accountId && accountId !== session.user_id))
    throw authError("Sign in to the same account that owns this Survey draft.");
  if (!/^[0-9a-f-]{36}$/i.test(surveyId || "")) throw new Error("Choose a survey before saving.");
  return { accountId: session.user_id, key: `survey_pending_v1:${session.user_id}:${surveyId}` };
}

async function getSurveyPending(surveyId) {
  const context = await surveySaveContext(surveyId);
  return { pending: await sbStorageGet(context.key) };
}

async function surveyRecoverPending(context, pending) {
  if (!pending) return { status: "none", properties: [], pending: null };
  const request = pending.request;
  SurveySpaces.validateRequest(request);
  if (request.accountId !== context.accountId) throw authError("Sign in to the account that owns this draft.");
  const ids = request.kind === "insert" ? request.rows.map((row) => row.id) : [request.id];
  const result = SurveySpaces.classifyReadback(request, await sbReadSurveyIds(request.surveyId, ids));
  if (result.status === "saved") {
    await sbStorageRemove(context.key);
    return { ...result, pending: null };
  }
  // A newer timestamp on this exact update target makes the old CAS predicate
  // impossible. This permits a fresh review without replaying the stale patch.
  const canReviewCurrent = request.kind === "update" && result.status === "changed" &&
    !!result.current?.updated_at && result.current.updated_at !== request.baseline.updated_at;
  return { ...result, pending, canReviewCurrent };
}

async function recoverSurveySave(surveyId) {
  const context = await surveySaveContext(surveyId);
  return surveyRecoverPending(context, await sbStorageGet(context.key));
}

async function abandonSurveyPending(surveyId) {
  const context = await surveySaveContext(surveyId);
  if (surveySavesInFlight.has(context.key)) throw new Error("This save is still running. Verify it before changing the draft.");
  const pending = await sbStorageGet(context.key);
  const result = await surveyRecoverPending(context, pending);
  if (!result.pending) return result;
  if (result.status === "partial") throw new Error("Some spaces already exist. Reconcile this batch before clearing its pending save.");
  if (pending.phase === "prepared" || pending.saveRejected === true || result.canReviewCurrent) {
    await sbStorageRemove(context.key);
    return { ...result, pending: null };
  }
  const error = new Error("This save may still finish on the server. Keep the reviewed payload locked and retry or verify the same request.");
  error.pending = pending; error.status = result.status; throw error;
}

function validateSurveyRequestFields(request) {
  SurveySpaces.validateRequest(request);
  const writes = request.kind === "insert" ? request.rows : [request.patch];
  for (const write of writes) {
    const result = SurveyFields.validateSurveyWrite(write, request.kind === "update" ? request.baseline : undefined);
    if (!result.valid) throw new SurveySpaces.SurveySpaceConflictError(result.issues.map((issue) => issue.message).join(" "));
    if (!SurveySpaces.sameValue(write, result.values))
      throw new SurveySpaces.SurveySpaceConflictError("Review the numeric fields before saving. The request must contain validated numbers, not unparsed text.");
    const final = { ...(request.baseline || {}), ...write };
    const pricingFields = ["monthly_base_rent", "lease_rate_psf", "monthly_opex_psf", "total_monthly_opex", "total_lease_rate"];
    const coordinated = ["rent_calculation", "tenancy", "building_sf", "suite_size", ...pricingFields].some((key) => Object.hasOwn(write, key));
    if (final.rent_calculation?.version === 1 && coordinated) {
      const expected = SurveyRent.calculateSurveyRent(final.rent_calculation, final, final);
      if (!Object.hasOwn(write, "rent_calculation") || pricingFields.some((key) => !Object.hasOwn(write, key) || !SurveySpaces.sameValue(write[key], expected[key])))
        throw new SurveySpaces.SurveySpaceConflictError("Linked pricing and area must be reviewed together. Reopen the draft and recalculate before saving.");
    }
  }
  if (request.kind === "insert") SurveySpaces.assertUniqueSpaces(request.rows);
}

async function saveSurveyRequest(request) {
  try { validateSurveyRequestFields(request); }
  catch (error) { error.saveRejected = true; throw error; }
  const context = await surveySaveContext(request.surveyId, request.accountId);
  const running = surveySavesInFlight.get(context.key);
  if (running) {
    if (SurveySpaces.sameValue(running.request, request)) return running.promise;
    throw new Error("Another save is running for this survey. Verify its outcome before saving a different draft.");
  }
  const operation = { request, promise: null };
  operation.promise = executeSurveyRequest(context, request);
  surveySavesInFlight.set(context.key, operation);
  try { return await operation.promise; }
  finally { surveySavesInFlight.delete(context.key); }
}

async function executeSurveyRequest(context, request) {
  let pending = await sbStorageGet(context.key);
  if (pending && !SurveySpaces.sameValue(pending.request, request)) {
    const error = new Error("A reviewed save is pending in this survey. Recover it before changing or saving another draft.");
    error.pending = pending; throw error;
  }
  if (!pending) {
    pending = { request, phase: "prepared" };
    try { await sbStorageSet(context.key, pending); }
    catch (error) { error.message = `Draft could not be protected locally; no write was attempted. ${error.message}`; error.saveRejected = true; error.pending = null; throw error; }
  }
  // A rejection of a retry says nothing about an earlier lost request that may
  // still be running. Only the first definitely rejected dispatch can unlock.
  const hadUncertainDispatch = pending.phase === "dispatched";
  try {
    const recovered = await surveyRecoverPending(context, pending);
    if (recovered.status === "saved") return recovered;
    if (["partial", "changed"].includes(recovered.status)) return recovered;

    const existing = await listSurveyProperties(request.surveyId); // failure is never an empty survey
    if (request.kind === "insert") {
      const latest = SurveySpaces.classifyReadback(request, existing);
      if (latest.status === "saved") return surveyRecoverPending(context, pending);
      if (latest.status === "partial") return { ...latest, pending };
      SurveySpaces.assertUniqueSpaces(request.rows, existing);
    }
    else {
      const current = existing.find((row) => row.id === request.id);
      if (!current || !SurveySpaces.sameValue(current, request.baseline))
        return { status: "changed", current: current || null, properties: current ? [current] : [], pending };
      if (["tenancy", "address", "city", "state", "suite_number"].some((key) => Object.hasOwn(request.patch, key)))
        SurveySpaces.assertUniqueSpaces([{ ...current, ...request.patch }], existing);
    }
    const dispatched = { request: pending.request, phase: "dispatched" };
    // A failure to store the dispatch state stops before the write as well.
    await sbStorageSet(context.key, dispatched);
    pending = dispatched;
    let writeError;
    try {
      if (request.kind === "insert") await sbInsertSurveyBatch(request.rows);
      else await sbUpdateSurveyScoped(request.surveyId, request.id, request.baseline.updated_at, request.patch);
    } catch (error) { writeError = error; }
    if (writeError?.surveyWriteRejected === true && !hadUncertainDispatch) {
      const rejected = { ...pending, phase: "rejected", saveRejected: true };
      await sbStorageSet(context.key, rejected);
      pending = rejected;
      throw writeError;
    }
    // Even a failed/lost write response may represent a committed statement.
    const verified = await surveyRecoverPending(context, pending);
    if (verified.status === "saved" || verified.status === "partial" || verified.status === "changed") return verified;
    if (writeError) { writeError.pending = pending; writeError.status = "none"; throw writeError; }
    return verified;
  } catch (error) {
    // Before first dispatch there is no uncertain write. Permit correcting the
    // retained UI draft. Once dispatched, only verified recovery can clear it.
    if (pending.phase === "prepared" || pending.saveRejected === true) {
      try { await sbStorageRemove(context.key); }
      catch (storageError) {
        storageError.pending = pending; storageError.saveRejected = true;
        storageError.message = `No write is pending, but its local recovery record could not be cleared. ${storageError.message}`;
        throw storageError;
      }
      error.saveRejected = true; error.pending = null;
    } else { error.pending = pending; error.saveRejected = false; }
    throw error;
  }
}

// ─── Comps (master-app `comps` table) ────────────────────────────────────────────

const COMP_COLS =
  "id,address,property_name,city,state,zip,status,property_type,sale_type,sale_price,price_psf," +
  "rent_psf,lease_format,cap_rate,building_sf,land_area,yard_included,sub_market,submarket_cluster," +
  "listing_brokerage,listing_agent,listing_agent_phone,listing_agent_email," +
  "last_verified_at,list_date,notes,flyer_url,property_id,suite,partial_site_override,multi_tenant";

// Find existing comps that likely match the CoStar listing, so the panel can offer
// "update" instead of a duplicate insert. PostgREST ilike wildcard is a literal `*`
// (never percent-encoded); the user-supplied text is encoded, then the `*` re-added.
// sbSelect appends the query string raw, so spaces in a pattern must be %20.
async function searchComps({ streetNumber, streetToken, costarId, city, state }) {
  const byId = new Map();
  const scope = `${city ? `&city=ilike.${encodeURIComponent(city)}` : ""}${state ? `&state=ilike.${encodeURIComponent(state)}` : ""}`;

  // CoStar-ID matches first — most precise (we stamp "CoStar ID: <n>" into notes).
  if (costarId) {
    const pat = `*CoStar ID: ${encodeURIComponent(costarId)}*`.replace(/ /g, "%20");
    const rows = await sbSelect("comps", `select=${COMP_COLS}&notes=ilike.${pat}${scope}&limit=5`);
    for (const r of rows) byId.set(r.id, r);
  }

  // Then street-number prefix (e.g. "4645*" → "4645 S 35th Ave").
  if (streetNumber) {
    const rows = await sbSelect(
      "comps",
      `select=${COMP_COLS}&address=ilike.${encodeURIComponent(streetNumber)}*${scope}&limit=20`
    );
    for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  }

  return Array.from(byId.values()).slice(0, 20);
}

async function saveCompWithProperty(request) {
  if (!request || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.p_request_id || "")) {
    const error = new Error("Save request is missing its retry ID. Reopen the extension.");
    error.saveRejected = true;
    throw error;
  }
  return sbRpc("save_comp_with_property", request);
}

// ─── Side panel: open on toolbar-icon click ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const reply = async (promise) => {
    try {
      sendResponse({ ok: true, ...await promise });
    } catch (e) {
      const surveySaveMessage = ["SAVE_SURVEY_BATCH", "SAVE_SURVEY_UPDATE", "RECOVER_SURVEY_SAVE", "ABANDON_SURVEY_PENDING"].includes(msg.type);
      sendResponse({ ok: false, error: e.message, authRequired: e.code === "AUTH_REQUIRED", saveRejected: e.saveRejected === true || (!surveySaveMessage && e.code === "AUTH_REQUIRED" && !e.pending),
        ...(Object.hasOwn(e, "pending") ? { pending: e.pending } : {}),
        ...(e.status ? { status: e.status } : {}), ...(e.current ? { current: e.current } : {}) });
    }
  };

  switch (msg.type) {
    case "AUTH_STATUS":
      // Reports whether a session is stored; expiry is handled lazily on first use.
      reply(sbGetStored().then((s) => ({ connected: !!(s && s.refresh_token), email: s ? s.email : null, accountId: s?.user_id || null })));
      return true;

    case "AUTH_SEND_OTP":
      reply(sbSendOtp(msg.email).then(() => ({})));
      return true;

    case "AUTH_VERIFY_OTP":
      reply(sbVerifyOtp(msg.email, msg.token).then((s) => ({ email: s.email, accountId: s.user_id })));
      return true;

    case "AUTH_VERIFY_LINK":
      reply(sbVerifyLink(msg.link).then((s) => ({ email: s.email, accountId: s.user_id })));
      return true;

    case "AUTH_SIGN_OUT":
      reply(sbClear().then(() => ({})));
      return true;

    case "READ_COSTAR":
      reply(readCoStar().then((data) => ({ data })));
      return true;

    case "LIST_SURVEYS":
      reply(listSurveys().then((surveys) => ({ surveys })));
      return true;

    case "GET_SURVEY":
      reply(getSurvey(msg.id).then((survey) => ({ survey })));
      return true;

    case "CREATE_SURVEY":
      reply(createSurvey(msg.fields || {}).then((survey) => ({ survey })));
      return true;

    case "ATTACH_FLYER":
      reply(attachFlyer(msg.surveyId).then((r) => r));
      return true;

    case "LIST_SURVEY_PROPERTIES":
      reply(listSurveyProperties(msg.surveyId).then((properties) => ({ properties })));
      return true;

    case "GET_SURVEY_PENDING":
      reply(getSurveyPending(msg.surveyId));
      return true;

    case "RECOVER_SURVEY_SAVE":
      reply(recoverSurveySave(msg.surveyId));
      return true;

    case "ABANDON_SURVEY_PENDING":
      reply(abandonSurveyPending(msg.surveyId));
      return true;

    case "SAVE_SURVEY_BATCH":
    case "SAVE_SURVEY_UPDATE":
      reply(saveSurveyRequest(msg.request));
      return true;

    case "SEARCH_COMPS":
      reply(searchComps({
        streetNumber: msg.streetNumber || "",
        streetToken: msg.streetToken || "",
        costarId: msg.costarId || "",
        city: msg.city || "",
        state: msg.state || "",
      }).then((comps) => ({ comps })));
      return true;

    case "SAVE_COMP":
      reply(saveCompWithProperty(msg.request));
      return true;

    case "ATTACH_COMP_FLYER":
      reply(attachCompFlyer().then((r) => r));
      return true;

    default:
      sendResponse({ ok: false, error: "Unknown message type: " + msg.type });
      return false;
  }
});
