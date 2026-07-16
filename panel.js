/**
 * panel.js — side-panel UI (CoStar → Survey Pusher)
 *
 * Flow: sign in (email OTP) → pick a survey → scrape the CoStar tab → insert the
 * property into the survey, or — if it's already in the survey — update it.
 * The "Survey" tab lists every property in the chosen survey for status edits
 * without needing to be on a CoStar page.
 */

// Picklists — mirror master-app src/lib/types.ts (source of truth).
const AVAILABILITY_OPTIONS = [
  "Available", "Confirmed", "Confirming Availability", "Not Available", "Available/Interested",
];
const INTERNAL_STATUS_OPTIONS = [
  "Confirmed with broker", "Waiting for response", "Need to follow up", "Not responsive",
];
const LEASE_TYPES = ["Full Service Gross", "Modified Gross", "Industrial Gross", "NNN"];

// ─── Tiny DOM helpers ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function showError(node, msg) { node.textContent = msg; node.classList.remove("hidden"); }
function hideError(node) { node.classList.add("hidden"); }
function setLoading(btn, on) { btn.classList.toggle("loading", on); btn.disabled = on; }

let toastTimer = null;
function toast(html, isErr = false, ms = 5000) {
  const t = $("toast");
  t.innerHTML = html;
  t.classList.toggle("err", isErr);
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), ms);
}

// ─── State ─────────────────────────────────────────────────────────────────────

const state = {
  authed: false,
  email: null,
  survey: null,      // { id, name, client_name, survey_type }
  props: [],         // survey_properties rows for the current survey
  scraped: null,     // last CoStar scrape
  mode: null,        // 'insert' | 'update'
  editingId: null,   // survey_properties.id being updated
  baseline: null,    // DB row backing the form in update mode (dirty-diff base)
  pendingDup: null,  // possible-match row awaiting the user's update-vs-new choice
  screen: "idle",
  tab: "push",
  appMode: "survey", // 'survey' (push into a survey) | 'comp' (push into comps table)
};

// ─── Messaging: send to the service worker, retrying on MV3 cold start ──────────
// Writes never speculatively re-send on a slow reply (would risk a duplicate insert).

function bg(type, extra = {}, opts = {}, attempt = 0) {
  const isWrite = opts.write === true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timeoutMs = isWrite ? 60000 : (attempt === 0 ? 300 : 1500);
    const timeoutId = setTimeout(async () => {
      if (settled) return;
      if (!isWrite && attempt < 2) finish(await bg(type, extra, opts, attempt + 1));
      else finish({ ok: false, error: "Background script not responding. Click the extension icon again." });
    }, timeoutMs);
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (resp) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          if (attempt < 2) setTimeout(async () => finish(await bg(type, extra, opts, attempt + 1)), 50);
          else finish({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        finish(resp);
      });
    } catch (err) { clearTimeout(timeoutId); finish({ ok: false, error: err.message }); }
  });
}

// Any backend response that signals a dead session bounces to sign-in.
function handleAuthFailure(res) {
  if (res && res.authRequired) {
    state.authed = false;
    showScreen("auth-email");
    showError($("authEmailError"), "Session expired — please sign in again.");
    return true;
  }
  return false;
}

// ─── Screens / chrome ──────────────────────────────────────────────────────────

const SCREENS = ["auth-email", "auth-code", "picker", "form", "browse", "idle", "settings"];
function showScreen(name) {
  state.screen = name;
  // "comp" is not a survey SCREEN — it's the Comp-mode takeover of the content area.
  const isComp = name === "comp";
  SCREENS.forEach((s) => $("screen-" + s).classList.toggle("hidden", isComp || s !== name));
  const compScreen = $("screen-comp");
  if (compScreen) compScreen.classList.toggle("hidden", !isComp);
  const inApp = state.authed && !["auth-email", "auth-code"].includes(name);
  const modeToggle = $("modeToggle");
  if (modeToggle) modeToggle.classList.toggle("hidden", !inApp || name === "settings");
  $("contextBar").classList.toggle("hidden", !inApp || name === "settings" || isComp);
  $("tabBar").classList.toggle("hidden", !inApp || !state.survey || ["picker", "settings", "comp"].includes(name));
  $("btnOpenApp").classList.toggle("hidden", !state.survey);
  syncModeToggle();
}

function setTab(tab) {
  state.tab = tab;
  $("tabPush").classList.toggle("active", tab === "push");
  $("tabBrowse").classList.toggle("active", tab === "browse");
  if (tab === "browse") { renderBrowse(); showScreen("browse"); }
  else showScreen(state.mode ? "form" : "idle");
}
$("tabPush").addEventListener("click", () => setTab("push"));
$("tabBrowse").addEventListener("click", () => setTab("browse"));

function updateContextBar() {
  $("ctxSurveyName").textContent = state.survey ? state.survey.name : "No survey selected";
  const n = state.props.length;
  const badge = $("browseCount");
  badge.textContent = String(n);
  badge.classList.toggle("hidden", !state.survey);
}
$("btnChangeSurvey").addEventListener("click", () => openPicker());

// ─── Init ──────────────────────────────────────────────────────────────────────

