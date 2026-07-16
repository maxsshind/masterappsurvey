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

importScripts("config.js", "supabase.js");

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

      // ---- cap rate : "Cap Rate  6.50%" ----
      let capRate = "";
      const cr = txt.match(/Cap Rate\s*\n?\s*([\d.]+)\s*%/i);
      if (cr) capRate = cr[1];

      // ---- year built : a 4-digit year near a "Built" label ----
      let yearBuilt = "";
      const yb = txt.match(/Year Built\s*\n?\s*((?:19|20)\d{2})/i) ||   // "Year Built\n1998"
                 txt.match(/\b((?:19|20)\d{2})\s*\n?\s*(?:Year )?Built\b/i); // "1998 Built" / "1998 Year Built"
      if (yb) yearBuilt = yb[1];

      // Diagnostic: sample of the text actually seen, so we can tell whether the
      // scraper hit the right frame/tab when a scrape comes back empty.
      const _debug = { textLen: txt.length, sample: txt.slice(0, 400) };
      return { street, city, state, zip, submarket, rba, acLot, salePrice, leaseRate, leaseType, capRate, yearBuilt, _debug };
    },
  });

  const data = results[0]?.result || {};
  data.costarId = costarId;
  data.sourceUrl = tab.url;
  data.scrapedTabUrl = tab.url;
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
  return sbSelect(
    "survey_properties",
    `select=*&survey_id=eq.${encodeURIComponent(surveyId)}&order=created_at.asc`
  );
}

// ─── Comps (master-app `comps` table) ────────────────────────────────────────────

const COMP_COLS =
  "id,address,city,zip,status,type,sale_price,rent_psf,cap_rate,building_sf,land_area,sub_market,submarket_cluster,last_verified_at,list_date,notes";

// Find existing comps that likely match the CoStar listing, so the panel can offer
// "update" instead of a duplicate insert. PostgREST ilike wildcard is a literal `*`
// (never percent-encoded); the user-supplied text is encoded, then the `*` re-added.
// sbSelect appends the query string raw, so spaces in a pattern must be %20.
async function searchComps({ streetNumber, streetToken, costarId }) {
  const byId = new Map();

  // CoStar-ID matches first — most precise (we stamp "CoStar ID: <n>" into notes).
  if (costarId) {
    const pat = `*CoStar ID: ${encodeURIComponent(costarId)}*`.replace(/ /g, "%20");
    const rows = await sbSelect("comps", `select=${COMP_COLS}&notes=ilike.${pat}&limit=5`);
    for (const r of rows) byId.set(r.id, r);
  }

  // Then street-number prefix (e.g. "4645*" → "4645 S 35th Ave").
  if (streetNumber) {
    const rows = await sbSelect(
      "comps",
      `select=${COMP_COLS}&address=ilike.${encodeURIComponent(streetNumber)}*&limit=20`
    );
    for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  }

  return Array.from(byId.values()).slice(0, 20);
}

// ─── Side panel: open on toolbar-icon click ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const reply = (p) =>
    p.then((v) => sendResponse({ ok: true, ...v }))
     .catch((e) => sendResponse({ ok: false, error: e.message, authRequired: e.code === "AUTH_REQUIRED" }));

  switch (msg.type) {
    case "AUTH_STATUS":
      // Reports whether a session is stored; expiry is handled lazily on first use.
      reply(sbGetStored().then((s) => ({ connected: !!(s && s.refresh_token), email: s ? s.email : null })));
      return true;

    case "AUTH_SEND_OTP":
      reply(sbSendOtp(msg.email).then(() => ({})));
      return true;

    case "AUTH_VERIFY_OTP":
      reply(sbVerifyOtp(msg.email, msg.token).then((s) => ({ email: s.email })));
      return true;

    case "AUTH_VERIFY_LINK":
      reply(sbVerifyLink(msg.link).then((s) => ({ email: s.email })));
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

    case "INSERT_PROPERTY":
      reply(sbInsert("survey_properties", msg.record || {}).then((property) => ({ property })));
      return true;

    case "UPDATE_PROPERTY":
      reply(sbUpdate("survey_properties", msg.id, msg.patch || {}).then((property) => ({ property })));
      return true;

    case "SEARCH_COMPS":
      reply(searchComps({
        streetNumber: msg.streetNumber || "",
        streetToken: msg.streetToken || "",
        costarId: msg.costarId || "",
      }).then((comps) => ({ comps })));
      return true;

    case "INSERT_COMP":
      reply(sbInsert("comps", msg.record || {}).then((comp) => ({ comp })));
      return true;

    case "UPDATE_COMP":
      reply(sbUpdate("comps", msg.id, msg.patch || {}).then((comp) => ({ comp })));
      return true;

    case "ATTACH_COMP_FLYER":
      reply(attachCompFlyer().then((r) => r));
      return true;

    default:
      sendResponse({ ok: false, error: "Unknown message type: " + msg.type });
      return false;
  }
});