function fillSelect(node, values, placeholder) {
  node.innerHTML = `<option value="">${placeholder}</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

async function init() {
  fillSelect($("fAvailability"), AVAILABILITY_OPTIONS, "—");
  fillSelect($("fInternalStatus"), INTERNAL_STATUS_OPTIONS, "—");
  fillSelect($("fLeaseType"), LEASE_TYPES, "—");

  const storedMode = await chrome.storage.local.get(["mode"]);
  state.appMode = storedMode.mode === "comp" ? "comp" : "survey";
  initCompMode();
  syncModeToggle();

  const status = await bg("AUTH_STATUS");
  if (status.ok && status.connected) {
    state.authed = true;
    state.email = status.email;
    await onAuthed();
  } else {
    const stored = await chrome.storage.local.get(["last_email"]);
    $("authEmail").value = stored.last_email || "max@rgcre.com";
    showScreen("auth-email");
  }
}

async function onAuthed() {
  syncModeToggle();
  // Restore last-used survey (verify it still exists), else prompt to pick.
  const stored = await chrome.storage.local.get(["last_survey_id"]);
  if (stored.last_survey_id) {
    const res = await bg("GET_SURVEY", { id: stored.last_survey_id });
    if (handleAuthFailure(res)) return;
    if (res.ok && res.survey) {
      await selectSurvey(res.survey, { silent: true });
      // Comp mode is independent of surveys — land there once context is restored.
      if (state.appMode === "comp") { enterCompMode(); return; }
      // If a CoStar record is on screen, read it right away.
      const tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      if (tab && costarRecordKey(tab.url)) doRead();
      else { setTab("push"); }
      return;
    }
    chrome.storage.local.remove(["last_survey_id"]);
  }
  if (state.appMode === "comp") { enterCompMode(); return; }
  openPicker({ noBack: true });
}

// ─── Auth (email OTP) ──────────────────────────────────────────────────────────

$("btnSendOtp").addEventListener("click", async () => {
  const email = $("authEmail").value.trim().toLowerCase();
  if (!email) return;
  hideError($("authEmailError"));
  setLoading($("btnSendOtp"), true);
  const res = await bg("AUTH_SEND_OTP", { email }, { write: true });
  setLoading($("btnSendOtp"), false);
  if (!res.ok) return showError($("authEmailError"), res.error);
  chrome.storage.local.set({ last_email: email });
  state.email = email;
  $("authEmailShown").textContent = email;
  $("authCode").value = "";
  showScreen("auth-code");
  startResendCooldown();
  $("authCode").focus();
});

let resendTimer = null;
function startResendCooldown() {
  const btn = $("btnResendOtp");
  let left = 60;
  btn.disabled = true;
  btn.textContent = `Resend code (${left}s)`;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.textContent = "Resend code"; }
    else btn.textContent = `Resend code (${left}s)`;
  }, 1000);
}

$("btnResendOtp").addEventListener("click", async () => {
  hideError($("authCodeError"));
  const res = await bg("AUTH_SEND_OTP", { email: state.email }, { write: true });
  if (!res.ok) return showError($("authCodeError"), res.error);
  startResendCooldown();
});

$("btnAuthBack").addEventListener("click", () => showScreen("auth-email"));

// Skip sending: jump straight to the code/link screen with an email already in hand.
$("btnHaveEmail").addEventListener("click", () => {
  const email = $("authEmail").value.trim().toLowerCase();
  if (!email) return showError($("authEmailError"), "Enter your email first.");
  state.email = email;
  chrome.storage.local.set({ last_email: email });
  $("authEmailShown").textContent = email;
  $("authCode").value = "";
  showScreen("auth-code");
});

async function verifyCode() {
  const token = $("authCode").value.replace(/\D/g, "");
  if (token.length !== 6) return showError($("authCodeError"), "Enter the 6-digit code from the email.");
  hideError($("authCodeError"));
  setLoading($("btnVerifyOtp"), true);
  const res = await bg("AUTH_VERIFY_OTP", { email: state.email, token }, { write: true });
  setLoading($("btnVerifyOtp"), false);
  if (!res.ok) return showError($("authCodeError"), res.error);
  state.authed = true;
  await onAuthed();
}
$("btnVerifyOtp").addEventListener("click", verifyCode);

// Rate-limit fallback: paste the email's "Log In" link (right-click → Copy Link).
$("btnVerifyLink").addEventListener("click", async () => {
  const link = $("authLink").value.trim();
  if (!link) return showError($("authCodeError"), "Paste the Log In link from the email first.");
  hideError($("authCodeError"));
  setLoading($("btnVerifyLink"), true);
  const res = await bg("AUTH_VERIFY_LINK", { link }, { write: true });
  setLoading($("btnVerifyLink"), false);
  if (!res.ok) return showError($("authCodeError"), res.error);
  state.authed = true;
  await onAuthed();
});
$("authCode").addEventListener("keydown", (e) => { if (e.key === "Enter") verifyCode(); });

// ─── Header buttons ────────────────────────────────────────────────────────────

$("btnRefresh").addEventListener("click", () => { if (state.authed && state.survey) doRead(); });

$("btnOpenApp").addEventListener("click", () => {
  if (state.survey) chrome.tabs.create({ url: `${CONFIG.APP_URL}/surveys/${state.survey.id}` });
});

chrome.windows.getCurrent((win) => {
  if (win && win.type === "popup") $("btnPopout").classList.add("hidden"); // already detached
});
$("btnPopout").addEventListener("click", () => {
  chrome.windows.create({ url: "panel.html", type: "popup", width: 420, height: 760 }, () => {
    window.close();
  });
});

$("btnSettings").addEventListener("click", async () => {
  const status = await bg("AUTH_STATUS");
  $("authStatusLabel").textContent = status.connected ? `Signed in · ${status.email || ""}` : "Not signed in";
  showScreen("settings");
});
$("btnBack").addEventListener("click", () => setTab(state.tab));
$("btnDisconnect").addEventListener("click", async () => {
  await bg("AUTH_SIGN_OUT");
  state.authed = false;
  state.survey = null;
  state.mode = null;
  showScreen("auth-email");
});

// ─── Survey picker ─────────────────────────────────────────────────────────────

let pickerSurveys = [];
let nsTypeValue = "lease";

async function openPicker(opts = {}) {
  showScreen("picker");
  $("btnPickerBack").classList.toggle("hidden", !!opts.noBack || !state.survey);
  $("pickerFilter").value = "";
  $("newSurveyForm").classList.add("hidden");
  hideError($("pickerError"));
  $("surveyList").innerHTML = `<div class="hint">Loading surveys…</div>`;
  const res = await bg("LIST_SURVEYS");
  if (handleAuthFailure(res)) return;
  if (!res.ok) { $("surveyList").innerHTML = ""; return showError($("pickerError"), res.error); }
  pickerSurveys = res.surveys || [];
  renderPickerList();
}

const TYPE_LABEL = { lease: "Lease", sale: "Sale", lease_and_sale: "Lease + Sale" };

function renderPickerList() {
  const q = $("pickerFilter").value.trim().toLowerCase();
  const rows = pickerSurveys.filter((s) =>
    !q || (s.name || "").toLowerCase().includes(q) || (s.client_name || "").toLowerCase().includes(q));
  const items = [
    `<div class="tab-item" data-new="1">
       <div class="tab-info"><div class="tab-title">➕ New survey</div></div>
       <span class="tab-badge new">create</span>
     </div>`,
  ].concat(rows.map((s) => `
    <div class="tab-item ${state.survey && state.survey.id === s.id ? "selected" : ""}" data-id="${esc(s.id)}">
      <div class="tab-info">
        <div class="tab-title">${esc(s.name)}</div>
        <div class="tab-id">${esc(s.client_name || "")}${s.client_name ? " · " : ""}${esc((s.updated_at || s.created_at || "").slice(0, 10))}</div>
      </div>
      <span class="tab-badge">${esc(TYPE_LABEL[s.survey_type] || s.survey_type || "")}</span>
    </div>`));
  $("surveyList").innerHTML = items.join("");

  $("surveyList").querySelectorAll(".tab-item").forEach((node) => {
    node.addEventListener("click", () => {
      if (node.dataset.new) {
        $("newSurveyForm").classList.toggle("hidden");
        $("nsName").focus();
        return;
      }
      const s = pickerSurveys.find((x) => x.id === node.dataset.id);
      if (s) selectSurvey(s);
    });
  });
}
$("pickerFilter").addEventListener("input", renderPickerList);
$("btnPickerBack").addEventListener("click", () => setTab(state.tab));

$("nsType").querySelectorAll(".seg-btn").forEach((b) => {
  b.addEventListener("click", () => {
    nsTypeValue = b.dataset.v;
    $("nsType").querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === b));
  });
});

$("btnCreateSurvey").addEventListener("click", async () => {
  const name = $("nsName").value.trim();
  if (!name) return showError($("pickerError"), "Survey name is required.");
  hideError($("pickerError"));
  setLoading($("btnCreateSurvey"), true);
  const res = await bg("CREATE_SURVEY", {
    fields: { name, client_name: $("nsClient").value.trim(), survey_type: nsTypeValue },
  }, { write: true });
  setLoading($("btnCreateSurvey"), false);
  if (handleAuthFailure(res)) return;
  if (!res.ok) return showError($("pickerError"), res.error);
  $("nsName").value = ""; $("nsClient").value = "";
  await selectSurvey(res.survey);
  toast(`Survey created: <strong>${esc(res.survey.name)}</strong>`);
});

async function selectSurvey(survey, opts = {}) {
  state.survey = survey;
  state.mode = null;
  state.editingId = null;
  chrome.storage.local.set({ last_survey_id: survey.id });
  await reloadProps();
  updateContextBar();
  if (!opts.silent) {
    // Re-evaluate the current scrape against the new survey, or land on Push.
    if (state.scraped && state.scraped.street) matchAndShowForm();
    else setTab("push");
  }
}

async function reloadProps() {
  if (!state.survey) return;
  const res = await bg("LIST_SURVEY_PROPERTIES", { surveyId: state.survey.id });
  if (handleAuthFailure(res)) return;
  state.props = res.ok ? (res.properties || []) : [];
  updateContextBar();
}

// ─── Read CoStar ───────────────────────────────────────────────────────────────

async function doRead(opts = {}) {
  if (!state.survey) return openPicker();
  setTab("push");
  hideError($("idleError"));
  hideError($("formError"));

  // When auto-reading after a record change, CoStar's URL updates BEFORE its content
  // re-renders — so an immediate scrape can return the previous record. Retry until
  // the scraped street is non-empty AND differs from what we had loaded.
  const awaitChange = opts.awaitChangeFromStreet || null;
  let d = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await bg("READ_COSTAR");
    if (!res.ok) { showScreen("idle"); showError($("idleError"), res.error); return; }
    d = res.data || {};
    if (!awaitChange) break;
    if (d.street && d.street !== awaitChange) break;
    await sleep(300);
  }

  state.scraped = d;
  await reloadProps(); // fresh duplicate check against current DB state
  matchAndShowForm();
}

$("btnRead").addEventListener("click", () => doRead());

// ─── Detect navigation to a NEW CoStar record ──────────────────────────────────
// The side panel stays open across navigation; CoStar is a SPA so tab events fire
// unreliably. A 1-second poll of the active tab URL is the reliable backstop.

function costarRecordKey(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("costar.com")) return null;
    if (!u.pathname.includes("/detail/")) return null;
    const num = u.pathname.match(/\/(\d{4,})(?:\/|$)/);
    if (num) return num[1];
    return u.pathname.replace(/\/[^/]*$/, "");
  } catch { return null; }
}

let lastNavKey = null;
let navBusy = false;
async function maybeReReadOnNav() {
  if (navBusy) return;
  if (!state.authed || !state.survey) return;
  // Don't yank the UI while Max is picking a survey, in settings, signing in,
  // or working the Survey tab.
  if (state.tab !== "push") return;
  if (!["form", "idle"].includes(state.screen)) return;
  let tab;
  try { tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; }
  catch { return; }
  const key = costarRecordKey(tab && tab.url);
  if (!key) return;
  if (state.scraped && key === costarRecordKey(state.scraped.sourceUrl)) return;
  if (key === lastNavKey) return;
  lastNavKey = key;
  navBusy = true;
  const fromStreet = (state.scraped && state.scraped.street) || null;
  try { await doRead({ awaitChangeFromStreet: fromStreet }); } finally { navBusy = false; }
}
chrome.tabs.onUpdated.addListener((_id, changeInfo) => { if (changeInfo.url) maybeReReadOnNav(); });
chrome.tabs.onActivated.addListener(() => maybeReReadOnNav());
setInterval(maybeReReadOnNav, 1000);

// ─── Address matching (duplicate detection within the survey) ────────────────────

const SUFFIXES = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", boulevard: "blvd",
  lane: "ln", parkway: "pkwy", highway: "hwy", place: "pl", court: "ct", circle: "cir",
  way: "way", trail: "trl", terrace: "ter", loop: "loop",
};
const DIRECTIONS = { north: "n", south: "s", east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw" };

function normAddress(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIXES[w] || DIRECTIONS[w] || w)
    .join(" ");
}

// Returns { row, confidence: 'confident' | 'possible' } or null.
function findMatch(scraped) {
  if (!scraped) return null;
  // CoStar ID stamped in internal_notes → instant match even if the address was
  // hand-edited in the web app.
  if (scraped.costarId) {
    const byId = state.props.find((p) => (p.internal_notes || "").includes(`CoStar ID: ${scraped.costarId}`));
    if (byId) return { row: byId, confidence: "confident" };
  }
  if (!scraped.street) return null;
  const target = normAddress(scraped.street);
  const targetNum = target.match(/^(\d+)/)?.[1];
  const targetName = target.replace(/^\d+(-\d+)?\s*/, "").split(" ")[0] || "";

  let possible = null;
  for (const p of state.props) {
    const cand = normAddress(p.address);
    if (cand && cand === target) return { row: p, confidence: "confident" };
    const candNum = cand.match(/^(\d+)/)?.[1];
    const candName = cand.replace(/^\d+(-\d+)?\s*/, "").split(" ")[0] || "";
    if (!possible && targetNum && candNum === targetNum && targetName && candName === targetName) {
      possible = p;
    }
  }
  return possible ? { row: possible, confidence: "possible" } : null;
}

// ─── Property form ─────────────────────────────────────────────────────────────

// DB column → form element + type. 'num' strips $ , % /SF etc.
const FIELDS = {
  address: ["fAddress", "text"],
  city: ["fCity", "text"],
  state: ["fState", "text"],
  zip: ["fZip", "text"],
  building_sf: ["fBuildingSf", "num"],
  land_area_ac: ["fLandAc", "num"],
  suite_size: ["fSuiteSize", "text"],
  suite_number: ["fSuiteNumber", "text"],
  office_sf: ["fOfficeSf", "num"],
  sale_price: ["fSalePrice", "num"],
  cap_rate: ["fCapRate", "num"],
  zoning: ["fZoning", "text"],
  tenancy: ["fTenancy", "text"],
  lease_rate_psf: ["fLeaseRate", "num"],
  lease_type: ["fLeaseType", "text"],
  total_lease_rate: ["fTotalLeaseRate", "num"],
  num_private_offices: ["fOffices", "num"],
  monthly_base_rent: ["fMonthlyBase", "num"],
  monthly_opex_psf: ["fOpexPsf", "num"],
  total_monthly_opex: ["fOpexTotal", "num"],
  power: ["fPower", "text"],
  loading: ["fLoading", "text"],
  clear_height: ["fClearHeight", "text"],
  date_available: ["fDateAvailable", "text"],
  availability: ["fAvailability", "text"],
  yard_area: ["fYardArea", "bool"],
  flyer_url: ["fFlyerUrl", "text"],
  photo_url: ["fPhotoUrl", "text"],
  notes: ["fNotes", "text"],
  internal_notes: ["fInternalNotes", "text"],
  internal_status: ["fInternalStatus", "text"],
  is_featured: ["fFeatured", "bool"],
};

function parseNum(v) {
  const n = parseFloat(String(v || "").replace(/[$,%\s]/g, "").replace(/\/?sf$/i, ""));
  return isNaN(n) ? null : n;
}

function readForm() {
  const rec = {};
  for (const [col, [id, type]] of Object.entries(FIELDS)) {
    const node = $(id);
    if (type === "bool") rec[col] = node.checked;
    else if (type === "num") rec[col] = parseNum(node.value);
    else rec[col] = node.value.trim() || null;
  }
  const fsl = [];
  if ($("fForSale").checked) fsl.push("sale");
  if ($("fForLease").checked) fsl.push("lease");
  rec.for_sale_or_lease = fsl;
  if (!rec.state) rec.state = "AZ";
  return rec;
}

function fillForm(row) {
  for (const [col, [id, type]] of Object.entries(FIELDS)) {
    const node = $(id);
    const v = row[col];
    if (type === "bool") node.checked = !!v;
    else node.value = v === null || v === undefined ? "" : String(v);
  }
  const fsl = row.for_sale_or_lease || [];
  $("fForSale").checked = fsl.includes("sale");
  $("fForLease").checked = fsl.includes("lease");
  updateBlockVisibility();
}

function updateBlockVisibility() {
  $("saleBlock").classList.toggle("hidden", !$("fForSale").checked);
  $("leaseBlock").classList.toggle("hidden", !$("fForLease").checked);
  // Tenancy-aware size fields on pure lease surveys:
  // ST hides suite fields; MT makes Building SF optional and shows suite fields.
  // Hidden inputs keep their values — toggling never wipes data.
  const surveyType = state.survey ? state.survey.survey_type : null;
  const leaseOnly = surveyType === "lease";
  const tenancy = $("fTenancy").value;
  const isST = leaseOnly && tenancy === "ST";
  const isMT = leaseOnly && tenancy === "MT";
  $("rowSuiteNumber").classList.toggle("hidden", isST);
  $("rowOfficeSf").classList.toggle("hidden", isST);
  $("rowSuiteSize").classList.toggle("hidden", isST);
  $("lblBuildingSf").textContent = isMT ? "Building SF (optional)" : "Building SF";
}
$("fForSale").addEventListener("change", updateBlockVisibility);
$("fForLease").addEventListener("change", updateBlockVisibility);
$("fTenancy").addEventListener("change", updateBlockVisibility);

function scrapeInternalNotes(d) {
  const parts = [];
  if (d.costarId) parts.push(`CoStar ID: ${d.costarId}`);
  if (d.sourceUrl) parts.push(`CoStar: ${d.sourceUrl}`);
  if (d.submarket) parts.push(`Submarket: ${d.submarket}`);
  return parts.join("\n");
}

// Build the blank/scrape-prefilled record for INSERT mode.
function recordFromScrape(d) {
  const surveyType = state.survey ? state.survey.survey_type : "lease";
  return {
    address: d.street || "",
    city: d.city || null,
    state: d.state || "AZ",
    zip: d.zip || null,
    building_sf: parseNum(d.rba),
    land_area_ac: parseNum(d.acLot),
    sale_price: parseNum(d.salePrice),
    cap_rate: parseNum(d.capRate),
    lease_rate_psf: parseNum(d.leaseRate),
    lease_type: d.leaseType || null,
    for_sale_or_lease:
      surveyType === "lease_and_sale" ? ["sale", "lease"] :
      surveyType === "sale" ? ["sale"] : ["lease"],
    internal_notes: scrapeInternalNotes(d),
  };
}

function setBanner(mode, row) {
  const b = $("modeBanner");
  b.classList.remove("hidden", "new", "update");
  if (mode === "insert") {
    b.classList.add("new");
    b.textContent = "New to this survey";
  } else {
    b.classList.add("update");
    b.textContent = `Already in survey ✓ — updating ${row.address}`;
  }
}

// Suggestions: fields where the fresh scrape differs from the DB row (update mode).
function renderSuggestions(row, d) {
  const wrap = $("suggestions");
  const list = $("suggList");
  const diffs = [];
  const cmp = [
    ["address", "Address", d.street, row.address, "fAddress"],
    ["building_sf", "Building SF", parseNum(d.rba), row.building_sf, "fBuildingSf"],
    ["land_area_ac", "Land AC", parseNum(d.acLot), row.land_area_ac, "fLandAc"],
  ];
  for (const [col, label, scrapedV, dbV, inputId] of cmp) {
    if (scrapedV === null || scrapedV === undefined || scrapedV === "") continue;
    const same = col === "address"
      ? normAddress(scrapedV) === normAddress(dbV)
      : Number(scrapedV) === Number(dbV);
    if (!same) diffs.push({ label, scrapedV, dbV, inputId });
  }
  if (!diffs.length) { wrap.classList.add("hidden"); return; }
  list.innerHTML = diffs.map((x, i) => `
    <div class="sugg">
      <div class="sugg-txt"><strong>${esc(x.label)}:</strong>
        <span class="sugg-cur">${esc(x.dbV ?? "—")}</span> →
        <span class="sugg-new">${esc(x.scrapedV)}</span></div>
      <button class="sugg-use" data-i="${i}">Use</button>
    </div>`).join("");
  wrap.classList.remove("hidden");
  list.querySelectorAll(".sugg-use").forEach((btn) => {
    btn.addEventListener("click", () => {
      const x = diffs[Number(btn.dataset.i)];
      $(x.inputId).value = String(x.scrapedV);
      btn.disabled = true;
      btn.textContent = "Used";
    });
  });
}

function setupForm(mode, row) {
  state.mode = mode;
  state.editingId = mode === "update" ? row.id : null;
  state.baseline = mode === "update" ? row : null;
  state.pendingDup = null;
  hideError($("formError"));
  $("dupChooser").classList.add("hidden");
  $("suggestions").classList.add("hidden");

  if (mode === "insert") {
    fillForm(recordFromScrape(state.scraped || {}));
    $("formTitle").textContent = "New property";
    $("btnSave").textContent = $("btnSaveBottom").textContent = "Add to survey";
  } else {
    fillForm(row);
    // Keep provenance: if this row predates the extension, stamp the CoStar id/url
    // into internal notes on the next save.
    if (state.scraped && state.scraped.costarId &&
        !(row.internal_notes || "").includes(`CoStar ID: ${state.scraped.costarId}`) &&
        state.screen !== "browse") {
      const seed = scrapeInternalNotes(state.scraped);
      if (seed) $("fInternalNotes").value = ((row.internal_notes || "") + "\n" + seed).trim();
    }
    $("formTitle").textContent = "Update property";
    $("btnSave").textContent = $("btnSaveBottom").textContent = "Save changes";
    if (state.scraped) renderSuggestions(row, state.scraped);
  }
  setBanner(mode, row);
  setTab("push");
  showScreen("form");
}

function matchAndShowForm() {
  const d = state.scraped;
  if (!d || !d.street) {
    // Scrape came back empty — show the form anyway so Max can type the address,
    // but flag it.
    setupForm("insert", null);
    showError($("formError"), "Couldn't read an address off the CoStar page — check the fields.");
    return;
  }
  // Diagnostic banner when the scrape found no address — shows what tab/text it read.
  if (!d.street) {
    const dbg = d._debug || {};
    const host = (() => { try { return new URL(d.scrapedTabUrl || "").host; } catch { return "?"; } })();
    setupForm("insert", null);
    showError($("formError"),
      `Read tab: ${host} · text length ${dbg.textLen || 0}. ` +
      `First chars: "${(dbg.sample || "").replace(/\s+/g, " ").slice(0, 160)}"`);
    return;
  }

  const m = findMatch(d);
  if (!m) return setupForm("insert", null);
  if (m.confidence === "confident") return setupForm("update", m.row);

  // Possible match — let Max decide.
  setupForm("insert", null);
  state.pendingDup = m.row;
  $("dupText").innerHTML =
    `Similar address already in this survey: <strong>${esc(m.row.address)}</strong>. Update it instead?`;
  $("dupChooser").classList.remove("hidden");
}

$("btnDupUpdate").addEventListener("click", () => {
  if (state.pendingDup) setupForm("update", state.pendingDup);
});
$("btnDupNew").addEventListener("click", () => {
  state.pendingDup = null;
  $("dupChooser").classList.add("hidden");
});

// ─── Save ──────────────────────────────────────────────────────────────────────

function sameVal(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  }
  const na = a === undefined || a === "" ? null : a;
  const nb = b === undefined || b === "" ? null : b;
  return na === nb;
}

async function save() {
  const rec = readForm();
  if (!rec.address) return showError($("formError"), "Address is required.");
  if (!rec.for_sale_or_lease.length) {
    return showError($("formError"), "Check For Sale and/or For Lease (required).");
  }
  hideError($("formError"));
  setLoading($("btnSave"), true);
  setLoading($("btnSaveBottom"), true);

  let res;
  if (state.mode === "insert") {
    res = await bg("INSERT_PROPERTY", { record: { ...rec, survey_id: state.survey.id } }, { write: true });
  } else {
    // PATCH only the fields that actually changed.
    const patch = {};
    for (const col of [...Object.keys(FIELDS), "for_sale_or_lease"]) {
      if (!sameVal(rec[col], state.baseline[col])) patch[col] = rec[col];
    }
    if (!Object.keys(patch).length) {
      setLoading($("btnSave"), false);
      setLoading($("btnSaveBottom"), false);
      toast("No changes to save.");
      return;
    }
    res = await bg("UPDATE_PROPERTY", { id: state.editingId, patch }, { write: true });
  }

  setLoading($("btnSave"), false);
  setLoading($("btnSaveBottom"), false);
  if (handleAuthFailure(res)) return;
  if (!res.ok) return showError($("formError"), res.error);

  const saved = res.property;
  const link = `${CONFIG.APP_URL}/surveys/${state.survey.id}`;
  toast(
    `${state.mode === "insert" ? "Added to" : "Updated in"} <strong>${esc(state.survey.name)}</strong> · ` +
    `<a href="${esc(link)}" target="_blank">open survey</a>`
  );

  // Keep local cache in sync and flip into update mode on the saved row.
  const idx = state.props.findIndex((p) => p.id === saved.id);
  if (idx >= 0) state.props[idx] = saved; else state.props.push(saved);
  updateContextBar();
  setupForm("update", saved);
}
$("btnSave").addEventListener("click", save);
$("btnSaveBottom").addEventListener("click", save);

// Attach the open CoStar flyer PDF → upload to survey-files → fill Flyer URL.
$("btnAttachFlyer").addEventListener("click", async () => {
  if (!state.survey) return showError($("formError"), "Pick a survey first.");
  const btn = $("btnAttachFlyer");
  hideError($("formError"));
  setLoading(btn, true);
  const res = await bg("ATTACH_FLYER", { surveyId: state.survey.id }, { write: true });
  setLoading(btn, false);
  if (handleAuthFailure(res)) return;
  if (!res.ok) return showError($("formError"), res.error);
  $("fFlyerUrl").value = res.url;
  toast(`Flyer attached: <strong>${esc(res.name)}</strong> — remember to Save`);
});

// ─── Survey browser ────────────────────────────────────────────────────────────

function availPillClass(v) {
  return "av-" + String(v || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

function renderBrowse() {
  $("browseTitle").textContent = state.survey ? state.survey.name : "Survey properties";
  const list = $("browseList");
  hideError($("browseError"));
  $("browseEmpty").classList.toggle("hidden", state.props.length > 0);

  list.innerHTML = state.props.map((p) => `
    <div class="prop-row" data-id="${esc(p.id)}">
      <div class="prop-top">
        <div class="prop-addr">${esc(p.address)}</div>
        <div class="prop-meta">${p.building_sf ? esc(Number(p.building_sf).toLocaleString()) + " SF" : ""}</div>
      </div>
      <div class="prop-bottom">
        <select class="avSel" data-id="${esc(p.id)}">
          <option value="">— availability —</option>
          ${AVAILABILITY_OPTIONS.map((o) =>
            `<option ${p.availability === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
        </select>
        ${p.internal_status ? `<span class="pill status">${esc(p.internal_status)}</span>` : ""}
        ${p.availability ? `<span class="pill ${availPillClass(p.availability)}">${esc(p.availability)}</span>` : ""}
      </div>
    </div>`).join("");

  // Row click → full edit form. Inline availability change → immediate PATCH.
  list.querySelectorAll(".prop-row").forEach((node) => {
    node.addEventListener("click", (e) => {
      if (e.target.classList.contains("avSel")) return;
      const p = state.props.find((x) => x.id === node.dataset.id);
      if (p) { state.scraped = null; setupForm("update", p); }
    });
  });
  list.querySelectorAll(".avSel").forEach((sel) => {
    sel.addEventListener("click", (e) => e.stopPropagation());
    sel.addEventListener("change", async () => {
      const id = sel.dataset.id;
      const res = await bg("UPDATE_PROPERTY", { id, patch: { availability: sel.value || null } }, { write: true });
      if (handleAuthFailure(res)) return;
      if (!res.ok) return showError($("browseError"), res.error);
      const idx = state.props.findIndex((p) => p.id === id);
      if (idx >= 0) state.props[idx] = res.property;
      renderBrowse();
      toast(`Availability updated: <strong>${esc(res.property.address)}</strong>`);
    });
  });
}

$("btnBrowseRefresh").addEventListener("click", async () => {
  await reloadProps();
  renderBrowse();
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMP MODE — push a CoStar listing into the master-app `comps` table.
// Parallel to the survey flow above; shares bg()/helpers but its own screen + state.
// ═══════════════════════════════════════════════════════════════════════════════

const comp = {
  scrape: null,       // last READ_COSTAR data object
  costarId: null,     // dedup stamp key for the current record
  sourceUrl: null,    // CoStar detail URL for the current record
  flyerUrl: null,     // uploaded flyer (survives until the record changes)
  flyerName: null,
  mode: "insert",     // 'insert' | 'update'
  updateId: null,     // comps.id being updated
  baseline: null,     // DB row backing the form in update mode (dirty-diff base)
  pendingMatch: null, // best dedup candidate awaiting the user's choice
  lastFilled: {},     // input id → last auto-filled value (protects user edits on re-scan)
};

const COMP_INPUT_IDS = [
  "comp_status", "comp_address", "comp_city", "comp_state", "comp_zip",
  "comp_sub_market", "comp_building_sf", "comp_land_area",
  "comp_sale_price", "comp_cap_rate", "comp_rent_psf",
  "comp_lease_format", "comp_listing_brokerage", "comp_listing_agent",
  "comp_listing_agent_phone", "comp_listing_agent_email", "comp_list_date", "comp_notes",
];

// Checked values of a .check-grid container (property types, sale deal types).
function compChecked(containerId) {
  const box = $(containerId);
  if (!box) return [];
  return Array.from(box.querySelectorAll("input[type=checkbox]:checked")).map((c) => c.value);
}
function compClearChecks(containerId) {
  const box = $(containerId);
  if (box) box.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = false; });
}

// "73040" → "73,040" for display; parseNum() strips the commas back out on save.
function fmtThousands(v) {
  const n = parseNum(v);
  return n == null ? "" : n.toLocaleString("en-US");
}

// Address normalizer ported from master-app src/lib/comp-extraction.ts (dedup score 80).
const COMP_STREET_TYPE_MAP = {
  st: "street", rd: "road", ave: "avenue", av: "avenue", blvd: "boulevard", dr: "drive",
  ln: "lane", pkwy: "parkway", hwy: "highway", ct: "court", cir: "circle", pl: "place",
  ter: "terrace", way: "way", n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};
function normalizeCompAddress(input) {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((tok) => COMP_STREET_TYPE_MAP[tok] ?? tok)
    .join(" ");
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// CoStar leaseType → comps `lease_format` (comps only has NNN / Gross / Modified Gross).
function mapLeaseFormat(leaseType) {
  switch (leaseType) {
    case "NNN": return "NNN";
    case "Modified Gross": return "Modified Gross";
    case "Full Service Gross": return "Gross";
    case "Industrial Gross": return "Gross";
    default: return "";
  }
}

function hasVal(v) { return v !== null && v !== undefined && String(v).trim() !== ""; }

function defaultCompStatus(d) {
  const sale = hasVal(d.salePrice);
  const lease = hasVal(d.leaseRate);
  if (sale && lease) return "FOR SALE/LEASE";
  if (sale) return "FOR SALE";
  if (lease) return "FOR LEASE";
  return "FOR SALE";
}

// ─── Mode toggle (survey ↔ comp) ─────────────────────────────────────────────────

function syncModeToggle() {
  const tg = $("modeToggle");
  if (!tg) return;
  tg.querySelectorAll("button[data-mode]").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === state.appMode));
}

function setAppMode(mode) {
  if (mode !== "comp" && mode !== "survey") return;
  state.appMode = mode;
  chrome.storage.local.set({ mode });
  syncModeToggle();
  if (!state.authed) return; // auth screens win; mode is applied after sign-in via onAuthed()
  if (mode === "comp") enterCompMode();
  else setTab(state.tab); // back to the survey flow's natural screen
}

// Show the comp screen and (re)scan the current CoStar record into the form.
function enterCompMode() {
  showScreen("comp");
  scanComp();
}

// ─── Field fill (never clobber a value the user edited) ──────────────────────────

function setCompField(id, value) {
  const node = $(id);
  if (!node) return;
  const v = value == null ? "" : String(value);
  const prev = comp.lastFilled[id] ?? "";
  const cur = node.value;
  if (cur !== "" && cur !== prev) return;      // user edited this field — leave it
  if (v === "" && cur !== "") return;          // don't wipe a prior auto-value with an empty scrape
  node.value = v;
  comp.lastFilled[id] = v;
}

function resetCompForm() {
  comp.lastFilled = {};
  comp.mode = "insert";
  comp.updateId = null;
  comp.baseline = null;
  comp.flyerUrl = null;
  comp.flyerName = null;
  comp.pendingMatch = null;
  hideCompMatch();
  COMP_INPUT_IDS.forEach((id) => { const n = $(id); if (n) n.value = ""; });
  compClearChecks("comp_ptypes");
  compClearChecks("comp_sale_types");
}

async function fillCompForm(d) {
  d = d || {};
  // Navigating to a genuinely different CoStar record → clear the form and update state.
  const newKey = d.costarId || normalizeCompAddress(d.street || "");
  const oldKey = comp.costarId || normalizeCompAddress((comp.scrape && comp.scrape.street) || "");
  if (comp.scrape && newKey && newKey !== oldKey) resetCompForm();

  comp.scrape = d;
  comp.costarId = d.costarId || null;
  comp.sourceUrl = d.sourceUrl || null;

  setCompField("comp_address", d.street);
  setCompField("comp_city", d.city);
  setCompField("comp_state", d.state || "AZ");
  setCompField("comp_zip", d.zip);
  setCompField("comp_sub_market", d.submarket);
  setCompField("comp_building_sf", fmtThousands(d.rba));
  setCompField("comp_land_area", d.acLot);
  setCompField("comp_sale_price", fmtThousands(d.salePrice));
  setCompField("comp_cap_rate", d.capRate);
  setCompField("comp_rent_psf", d.leaseRate); // already $/SF/month for Phoenix industrial
  setCompField("comp_lease_format", mapLeaseFormat(d.leaseType));
  setCompField("comp_status", defaultCompStatus(d));
  setCompField("comp_list_date", todayISO());

  // Notes stay blank — Max adds his own. (Dedup relies on address matching and the
  // CoStar-ID stamps that older comps carry in notes; new comps aren't stamped.)

  syncCompFieldVisibility();
  await runCompDedup(d);
}

// Show only the economics that match the status: FOR SALE hides the lease fields,
// FOR LEASE hides the sale fields; FOR SALE/LEASE and PENDING show both.
function compStatusShows() {
  const status = ($("comp_status") && $("comp_status").value) || "FOR SALE";
  const showSale = status !== "FOR LEASE";
  const showLease = status === "FOR LEASE" || status === "FOR SALE/LEASE" || status === "PENDING";
  return { status, showSale, showLease };
}

function syncCompFieldVisibility() {
  const { showSale, showLease } = compStatusShows();
  const toggle = (id, show) => {
    const el = $(id);
    if (!el) return;
    const wrap = el.closest(".fld") || el;
    wrap.classList.toggle("hidden", !show);
  };
  toggle("comp_sale_price", showSale);
  toggle("comp_cap_rate", showSale);
  toggle("comp_rent_psf", showLease);
  toggle("comp_lease_format", showLease);
  const saleTypes = $("comp_sale_types_wrap");
  if (saleTypes) saleTypes.classList.toggle("hidden", !showSale);
}

// ─── Scrape ──────────────────────────────────────────────────────────────────────

async function scanComp(opts = {}) {
  setCompMsg("Reading CoStar…");
  // As in the survey flow: CoStar's SPA updates the URL before the content re-renders,
  // so on a record change we retry until the street is non-empty and has actually changed.
  const awaitChange = opts.awaitChangeFromStreet || null;
  let d = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await bg("READ_COSTAR");
    if (!res || !res.ok) { setCompMsg((res && res.error) || "Couldn't read the CoStar page.", true); return; }
    d = res.data || {};
    if (!awaitChange) break;
    if (d.street && d.street !== awaitChange) break;
    await sleep(300);
  }
  await fillCompForm(d);
  if (!($("comp_address") && $("comp_address").value.trim())) {
    setCompMsg("Couldn't read an address off the CoStar page — check the fields.", true);
  } else {
    setCompMsg("");
  }
}

// ─── Dedup (client-side scoring against SEARCH_COMPS candidates) ──────────────────

async function runCompDedup(d) {
  hideCompMatch();
  const street = d.street || "";
  const streetNumber = (street.match(/^\s*(\d+)/) || ["", ""])[1];
  const afterNum = street.replace(/^\s*\d+[\s-]*/, "");
  const streetToken = (afterNum.match(/[A-Za-z0-9]+/) || [""])[0];
  if (!streetNumber && !streetToken && !d.costarId) return;

  const res = await bg("SEARCH_COMPS", { streetNumber, streetToken, costarId: d.costarId || null });
  if (!res || !res.ok) return;
  const target = normalizeCompAddress(street);
  const token = streetToken.toLowerCase();

  let best = null, bestScore = 0;
  for (const c of (res.comps || [])) {
    const addrNorm = normalizeCompAddress(c.address);
    let score = 0;
    if (d.costarId && (c.notes || "").includes(`CoStar ID: ${d.costarId}`)) score = 100;
    else if (target && addrNorm === target) score = 80;
    else if (streetNumber && token && addrNorm.startsWith(streetNumber) && addrNorm.includes(token)) score = 55;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best && bestScore >= 55) showCompMatch(best);
  else comp.pendingMatch = null;
}

function showCompMatch(candidate) {
  comp.pendingMatch = candidate;
  const banner = $("compMatch");
  if (!banner) return;
  banner.innerHTML =
    `<span class="comp-match-txt">Looks like an existing comp: ` +
    `<strong>${esc(candidate.address)}</strong> (${esc(candidate.status || "")})</span>` +
    `<span class="comp-match-actions">` +
    `<button type="button" id="compMatchUpdate">Update existing</button>` +
    `<button type="button" id="compMatchNew">Create new anyway</button>` +
    `</span>`;
  banner.classList.remove("hidden");
  const upd = $("compMatchUpdate"), neu = $("compMatchNew");
  if (upd) upd.addEventListener("click", () => enterCompUpdate(candidate));
  if (neu) neu.addEventListener("click", () => {
    comp.mode = "insert";
    comp.updateId = null;
    comp.baseline = null;
    hideCompMatch();
  });
}

function hideCompMatch() {
  const b = $("compMatch");
  if (b) { b.classList.add("hidden"); b.innerHTML = ""; }
}

function enterCompUpdate(candidate) {
  comp.mode = "update";
  comp.updateId = candidate.id;
  comp.baseline = candidate;
  hideCompMatch();
  setCompMsg(`Updating existing comp: ${candidate.address}`);
}

// ─── Save ──────────────────────────────────────────────────────────────────────

function setCompMsg(msg, isErr = false) {
  const n = $("compMsg");
  if (!n) return;
  n.textContent = msg || "";
  n.classList.toggle("err", !!isErr);
  n.classList.toggle("hidden", !msg);
}

function compFormRecord() {
  const num = (id) => { const n = $(id); return n ? parseNum(n.value) : null; };
  const txt = (id) => { const n = $(id); return n ? (n.value.trim() || null) : null; };
  const buildingSf = num("comp_building_sf");
  const { status, showSale, showLease } = compStatusShows();
  // Hidden economics never get pushed (e.g. a scraped rent on a FOR SALE save).
  const salePrice = showSale ? num("comp_sale_price") : null;
  const rec = {
    address: ($("comp_address") && $("comp_address").value.trim()) || "",
    city: txt("comp_city"),
    state: txt("comp_state") || "AZ",
    zip: txt("comp_zip"),
    sub_market: txt("comp_sub_market"),
    // Cluster is derived, never typed: recomputed from whatever submarket is on the form.
    submarket_cluster: (typeof SUBMARKET_TO_CLUSTER !== "undefined" &&
      SUBMARKET_TO_CLUSTER[(txt("comp_sub_market") || "")]) || null,
    property_type: compChecked("comp_ptypes").join(", ") || null,
    building_sf: buildingSf,
    land_area: num("comp_land_area"),
    sale_price: salePrice,
    price_psf: (salePrice != null && buildingSf) ? Math.round((salePrice / buildingSf) * 100) / 100 : null,
    cap_rate: showSale ? num("comp_cap_rate") : null,
    sale_type: showSale ? (compChecked("comp_sale_types").join(", ") || null) : null,
    rent_psf: showLease ? num("comp_rent_psf") : null,
    lease_format: showLease ? (($("comp_lease_format") && $("comp_lease_format").value) || null) : null,
    status,
    type: status === "FOR LEASE" ? "lease" : "sale",
    internal_deal: false,
    source: "costar",
    listing_brokerage: txt("comp_listing_brokerage"),
    listing_agent: txt("comp_listing_agent"),
    listing_agent_phone: txt("comp_listing_agent_phone"),
    listing_agent_email: txt("comp_listing_agent_email"),
    list_date: txt("comp_list_date"),
    notes: txt("comp_notes"),
    last_verified_at: new Date().toISOString(),
  };
  if (comp.flyerUrl) rec.flyer_url = comp.flyerUrl;
  return rec;
}

// Update PATCH: only non-empty form values that differ from the DB row, never a blank-out.
// Always re-verify (last_verified_at); include flyer_url only if newly attached.
function compUpdatePatch(rec) {
  const base = comp.baseline || {};
  const skip = new Set(["last_verified_at", "flyer_url", "internal_deal", "source"]);
  const patch = {};
  for (const [k, v] of Object.entries(rec)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === "") continue; // never blank out a DB value
    if (String(base[k] ?? "") !== String(v)) patch[k] = v;
  }
  patch.last_verified_at = rec.last_verified_at;
  if (comp.flyerUrl) patch.flyer_url = comp.flyerUrl;
  return patch;
}

async function saveComp() {
  const rec = compFormRecord();
  if (!rec.address) return setCompMsg("Address is required.", true);
  setCompMsg("");
  setLoading($("compSave"), true);

  let res;
  if (comp.mode === "update" && comp.updateId) {
    res = await bg("UPDATE_COMP", { id: comp.updateId, patch: compUpdatePatch(rec) }, { write: true });
  } else {
    res = await bg("INSERT_COMP", { record: rec }, { write: true });
  }

  setLoading($("compSave"), false);
  if (handleAuthFailure(res)) return;
  if (!res || !res.ok) return setCompMsg((res && res.error) || "Save failed.", true);

  const savedId = (res.comp && res.comp.id) || (comp.mode === "update" ? comp.updateId : null);
  const label = comp.mode === "update" ? "Comp updated ✓ (re-verified today)" : "Comp saved ✓";
  setCompMsg(label);
  // Append a "View comp" link that opens the saved record in the app.
  if (savedId) {
    const n = $("compMsg");
    if (n) {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = "View comp →";
      a.style.marginLeft = "8px";
      a.style.fontWeight = "600";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${CONFIG.APP_URL}/comps/${savedId}` });
      });
      n.appendChild(a);
    }
  }
  // Clear update state either way (contract: a fresh insert leaves nothing pending).
  comp.mode = "insert";
  comp.updateId = null;
  comp.baseline = null;
}

// ─── Comp-mode wiring (guarded — panel.html owns these elements) ──────────────────

function initCompMode() {
  const tg = $("modeToggle");
  if (tg) {
    tg.querySelectorAll("button[data-mode]").forEach((b) =>
      b.addEventListener("click", () => setAppMode(b.dataset.mode)));
  }
  const save = $("compSave"); if (save) save.addEventListener("click", saveComp);
  const rescan = $("compRescan"); if (rescan) rescan.addEventListener("click", () => scanComp());
  const statusSel = $("comp_status");
  if (statusSel) statusSel.addEventListener("change", syncCompFieldVisibility);
  // Keep big numbers readable: re-format with thousands separators when typing ends.
  ["comp_building_sf", "comp_sale_price"].forEach((id) => {
    const n = $(id);
    if (n) n.addEventListener("blur", () => { if (n.value.trim()) n.value = fmtThousands(n.value); });
  });
  const flyer = $("compFlyer");
  if (flyer) flyer.addEventListener("click", async () => {
    setLoading(flyer, true);
    const res = await bg("ATTACH_COMP_FLYER", {}, { write: true });
    setLoading(flyer, false);
    if (handleAuthFailure(res)) return;
    if (!res || !res.ok) return setCompMsg((res && res.error) || "Flyer attach failed.", true);
    comp.flyerUrl = res.url;
    comp.flyerName = res.name;
    setCompMsg(`Flyer attached: ${res.name}`);
  });
}

// ─── Comp-mode SPA auto-re-scan (parallel to maybeReReadOnNav) ────────────────────

let lastCompNavKey = null;
let compNavBusy = false;
async function maybeReScanCompOnNav() {
  if (state.appMode !== "comp" || !state.authed) return;
  if (state.screen !== "comp") return;
  if (compNavBusy) return;
  let tab;
  try { tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; }
  catch { return; }
  const key = costarRecordKey(tab && tab.url);
  if (!key) return;
  if (comp.sourceUrl && key === costarRecordKey(comp.sourceUrl)) return;
  if (key === lastCompNavKey) return;
  lastCompNavKey = key;
  compNavBusy = true;
  const fromStreet = (comp.scrape && comp.scrape.street) || null;
  try { await scanComp({ awaitChangeFromStreet: fromStreet }); } finally { compNavBusy = false; }
}
chrome.tabs.onUpdated.addListener((_id, changeInfo) => { if (changeInfo.url) maybeReScanCompOnNav(); });
chrome.tabs.onActivated.addListener(() => maybeReScanCompOnNav());
setInterval(maybeReScanCompOnNav, 1000);

// ─── Go ────────────────────────────────────────────────────────────────────────

init();
