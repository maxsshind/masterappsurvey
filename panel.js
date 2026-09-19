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
const IS_EXTENSION_CONTEXT =
  typeof chrome !== "undefined" && Boolean(chrome.runtime && chrome.runtime.id);

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
  accountId: null,
  survey: null,      // { id, name, client_name, survey_type }
  propsLookupOk: false,
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

// A CoStar scrape reads the whole page's text — firing a second one while the first
// is still running piles CPU onto the CoStar tab, so concurrent reads share one promise.
let pendingRead = null;
let activeMessages = 0;
function bg(type, extra = {}, opts = {}, attempt = 0) {
  if (type === "READ_COSTAR" && attempt === 0) {
    if (pendingRead) return pendingRead;
    pendingRead = bgSend(type, extra, opts, 0);
    pendingRead.finally(() => { pendingRead = null; });
    return pendingRead;
  }
  return bgSend(type, extra, opts, attempt);
}

function bgSend(type, extra = {}, opts = {}, attempt = 0) {
  const isWrite = opts.write === true;
  return new Promise((resolve) => {
    activeMessages++;
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; activeMessages--; resolve(v); } };
    const timeoutMs = isWrite ? 60000 : (attempt === 0 ? 2000 : 3000);
    const timeoutId = setTimeout(async () => {
      if (settled) return;
      if (!isWrite && attempt < 1) finish(await bgSend(type, extra, opts, attempt + 1));
      else finish({ ok: false, error: "Background script not responding. Click the extension icon again." });
    }, timeoutMs);
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (resp) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          if (!isWrite && attempt < 2) setTimeout(async () => finish(await bgSend(type, extra, opts, attempt + 1)), 50);
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
  // Apply the user's saved layout prefs (order/hide/collapse/density) to form screens.
  if (name === "form") window.Layout?.apply("survey");
  if (isComp) window.Layout?.apply("comp");
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
  for (const id of Object.keys(SURVEY_CHOICE_OPTIONS)) surveyChoice(id, null);

  const storedMode = await chrome.storage.local.get(["mode"]);
  state.appMode = storedMode.mode === "comp" ? "comp" : "survey";
  initCompMode();
  syncModeToggle();

  const status = await bg("AUTH_STATUS");
  if (status.ok && status.connected) {
    state.authed = true;
    state.email = status.email;
    state.accountId = status.accountId;
    await loadPopoutHandoff();
    await onAuthed();
  } else {
    const stored = await chrome.storage.local.get(["last_email"]);
    $("authEmail").value = stored.last_email || "max@rgcre.com";
    showScreen("auth-email");
  }
  await finishPopoutHandoff();
}

async function onAuthed() {
  const auth = await bg("AUTH_STATUS");
  if (auth.ok && auth.connected) {
    if (state.accountId && state.accountId !== auth.accountId) {
      surveyEditor.bundle = null; surveyEditor.archives = {}; surveyEditor.buildingFlyers = {}; observedSurveySource = null; surveyEditor.pending = null;
      state.survey = null; state.props = []; state.mode = null; state.scraped = null;
    }
    state.accountId = auth.accountId; state.email = auth.email;
  }
  syncModeToggle();
  if (popoutHandoff && (popoutHandoff.accountId !== state.accountId || popoutHandoff.email !== state.email)) throw new Error("The signed-in account changed. Keep using the original panel.");
  await restorePendingCompSave();
  if (popoutHandoff) restorePopoutComp();
  // Restore last-used survey (verify it still exists), else prompt to pick.
  const stored = popoutHandoff ? { last_survey_id: popoutHandoff.surveyId } : await chrome.storage.local.get(["last_survey_id"]);
  if (stored.last_survey_id) {
    const res = await bg("GET_SURVEY", { id: stored.last_survey_id });
    if (handleAuthFailure(res)) return;
    if (res.ok && res.survey) {
      await selectSurvey(res.survey, { silent: true });
      if (popoutHandoff) {
        state.scraped = popoutHandoff.scraped;
        if (state.appMode === "comp") showScreen("comp");
        else setTab(popoutHandoff.tab);
        return;
      }
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
  if (state.appMode === "comp") { if (popoutHandoff) showScreen("comp"); else enterCompMode(); return; }
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

const IS_POPOUT = new URLSearchParams(location.search).get("view") === "popout";
const popoutToken = new URLSearchParams(location.search).get("handoff");
const popoutKey = popoutToken ? "panel_handoff:" + popoutToken : null;
let popoutHandoff = null;
let poppingOut = false;
if (IS_POPOUT) {
  document.body.classList.add("popout");
  $("btnPopout").classList.add("hidden");
  $("popoutLabel").classList.remove("hidden");
  document.title = "CoStar → Survey Pusher · Pop-out";
}

// A short-lived, account-scoped handoff in browser memory preserves raw Comp
// edits as well as the Survey draft already saved on this device. Never copy auth.
async function loadPopoutHandoff() {
  if (!popoutKey) return;
  const saved = (await chrome.storage.session.get(popoutKey))[popoutKey];
  if (!saved || saved.status !== "opening") return;
  if (Date.now() - saved.createdAt > 60000 || saved.accountId !== state.accountId || saved.email !== state.email) {
    throw new Error("The form belongs to a different or expired session. Keep using the original panel.");
  }
  popoutHandoff = saved;
  state.appMode = saved.appMode;
}

function restorePopoutComp() {
  // Durable pending-save recovery takes precedence over an ordinary form copy.
  if (comp.pendingSave) return;
  Object.assign(comp, popoutHandoff.comp);
  comp.propertyFieldsEdited ||= {};
  if (comp.propertyFieldsEdited.clear_height_ft) comp.propertyFieldsEdited.clear_height = true;
  for (const field of popoutHandoff.compControls) {
    const node = $(field.id === 'comp_clear_height_ft' ? 'comp_clear_height' : field.id); if (!node) continue;
    node.value = field.value; node.checked = field.checked;
  }
  for (const [container, values] of Object.entries(popoutHandoff.compChecks)) {
    const choices = container === 'comp_ptypes' ? CompPropertyFields.normalizePropertyTypes(values) : values;
    $(container).querySelectorAll("input").forEach(node => { node.checked = choices.includes(node.value); });
  }
  syncCompFeatureChecks();
  renderCompContentImport();
  syncCompFieldVisibility();
  syncNameToggle("toggleCompPropName", "fldCompPropertyName", "comp_property_name", "comp_address");
  if (comp.pendingMatch) showCompMatch(comp.pendingMatch);
  if (comp.flyerUrl) $("compFlyerState").textContent = comp.flyerName || "Flyer attached";
  for (const [id, source] of Object.entries(popoutHandoff.compSources)) setCompFieldSource(id, source);
  if (comp.unmappedSubmarket) setCompSubmarket(comp.unmappedSubmarket);
  syncCompReviewState();
}

async function finishPopoutHandoff() {
  if (!popoutKey) return;
  const saved = (await chrome.storage.session.get(popoutKey))[popoutKey];
  if (!saved || saved.status !== "opening") return;
  if (saved.accountId && (!state.authed || saved.accountId !== state.accountId || saved.surveyId !== (state.survey?.id || null) || (saved.bundleKey && saved.bundleKey !== surveyEditor.bundle?.key))) {
    throw new Error("The form could not be restored. Keep using the original panel.");
  }
  await chrome.storage.session.set({ [popoutKey]: { status: "ready" } });
  history.replaceState(null, "", "panel.html?view=popout");
  window.scrollTo(0, saved.scrollY || 0);
  popoutHandoff = null;
}

$("btnPopout").addEventListener("click", async () => {
  if (!IS_EXTENSION_CONTEXT || poppingOut) return;
  if (surveyEditor.saving || comp.saving || activeMessages || pendingRead || navBusy || compNavBusy || document.querySelector(".loading")) {
    toast("Finish the current read, upload or save, then pop out."); return;
  }
  poppingOut = true;
  $("btnPopout").disabled = true;
  let key = null, opened = null, transferred = false;
  try {
    const panelUrl = chrome.runtime.getURL("panel.html");
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["popup"] });
    const existing = windows.find(win => win.tabs?.some(tab => tab.url?.split("?")[0] === panelUrl));
    if (existing) {
      await chrome.windows.update(existing.id, { focused: true });
      toast("Your pop-out is already open. This panel's edits are still here.");
      return;
    }
    // Keep one editor during handoff; the source closes only after restoration.
    document.body.inert = true;
    await persistSurveyDraft();
    await chrome.storage.local.set({ mode: state.appMode, ...(state.survey ? { last_survey_id: state.survey.id } : {}) });
    key = "panel_handoff:" + crypto.randomUUID();
    const handoff = {
      status: "opening", createdAt: Date.now(), accountId: state.accountId, email: state.email,
      appMode: state.appMode, surveyId: state.survey?.id || null, tab: state.tab,
      bundleKey: surveyEditor.bundle?.key || null,
      scraped: state.scraped, scrollY: window.scrollY, comp: structuredClone(comp),
      compControls: [...document.querySelectorAll("#screen-comp input[id], #screen-comp select[id], #screen-comp textarea[id]")].map(node => ({ id: node.id, value: node.value, checked: node.checked })),
      compChecks: { comp_ptypes: compChecked("comp_ptypes"), comp_sale_types: compChecked("comp_sale_types") },
      compSources: Object.fromEntries(COMP_INPUT_IDS.map(id => [id, $(id)?.closest(".fld")?.querySelector(".field-source")?.textContent || null])),
    };
    await chrome.storage.session.set({ [key]: handoff });
    opened = await chrome.windows.create({ url: panelUrl + "?view=popout&handoff=" + key.split(":")[1], type: "popup", width: Math.min(720, screen.availWidth), height: Math.min(900, screen.availHeight) });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const result = (await chrome.storage.session.get(key))[key];
      if (result?.status === "ready") {
        await chrome.storage.session.remove(key); key = null;
        transferred = true;
        toast("Form moved to the pop-out window. You can close this panel.");
        window.close(); return;
      }
      if (result?.status === "error") throw new Error(result.error);
      await sleep(100);
    }
    throw new Error("The new window did not finish opening. Your form is still here; try again.");
  } catch (error) {
    if (opened?.id) { try { await chrome.windows.remove(opened.id); } catch {} }
    toast("Could not pop out: " + esc(error.message), true);
  } finally {
    if (key) { try { await chrome.storage.session.remove(key); } catch {} }
    document.body.inert = transferred;
    poppingOut = false;
    $("btnPopout").disabled = false;
  }
});

$("btnSettings").addEventListener("click", async () => {
  const status = await bg("AUTH_STATUS");
  $("authStatusLabel").textContent = status.connected ? `Signed in · ${status.email || ""}` : "Not signed in";
  showScreen("settings");
});
$("btnBack").addEventListener("click", () => setTab(state.tab));
$("btnDisconnect").addEventListener("click", async () => {
  if (surveyEditor.saving) return;
  try { await persistSurveyDraft(); } catch { return; }
  await bg("AUTH_SIGN_OUT");
  surveyEditor.bundle = null; surveyEditor.archives = {}; surveyEditor.buildingFlyers = {}; observedSurveySource = null; surveyEditor.pending = null;
  state.accountId = null;
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
  if (surveyEditor.saving || surveyEditor.checkingSource) return;
  const generation = ++surveyEditor.selectionGeneration;
  try { await persistSurveyDraft(); } catch { return; }
  if (generation !== surveyEditor.selectionGeneration) return;
  surveyEditor.bundle = null; surveyEditor.archives = {}; surveyEditor.buildingFlyers = {}; observedSurveySource = null; surveyEditor.pending = null;
  state.survey = survey;
  state.props = []; state.propsLookupOk = false;
  state.mode = null;
  showScreen("idle");
  state.editingId = null;
  chrome.storage.local.set({ last_survey_id: survey.id });
  const loaded = await reloadProps();
  if (!loaded) return;
  if (generation !== surveyEditor.selectionGeneration) return;
  await restoreSurveyWorkspace();
  if (generation !== surveyEditor.selectionGeneration) return;
  updateContextBar();
  if (surveyEditor.bundle) return;
  if (!opts.silent) {
    // Re-evaluate the current scrape against the new survey, or land on Push.
    if (state.scraped && state.scraped.street) matchAndShowForm();
    else setTab("push");
  }
}

async function reloadProps() {
  if (!state.survey) return;
  const surveyId = state.survey.id, accountId = state.accountId;
  const res = await bg("LIST_SURVEY_PROPERTIES", { surveyId });
  if (state.survey?.id !== surveyId || state.accountId !== accountId) return false;
  if (handleAuthFailure(res)) return;
  if (!res.ok) { state.propsLookupOk = false; const message = res.error || "Survey lookup failed. Retry before saving."; showError($("formError"),message); showError($("idleError"),message); return false; }
  state.props = res.properties || []; state.propsLookupOk = true;
  updateContextBar();
  return true;
}

// ─── Read CoStar ───────────────────────────────────────────────────────────────

let surveyReadGeneration = 0;
let surveyReadsInFlight = 0;
let observedSurveySource = null;
function surveyObservation(d) {
  return JSON.stringify([d?.sourceTabId, surveySourceKey(d), d?.selectedSpace?.rawText || '', d?.street]);
}
function sourceOrdinal(source) {
  if (source?.selectedSpace?.ordinal) return source.selectedSpace.ordinal;
  try { const parts = JSON.parse(source?.selectedSpace?.identity); return Array.isArray(parts) ? parts[0] : null; } catch { return null; }
}
function pendingSpaceTransition(data, previousSource) {
  const before = previousSource?.selectedSpace, next = data?.selectedSpace;
  if (!before || !next || data.costarId !== previousSource.costarId) return false;
  const from = sourceOrdinal(previousSource), to = sourceOrdinal(data);
  return from && to && from !== to && ['suite','floor','availableSf','availableRange'].every(k => sameVal(before[k],next[k]));
}
async function stableSurveyRead(tabId, previousSource = null) {
  let previous = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await bg('READ_COSTAR', {tabId, survey:true});
    if (!res.ok) throw new Error(res.error || 'Could not read CoStar.');
    const data = res.data || {}, key = surveyObservation(data);
    if (data.selectedSpace && !data.selectedSpace.identity) throw new Error('Open one unambiguous CoStar Space Details view, then refresh.');
    const changedPropertyWithOldBody = previousSource?.costarId && data.costarId !== previousSource.costarId && data.street === previousSource.street;
    if (data.street && key === previous && !changedPropertyWithOldBody && !pendingSpaceTransition(data,previousSource)) return data;
    previous = key;
    await sleep(400);
  }
  throw new Error('CoStar is still changing. Wait for the space details to finish loading, then refresh.');
}
async function doRead(opts = {}) {
  if (surveyEditor.saving || surveyEditor.pending || surveyEditor.checkingSource) return mountSurveyDraft();
  if (!state.survey) return openPicker();
  const generation = ++surveyReadGeneration, scope = surveyDraftKey(), originalBundle = surveyEditor.bundle;
  if (!opts.automatic) setTab('push');
  const intendedView = [state.appMode,state.tab,state.screen].join(':');
  const valid = () => generation === surveyReadGeneration && scope === surveyDraftKey() && surveyEditor.bundle === originalBundle && !surveyEditor.saving && !surveyEditor.pending && intendedView === [state.appMode,state.tab,state.screen].join(':');
  surveyReadsInFlight++;
  try {
    const d = await stableSurveyRead(activeSurveyDraft()?.source?.sourceTabId ?? state.scraped?.sourceTabId, activeSurveyDraft()?.source ?? state.scraped);
    if (!valid()) return;
    const observation = surveyObservation(d);
    if (opts.automatic && observation === observedSurveySource) return;
    // Persist the latest keystrokes before changing the visible source. Old drafts
    // remain accessible, including explicit clears and manually added siblings.
    await persistSurveyDraft();
    if (!valid()) return;
    const loaded = await reloadProps();
    if (!loaded || !valid()) return;
    state.scraped = d;
    observedSurveySource = observation;
    hideError($('idleError')); hideError($('formError'));
    matchAndShowForm();
  } catch (error) {
    if (valid() && !opts.automatic) showError($(activeSurveyDraft() ? 'formError' : 'idleError'), error.message);
  } finally { surveyReadsInFlight--; }
}

$("btnRead").addEventListener("click", () => doRead());

// ─── Detect changes to the visible CoStar property or space ──────────────────────────────────
// The side panel stays open across navigation; CoStar is a SPA so tab events fire
// unreliably and space arrows do not change the URL. The shared poll reads the
// visible space while Survey Push is open, including a pinned pop-out source.

function costarRecordKey(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("costar.com")) return null;
    const listing = u.pathname.match(/^\/listings\/(for-sale|for-lease)\/detail\/([^/]+)/);
    if (listing) return `listing:${listing[1]}:${listing[2]}`;
    if (!u.pathname.includes("/detail/")) return null;
    const num = u.pathname.match(/\/(\d{4,})(?:\/|$)/);
    if (num) return num[1];
    return u.pathname.replace(/\/[^/]*$/, "");
  } catch { return null; }
}

let navBusy = false;
async function maybeReReadOnNav() {
  if (poppingOut || document.body.inert) return;
  if (navBusy) return;
  if (!state.authed || !state.survey || state.appMode !== 'survey') return;
  // Don't yank the UI while Max is picking a survey, in settings, signing in,
  // or working the Survey tab.
  if (state.tab !== "push") return;
  if (!["form", "idle"].includes(state.screen)) return;
  if (surveyEditor.saving || surveyEditor.pending || surveyEditor.checkingSource) return;
  let tab;
  try { tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]; }
  catch { return; }
  if (!costarRecordKey(tab?.url) && !(IS_POPOUT && activeSurveyDraft()?.source?.sourceTabId != null)) return;
  navBusy = true;
  try { await doRead({automatic:true}); } finally { navBusy = false; }
}
if (IS_EXTENSION_CONTEXT) {
  chrome.tabs.onUpdated.addListener((_id, changeInfo) => { if (changeInfo.url) maybeReReadOnNav(); });
  chrome.tabs.onActivated.addListener(() => maybeReReadOnNav());
}

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
  notes_2: ["fNotes2", "text"],
  internal_notes: ["fInternalNotes", "text"],
  internal_status: ["fInternalStatus", "text"],
};

function parseNum(v) {
  const n = parseFloat(String(v || "").replace(/[$,%\s]/g, "").replace(/\/?sf$/i, ""));
  return isNaN(n) ? null : n;
}

// ─── "+ Name" expander (Property Name, both forms) ─────────────────────────────
// Collapsed by default; auto-opens when the saved name differs from the address.

function setNameToggle(toggleId, rowId, open) {
  $(rowId).classList.toggle("hidden", !open);
  $(toggleId).textContent = open ? "– Name" : "+ Name";
}
function syncNameToggle(toggleId, rowId, inputId, addressId) {
  const v = $(inputId).value.trim();
  setNameToggle(toggleId, rowId, !!v && v !== $(addressId).value.trim());
}
[["toggleCompPropName", "fldCompPropertyName"]]
  .forEach(([toggleId, rowId]) => {
    $(toggleId).addEventListener("click", () =>
      setNameToggle(toggleId, rowId, $(rowId).classList.contains("hidden")));
  });

function updateBlockVisibility() {
  $("saleBlock").classList.toggle("hidden", !$("fForSale").checked);
  $("leaseBlock").classList.toggle("hidden", !$("fForLease").checked);
  // Tenancy-aware size fields on pure lease surveys:
  // ST hides suite fields; MT makes Building SF optional and shows suite fields.
  // Hidden inputs keep their values — toggling never wipes data.
  const surveyType = state.survey ? state.survey.survey_type : null;
  const leaseOnly = surveyType !== "sale";
  const tenancy = $("fTenancy").value;
  const isST = leaseOnly && tenancy === "ST";
  const isMT = leaseOnly && tenancy === "MT";
  $("rowSuiteNumber").classList.toggle("hidden", isST);
  $("rowOfficeSf").classList.remove("hidden");
  $("rowSuiteSize").classList.toggle("hidden", isST && !activeSurveyDraft()?.model.values.space_option);
  if (activeSurveyDraft()) renderSpaceOption();
  $("lblBuildingSf").textContent = isMT ? "Total Building SF (reference)" : "Total Building SF";
}
$("fForSale").addEventListener("change", updateBlockVisibility);
$("fForLease").addEventListener("change", updateBlockVisibility);
$("fTenancy").addEventListener("change", updateBlockVisibility);

function scrapeInternalNotes(d) {
  const parts = [];
  if (d.costarId) parts.push(`CoStar ID: ${d.costarId}`);
  if (d.sourceUrl) parts.push(`CoStar: ${d.sourceUrl}`);
  if (d.submarket) parts.push(`Submarket: ${d.submarket}`);
  const quote = d.selectedSpace ? (d.selectedSpace.rawText || d.selectedSpace.issue) : d.leaseQuote?.rawText || d.leaseQuoteRaw || d.leaseRate;
  if (quote) parts.push(`CoStar rent quote (review period and basis): ${String(quote).slice(0,400)}`);
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
    building_sf: d.rba || null,
    land_area_ac: d.acLot || null,
    sale_price: d.salePrice || null,
    cap_rate: d.capRate || null,
    tenancy: d.street ? null : "ST",
    lease_rate_psf: null,
    lease_type: surveySpaceLeaseType(d.selectedSpace?.serviceType) || d.leaseType || null,
    suite_size: SurveySpaces.sourceRange(d.selectedSpace) ? SurveySpaces.rangeLabel(SurveySpaces.sourceRange(d.selectedSpace)) : d.selectedSpace?.availableSf || null,
    ...(SurveySpaces.sourceRange(d.selectedSpace) ? { space_option: SurveySpaces.sourceRange(d.selectedSpace) } : {}),
    suite_number: d.selectedSpace?.suite || null,
    office_sf: d.selectedSpace?.availableRange ? null : d.selectedSpace?.officeSf ?? null,
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
    b.classList.add("new", "hidden");
    b.textContent = "New to this survey";
  } else {
    b.classList.add("update");
    b.textContent = `Updating ${row.address}${row.suite_number ? " · " + row.suite_number : ""}`;
  }
}

// Suggestions: fields where the fresh scrape differs from the DB row (update mode).
function renderSuggestions(row, d) {
  const wrap = $("suggestions");
  const list = $("suggList");
  const diffs = [];
  const cmp = [
    ["address", "Address", d.street, row.address, "fAddress"],
    ["building_sf", "Building SF", d.rba, row.building_sf, "fBuildingSf"],
    ["land_area_ac", "Land AC", d.acLot, row.land_area_ac, "fLandAc"],
  ];
  for (const [col, label, scrapedV, dbV, inputId] of cmp) {
    if (scrapedV === null || scrapedV === undefined || scrapedV === "") continue;
    if (col !== "address" && !SurveyFields.parseNumericInput(scrapedV,SurveyFields.SURVEY_NUMERIC_OPTIONS[col]).valid) continue;
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
      $(x.inputId).dispatchEvent(new Event("input", { bubbles: true }));
      btn.disabled = true;
      btn.textContent = "Used";
    });
  });
}

// Survey drafts are account/survey scoped. A mounted editor belongs to exactly one draft.
const surveyEditor = { checkingSource: false, selectionGeneration: 0, bundle: null, archives: {}, buildingFlyers: {}, flyerUploads: 0, pending: null, saving: false, persistenceError: null, storageTail: Promise.resolve() };
const SURVEY_CHOICE_OPTIONS = {
  fTenancy: [['ST', 'Single tenant'], ['MT', 'Multi-tenant']],
  fAvailability: AVAILABILITY_OPTIONS.map(x => [x, x]),
  fLeaseType: LEASE_TYPES.map(x => [x, x]),
  fInternalStatus: INTERNAL_STATUS_OPTIONS.map(x => [x, x]),
  fExpenseTreatment: [['additional', 'Separate charge'], ['included', 'Included / no additional charge'], ['unknown', 'Not yet known']],
};
function activeSurveyDraft() { return surveyEditor.bundle?.drafts[surveyEditor.bundle.active]; }
function surveyDraftKey() { return state.accountId && state.survey ? `survey_drafts_v1:${state.accountId}:${state.survey.id}` : null; }
function surveyChoice(id, value, scope = activeSurveyDraft()?.id || 'initial') {
  const node = $(id);
  const focused = node.contains(document.activeElement) ? document.activeElement.value : null;
  const options = [...SURVEY_CHOICE_OPTIONS[id]];
  if (value && !options.some(([v]) => v === value)) options.push([value, `${value} (saved)`]);
  node.value = value ?? '';
  node.innerHTML = options.map(([v, label], i) => `<label class="survey-choice" for="${esc(id)}-${esc(scope)}-${i}"><input type="radio" id="${esc(id)}-${esc(scope)}-${i}" name="${esc(id)}-${esc(scope)}" value="${esc(v)}" ${v === value ? 'checked' : ''} /><span>${esc(label)}</span></label>`).join('') +
    (id !== 'fExpenseTreatment' && value ? '<button type="button" class="choice-clear">Clear selection</button>' : '');
  node.querySelectorAll('input').forEach(input => input.addEventListener('change', () => { if (input.checked) { node.value = input.value; node.dispatchEvent(new Event('change', { bubbles: true })); } }));
  if (focused !== null) [...node.querySelectorAll('input')].find(input => input.value === focused)?.focus({ preventScroll:true });
  node.querySelector('.choice-clear')?.addEventListener('click', () => { node.value = ''; node.dispatchEvent(new Event('change', { bubbles: true })); });
}
function surveyReviewSource(source) {
  if (!source) return null;
  return Object.fromEntries(['costarId','listingId','street','city','state','zip','sourceUrl','rba','acLot','leaseQuote','leaseQuoteRaw','leaseRate','selectedSpace','sourceTabId'].filter(k => source[k] !== undefined).map(k => [k,source[k]]));
}
function makeSurveyDraft(row, isNew, source = null) {
  source = surveyReviewSource(source);
  const draft = { id: crypto.randomUUID(), model: SurveyFields.hydrateDraft(row, { isNew }), source };
  const space = source?.selectedSpace;
  // Only a new blank offering gets an explicit monthly source suggestion. Never
  // replace a saved quote or restore a cleared/edited quote during a re-read.
  const blankRent = ['monthly_base_rent','lease_rate_psf','lease_rate_per_acre'].every(k => row[k] == null || row[k] === '');
  if (isNew && blankRent && !row.rent_calculation && space?.scope === 'space-details' && space.canPrefill === true) {
    const parsed = SurveyFields.parseNumericInput(space.monthlyRent, SurveyFields.SURVEY_NUMERIC_OPTIONS.monthly_base_rent);
    if (parsed.valid && parsed.value != null) {
      draft.model.rentDraft = SurveyRent.editRent(draft.model.rentDraft, 'total', String(parsed.value));
      draft.prefilledMonthlyRent = String(parsed.value);
    }
  }
  applyNnnExpenseDefault(draft);
  return draft;
}
function applyNnnExpenseDefault(draft) {
  const m = draft.model;
  if (m.isNew && m.rentSupported && m.values.lease_type === 'NNN' && !m.baseline.rent_calculation && !draft.expenseTreatmentEdited && m.rentDraft?.expenses?.treatment === 'unknown') {
    m.rentDraft = SurveyRent.changeExpenseTreatment(m.rentDraft, 'additional');
  }
}
function surveySpaceLeaseType(raw) {
  if (/triple net|^nnn$/i.test(raw || '')) return 'NNN';
  if (/full service/i.test(raw || '')) return 'Full Service Gross';
  if (/industrial gross/i.test(raw || '')) return 'Industrial Gross';
  if (/modified gross/i.test(raw || '')) return 'Modified Gross';
  return null;
}
function surveySourceKey(d) {
  const building = d?.listingId ? `listing:${d.listingId}` : d?.costarId ? `costar:${d.costarId}` : `address:${[d?.street,d?.city,d?.state].map(v => String(v || '').trim().toLowerCase()).join('|')}`;
  // The open space is a distinct offering, even when another suite shares its
  // CoStar building ID. Amount changes do not change the space's draft identity.
  return d?.selectedSpace?.identity ? `${building}:space:${d.selectedSpace.identity}` : building;
}
async function persistSurveyDraft() {
  const key = surveyDraftKey();
  if (!key || !surveyEditor.bundle) return;
  surveyEditor.archives[surveyEditor.bundle.key] = structuredClone(surveyEditor.bundle);
  const snapshot = structuredClone({ version: 1, activeKey: surveyEditor.bundle.key, bundles: surveyEditor.archives, buildingFlyers: surveyEditor.buildingFlyers });
  const write = async () => {
    try { await chrome.storage.local.set({ [key]: snapshot }); surveyEditor.persistenceError = null; if ($('draftStatus')) $('draftStatus').textContent = 'Draft saved on this device'; }
    catch (e) { surveyEditor.persistenceError = e.message || 'Local storage unavailable'; showError($('formError'), 'Draft could not be saved on this device. Keep this panel open and retry. ' + surveyEditor.persistenceError); throw e; }
  };
  const previous = surveyEditor.storageTail;
  surveyEditor.storageTail = (async () => { try { await previous; } catch {} await write(); })();
  return surveyEditor.storageTail;
}
function queueSurveyDraft() { void persistSurveyDraft().catch(() => {}); }
async function restoreSurveyWorkspace() {
  surveyEditor.bundle = null; surveyEditor.archives = {}; surveyEditor.buildingFlyers = {}; observedSurveySource = null; surveyEditor.pending = null;
  const key = surveyDraftKey(), scope = state.accountId + ':' + state.survey.id;
  if (key) {
    try { const stored = (await chrome.storage.local.get(key))[key]; if (scope !== state.accountId + ':' + state.survey?.id) return; if (stored?.version === 1) { surveyEditor.archives = stored.bundles || {}; surveyEditor.buildingFlyers = stored.buildingFlyers || {}; surveyEditor.bundle = surveyEditor.archives[stored.activeKey] || null; } }
    catch (e) { surveyEditor.persistenceError = e.message; showError($('idleError'), 'Cannot restore saved drafts. ' + e.message); }
  }
  const restoredDraft = activeSurveyDraft();
  if (restoredDraft && !restoredDraft.source && !restoredDraft.model.isNew) {
    const aliases = Object.values(surveyEditor.archives).filter(b => b.targetId === restoredDraft.model.baseline.id);
    const sources = aliases.flatMap(b => b.drafts || []).map(d => d.source).filter(source => source && sourceMatchesRow(source,restoredDraft.model.baseline));
    if (sources.length && new Set(sources.map(surveySourceKey)).size === 1) restoredDraft.source = surveyReviewSource(sources[0]);
  }
  const pending = await bg('GET_SURVEY_PENDING', { surveyId: state.survey.id });
  if (scope !== state.accountId + ':' + state.survey?.id) return;
  if (handleAuthFailure(pending)) return;
  if (pending.ok) surveyEditor.pending = pending.pending || null;
  const reviewedBundle = Object.values(surveyEditor.archives).find(b => b.reviewedRequest);
  if (!surveyEditor.pending && reviewedBundle) surveyEditor.pending = reviewedBundle.reviewedRequest;
  if (surveyEditor.pending) {
    const r = surveyEditor.pending.request;
    const rows = r.kind === 'insert' ? r.rows : [{ ...r.baseline, ...r.patch }];
    surveyEditor.bundle = reviewedBundle || { key: `pending:${r.requestId}`, active: 0, drafts: rows.map(row => makeSurveyDraft(row, r.kind === 'insert')), reviewedRequest:surveyEditor.pending };
  }
  if (surveyEditor.bundle) mountSurveyDraft();
}
function renderSurveyDraftTabs() {
  const bundle = surveyEditor.bundle; if (!bundle) return;
  const draft = activeSurveyDraft(), suite = draft?.model.values.suite_number;
  $('formTitle').textContent = `${draft?.model.isNew ? 'New offering' : 'Update space'}${suite ? ' · ' + suite : ''}`;
  const node = $('spaceDrafts');
  node.classList.toggle('hidden', bundle.drafts.length < 2);
  node.innerHTML = bundle.drafts.map((d,i) => `<button type="button" class="space-tab" data-draft="${i}" role="tab" aria-selected="${i === bundle.active}">${esc(d.model.values.suite_number || `Space ${i+1}`)}</button>${bundle.drafts.length > 1 ? `<button type="button" class="space-tab" data-remove="${i}" aria-label="Remove draft ${i+1}">×</button>` : ''}`).join('');
  node.querySelectorAll('[data-draft]').forEach(button => button.addEventListener('click', () => { bundle.active = Number(button.dataset.draft); mountSurveyDraft(); queueSurveyDraft(); }));
  node.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    if (surveyEditor.pending || surveyEditor.saving) return;
    const index = Number(button.dataset.remove); const removed = bundle.drafts.splice(index,1)[0];
    // Removal is reversible: keep its own archived draft instead of dropping edits.
    const removedKey = `removed:${removed.id}`;
    surveyEditor.archives[removedKey] = { key: removedKey, active: 0, drafts: [removed] };
    bundle.active = Math.min(bundle.active, bundle.drafts.length-1); mountSurveyDraft(); queueSurveyDraft();
  }));
}
function surveyDetailsIndicators() {
  $('screen-form').querySelectorAll('details').forEach(details => {
    const populated = [...details.querySelectorAll('input,textarea')].some(n => n.type === 'checkbox' || n.type === 'radio' ? n.checked : Boolean(n.value));
    const badge = details.querySelector('.has-details'); if (badge) badge.textContent = populated ? 'Has details' : '';
  });
  for (const id of ['fNotes','fNotes2','fInternalNotes']) { const el = $(id); el.style.height = 'auto'; el.style.height = Math.max(44,el.scrollHeight) + 'px'; }
}
const SURVEY_AREA_INPUTS = new Set(['fSuiteSize', 'fBuildingSf', 'fOfficeSf', 'fSpaceMin', 'fSpaceMax', 'fSpaceProposed']);
// Formatting never dispatches an input event or changes the saved/draft model.
// Keep the caret and partial input untouched while the user is typing.
for (const id of SURVEY_AREA_INPUTS) $(id).addEventListener('blur', () => {
  $(id).value = SurveyFields.formatAreaInput($(id).value);
});
function fillForm(row) {
  for (const [col,[id,type]] of Object.entries(FIELDS)) {
    const node = $(id), value = row[col];
    if (SURVEY_CHOICE_OPTIONS[id]) surveyChoice(id,value);
    else if (type === 'bool') { node.checked = value === true; node.indeterminate = value == null; }
    else node.value = SURVEY_AREA_INPUTS.has(id) ? SurveyFields.formatAreaInput(value) : value == null ? '' : String(value);
  }
  const fsl = row.for_sale_or_lease || [];
  $('fForSale').checked = fsl.includes('sale'); $('fForLease').checked = fsl.includes('lease');
  updateBlockVisibility();
  $('notes2Details').open = Boolean(row.notes_2);
  $('notes2Details').dataset.hasDetails = String(Boolean(row.notes_2));
  surveyDetailsIndicators();
}
function readForm() { return SurveyFields.serializeDraft(activeSurveyDraft().model).values; }
function mountSurveyDraft() {
  const draft = activeSurveyDraft(); if (!draft) return;
  if (!surveyEditor.pending) applyNnnExpenseDefault(draft);
  state.pendingDup = surveyEditor.bundle.decision === 'unresolved';
  state.mode = draft.model.isNew ? 'insert' : 'update'; state.editingId = draft.model.isNew ? null : draft.model.baseline.id; state.baseline = draft.model.baseline;
  if (!surveyEditor.pending && !surveyEditor.saving) SurveyFlyers.inherit(draft,surveyEditor.buildingFlyers);
  fillForm(draft.model.values); renderSpaceOption(); renderSurveyRent(); renderSurveyDraftTabs();
  const label = surveyEditor.bundle.drafts.length > 1 ? `Save ${surveyEditor.bundle.drafts.length} spaces` : draft.model.isNew ? 'Add to survey' : 'Save changes';
  $('btnSave').textContent = $('btnSaveBottom').textContent = label;
  setBanner(state.mode,draft.model.values);
  $('surveySource').textContent = draft.source ? `CoStar capture: ${draft.source.street || ''} · ${draft.source.selectedSpace?.suite ? 'Suite ' + draft.source.selectedSpace.suite : 'Property summary'}` : 'Manual / saved space';
  syncSurveyLock(); renderSurveyFlyer();
  setTab('push'); showScreen('form');
  if (surveyEditor.bundle.decision === 'unresolved') showSurveyCandidates(findMatch(draft.source));
}
function renderSpaceOption() {
  const d = activeSurveyDraft(); if (!d) return;
  const option = d.model.values.space_option, range = option?.kind === 'range';
  const controlled = option && !['fixed', 'range'].includes(option.kind);
  $('fSpaceKind').value = range ? 'range' : 'fixed';
  $('rowSpaceKind').classList.toggle('hidden', Boolean(controlled));
  $('rangeFields').classList.toggle('hidden', !range);
  $('combinedSpaceNotice').classList.toggle('hidden', !controlled);
  $('combinedSpaceLink').href = CONFIG.APP_URL + '/surveys/' + state.survey.id;
  for (const [id,key] of [['fSpaceMin','min'],['fSpaceMax','max'],['fSpaceProposed','proposed']])
    if (document.activeElement !== $(id)) $(id).value = range ? SurveyFields.formatAreaInput(option[key]) : '';
  $('fSuiteSize').readOnly = Boolean(range || controlled);
  if (range) $('fSuiteSize').value = d.model.values.suite_size || '';
}
function changeSpaceRange(patch) {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  hideError($('formError'));
  $('rangeFields').querySelectorAll('.field-error').forEach(node => node.remove());
  $('rangeFields').querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
  const previousArea = SurveyRent.resolveSurveyRentArea(d.model.values);
  const old = d.model.values.space_option;
  const option = {kind:'range',min:'',max:'',proposed:'',members:[],review:false,quoteArea:'',...old,...patch};
  d.model.values.space_option = option;
  d.model.values.suite_size = SurveySpaces.rangeLabel(option);
  const area = SurveyRent.resolveSurveyRentArea(d.model.values);
  if (area !== previousArea) {
    for (const group of ['rent','expenses']) {
      const quote = d.model.rentDraft?.[group];
      if (quote?.basis === 'total' && quote.amount !== '') {
        d.model.rentDraft[group] = {...quote,amount:'',preservePrecision:false};
        showError($('formError'),'Proposed area changed. Enter the monthly total quoted for the new area.');
      }
    }
    option.quoteArea = '';
  }
  updateBlockVisibility(); renderSpaceOption(); renderSurveyRent(); queueSurveyDraft();
}
$('fSpaceKind').addEventListener('change', () => {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  if ($('fSpaceKind').value === 'range') changeSpaceRange({kind:'range'});
  else if (d.model.values.space_option?.kind === 'range') {
    // Switching modes is a deliberate new area/quote, never silently take max SF.
    changeSpaceRange({proposed:''});
    d.model.values.space_option = null; d.model.values.suite_size = '';
    renderSpaceOption(); $('fSuiteSize').value = ''; renderSurveyRent(); queueSurveyDraft();
  }
});
for (const [id,key] of [['fSpaceMin','min'],['fSpaceMax','max'],['fSpaceProposed','proposed']])
  $(id).addEventListener('input', () => changeSpaceRange({[key]:$(id).value}));
function syncSurveyLock() {
  const locked = Boolean(surveyEditor.pending || surveyEditor.saving || surveyEditor.checkingSource);
  $('screen-form').querySelectorAll('input,textarea,select,button').forEach(el => { el.disabled = locked; });
  for (const id of ['btnChangeSurvey','btnDisconnect','btnRefresh','btnSavedDrafts']) $(id).disabled = surveyEditor.saving;
  $('btnRecoverSurvey').disabled = surveyEditor.saving; $('btnUnlockSurvey').disabled = surveyEditor.saving; $('btnReviewLatest').disabled = surveyEditor.saving;
  $('btnReviewLatest').classList.add('hidden');
  $('pendingSurvey').classList.toggle('hidden', !surveyEditor.pending);
  if (surveyEditor.pending) $('pendingSurveyText').textContent = 'This reviewed save is locked until its result is checked. Retrying uses the same spaces and IDs.';
  $('btnUnlockSurvey').classList.add('hidden');
  if (state.pendingDup || surveyEditor.flyerUploads) $('btnSave').disabled = $('btnSaveBottom').disabled = true;
  if (surveyEditor.flyerUploads) $('btnAttachFlyer').disabled = true;
  if (!activeSurveyDraft()?.model.rentSupported) $('surveyPricing').querySelectorAll('input,button').forEach(el => { el.disabled = true; });
  const option = activeSurveyDraft()?.model.values.space_option;
  if (option && !['fixed','range'].includes(option.kind)) {
    for (const id of ['fAddress','fCity','fState','fBuildingSf','fSuiteNumber','fSuiteSize','fDateAvailable','fOfferedAcres','btnResetRent']) $(id).disabled = true;
    for (const id of ['fTenancy','fAvailability','surveyPricing']) $(id).querySelectorAll('input,button').forEach(el => { el.disabled = true; });
  }
}
function setupForm(mode, row, opts = {}) {
  if (surveyEditor.pending || surveyEditor.saving) { mountSurveyDraft(); return; }
  if (surveyEditor.bundle) queueSurveyDraft();
  const source = opts.noSource ? null : state.scraped;
  const key = mode === 'update' ? `row:${row.id}` : opts.key || surveySourceKey(source);
  surveyEditor.bundle = surveyEditor.archives[key] || { key, active: 0, drafts: [makeSurveyDraft(mode === 'insert' ? (row || recordFromScrape(source || {})) : row, mode === 'insert', source)] };
  hideError($('formError')); $('dupChooser').classList.add('hidden'); $('suggestions').classList.add('hidden');
  mountSurveyDraft();
  if (source && mode === 'update') renderSuggestions(row,source);
  queueSurveyDraft();
}
function findMatch(scraped) {
  if (!scraped) return [];
  const target = normAddress(scraped.street), number = target.match(/^\d+/)?.[0];
  return state.props.filter(p => {
    if (scraped.costarId && new RegExp(`CoStar ID: ${String(scraped.costarId).replace(/[^\d]/g,'')}(?:\\D|$)`).test(p.internal_notes || '')) return true;
    const address = normAddress(p.address);
    return target && (address === target || (number && address.match(/^\d+/)?.[0] === number && address.split(' ')[1] === target.split(' ')[1]));
  });
}
function sourceMatchesRow(source, row, acceptedSuite) {
  const suite = SurveySpaces.normalizeSpaceLabel(source?.selectedSpace?.suite);
  if (source?.street && normAddress(source.street) !== normAddress(row?.address)) return false;
  for (const key of ['city','state']) if (source?.[key] && String(source[key]).trim().toLowerCase() !== String(row?.[key] || '').trim().toLowerCase()) return false;
  return acceptedSuite !== undefined ? acceptedSuite === SurveySpaces.normalizeSpaceLabel(row?.suite_number) : !suite || suite === SurveySpaces.normalizeSpaceLabel(row?.suite_number);
}
function candidateLabel(p) { return [p.address, [p.city,p.state].filter(Boolean).join(', '), p.suite_number ? `Space ${p.suite_number}` : (p.tenancy === 'ST' ? 'Whole building' : 'Unlabeled space'), p.tenancy === 'ST' ? (p.building_sf == null ? 'Size unknown' : `${p.building_sf} SF`) : `${p.suite_size || 'Size unknown'}${p.suite_size ? ' SF' : ''}`, p.availability || 'Availability unknown'].join(' · '); }
function showSurveyCandidates(candidates) {
  const bundle = surveyEditor.bundle;
  if (!candidates.length) { bundle.decision = 'new'; state.pendingDup = null; $('dupChooser').classList.add('hidden'); syncSurveyLock(); return; }
  const addLabel = activeSurveyDraft()?.source?.selectedSpace ? 'Add current CoStar space' : 'Add available space';
  $('spaceCandidates').innerHTML = candidates.map((p,i) => `<div class="space-candidate"><p>${esc(candidateLabel(p))}</p><button type="button" data-update="${i}" class="btn btn-primary btn-sm" ${!sourceMatchesRow(activeSurveyDraft()?.source,p) ? 'disabled title="This is a different suite than the visible CoStar space"' : ''}>Update this space</button>${p.tenancy === 'MT' || activeSurveyDraft()?.source?.selectedSpace ? `<button type="button" data-add="${i}" class="btn btn-ghost btn-sm">${addLabel}</button>` : ''}</div>`).join('');
  $('spaceCandidates').querySelectorAll('[data-update]').forEach(button => button.addEventListener('click', () => {
    const row = candidates[Number(button.dataset.update)]; if (!sourceMatchesRow(activeSurveyDraft()?.source,row)) return; bundle.targetId = row.id; bundle.decision = 'update'; queueSurveyDraft(); setupForm('update',row);
  }));
  $('spaceCandidates').querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
    if (surveyEditor.pending || surveyEditor.saving) return;
    const draft = activeSurveyDraft(); if (!draft?.model.isNew) return;
    const building = candidates[Number(button.dataset.add)];
    // This choice confirms the captured offering belongs under this building.
    // Keep its source, reviewed fields and pricing; it is not a blank sibling.
    for (const [field,value] of Object.entries(SurveySpaces.availableSpaceSeed(building))) {
      const current = draft.model.values[field];
      if (current == null && sameVal(current, draft.model.baseline[field])) draft.model.values[field] = structuredClone(value);
    }
    draft.model.values.tenancy = 'MT'; bundle.decision = 'add';
    state.pendingDup = null; $('dupChooser').classList.add('hidden'); mountSurveyDraft(); queueSurveyDraft();
  }));
  $('dupChooser').classList.remove('hidden'); state.pendingDup = true;
  $('btnSave').disabled = $('btnSaveBottom').disabled = true;
}
function matchAndShowForm() {
  if (surveyEditor.pending || surveyEditor.saving) return mountSurveyDraft();
  const d = state.scraped, key = surveySourceKey(d), archived = surveyEditor.archives[key];
  if (archived?.targetId) {
    const target = state.props.find(p => p.id === archived.targetId);
    if (target && sourceMatchesRow(d,target,archived.targetLabel)) { setupForm('update',target); const draft = activeSurveyDraft(); draft.source = surveyReviewSource(d); if (archived.targetLabel !== undefined) draft.sourceTargetLabel = archived.targetLabel; mountSurveyDraft(); queueSurveyDraft(); return; }
  }
  if (archived?.destinationKey && surveyEditor.archives[archived.destinationKey] && (sourceMatchesRow(d,surveyEditor.archives[archived.destinationKey].drafts[0]?.model.values) || surveyEditor.archives[archived.destinationKey].drafts.some(draft => draft.model.isNew && draft.source && surveySourceKey(draft.source) === key) || legacyBlankSpaceDestination(surveyEditor.archives[archived.destinationKey],archived))) {
    surveyEditor.bundle = surveyEditor.archives[archived.destinationKey];
    const capturedIndex = surveyEditor.bundle.drafts.findIndex(draft => draft.source && surveySourceKey(draft.source) === key);
    if (capturedIndex >= 0) surveyEditor.bundle.active = capturedIndex;
    restoreDiscardedSpaceCapture(archived);
    mountSurveyDraft(); queueSurveyDraft(); return;
  }
  if (archived?.targetId || archived?.destinationKey) { delete surveyEditor.archives[key]; if (surveyEditor.bundle?.key === key) surveyEditor.bundle = null; }
  setupForm('insert',null);
  const capturedIndex = surveyEditor.bundle.drafts.findIndex(draft => draft.source && surveySourceKey(draft.source) === key);
  if (capturedIndex >= 0) surveyEditor.bundle.active = capturedIndex;
  const draft = activeSurveyDraft(); draft.source = surveyReviewSource(d); mountSurveyDraft();
  if (!['new','add'].includes(surveyEditor.bundle.decision)) { surveyEditor.bundle.decision = 'unresolved'; showSurveyCandidates(findMatch(d)); }
  queueSurveyDraft();
}
function legacyBlankSpaceDestination(bundle, sourceBundle) {
  const draft = bundle?.drafts?.[0], capture = sourceBundle?.drafts?.[sourceBundle.active];
  return bundle?.drafts?.length === 1 && draft?.model.isNew && !draft.source && capture?.source?.selectedSpace;
}
function restoreDiscardedSpaceCapture(sourceBundle) {
  const draft = activeSurveyDraft(), captured = sourceBundle.drafts?.[sourceBundle.active];
  // Version 1.4.1 sent the captured source to a separate blank draft. Recover
  // only omitted fields in that exact local alias, never an existing row or
  // anything explicitly entered/cleared. Keep all sibling drafts independent.
  if (surveyEditor.bundle.drafts.length !== 1 || !draft?.model.isNew || draft.source || !captured?.source?.selectedSpace) return;
  const untouchedArea = ['suite_number','suite_size','space_option'].every(field => !Object.hasOwn(draft.model.values, field));
  for (const field of SurveyFields.EDITABLE_FIELDS) {
    if (!untouchedArea && captured.model.values.space_option && ['suite_size','space_option'].includes(field)) continue;
    if (!Object.hasOwn(draft.model.values,field) && Object.hasOwn(captured.model.values,field))
      draft.model.values[field] = structuredClone(captured.model.values[field]);
  }
  // Input edits (including a cleared quote) carry preservePrecision:false and
  // differ from this exact fresh default. Never replace those pricing drafts.
  if (untouchedArea && !draft.expenseTreatmentEdited && SurveyFields.structuralEqual(draft.model.rentDraft, SurveyRent.createSurveyRentDraft(null,true))) {
    draft.model.rentDraft = structuredClone(captured.model.rentDraft);
    if (captured.prefilledMonthlyRent) draft.prefilledMonthlyRent = captured.prefilledMonthlyRent;
  }
  draft.source = structuredClone(captured.source);
}
$('btnDupNew').addEventListener('click', () => { state.pendingDup = null; surveyEditor.bundle.decision = 'new'; $('dupChooser').classList.add('hidden'); syncSurveyLock(); queueSurveyDraft(); });
function addSurveySpace(combined = false, building = null) {
  if (surveyEditor.pending || surveyEditor.saving) return;
  if (combined) { void chrome.tabs.create({url: CONFIG.APP_URL + '/surveys/' + state.survey.id}); return; }
  const current = activeSurveyDraft(); const source = building || current?.model.values;
  if (!source || source.tenancy !== 'MT') return showError($('formError'),'Choose Multi-tenant before adding an available space.');
  if (surveyEditor.bundle) queueSurveyDraft();
  const seed = SurveySpaces.availableSpaceSeed(source);
  if (combined) seed.suite_number = 'Combined: ';
  const draft = makeSurveyDraft(seed,true); draft.combined = combined;
  const flyerBuilding = SurveyFlyers.identity(current);
  if (!building && flyerBuilding) draft.flyerBuilding = flyerBuilding;
  if (building || !current.model.isNew) {
    const key = `spaces:${crypto.randomUUID()}`; surveyEditor.bundle = { key, active: 0, drafts: [draft] };
  } else { surveyEditor.bundle.drafts.push(draft); surveyEditor.bundle.active = surveyEditor.bundle.drafts.length-1; }
  state.pendingDup = null; $('dupChooser').classList.add('hidden'); mountSurveyDraft(); queueSurveyDraft(); $('fSuiteNumber').focus();
}
$('btnManualProperty').addEventListener('click', () => {
  if (!state.survey) return openPicker();
  state.scraped = null; setupForm('insert',recordFromScrape({}),{key:`manual:${crypto.randomUUID()}`,noSource:true});
});
$('btnClearSurveyDrafts').addEventListener('click', async e => {
  const key = surveyDraftKey(); if (!key) return showError($('draftClearError'),'Select a survey first.');
  if (surveyEditor.saving || surveyEditor.pending || Object.values(surveyEditor.archives).some(b => b.reviewedRequest)) return showError($('draftClearError'),'Resolve the pending save before clearing drafts.');
  const button = e.currentTarget;
  if (!button.dataset.armed) { button.dataset.armed = 'true'; button.textContent = 'Click again to discard these local drafts'; return; }
  try {
    const pending = await bg('GET_SURVEY_PENDING',{surveyId:state.survey.id});
    if (!pending.ok || pending.pending) return showError($('draftClearError'),'The current save state must be resolved before clearing drafts.');
    await surveyEditor.storageTail; await chrome.storage.local.remove(key);
    surveyEditor.bundle = null; surveyEditor.archives = {}; surveyEditor.buildingFlyers = {}; state.mode = null; state.editingId = null; state.baseline = null;
    delete button.dataset.armed; button.textContent = 'Clear saved drafts for current survey'; hideError($('draftClearError')); toast('Local drafts cleared for this survey.');
  } catch (error) { showError($('draftClearError'),'Drafts could not be cleared: ' + error.message); }
});
$('btnSavedDrafts').addEventListener('click', () => {
  const node = $('savedDraftList'); node.classList.toggle('hidden');
  node.innerHTML = Object.values(surveyEditor.archives).filter(b => !b.targetId && !b.destinationKey).map((b,i) => `<button type="button" class="space-tab" data-key="${esc(b.key)}">${esc(b.drafts[0]?.model.values.address || 'Untitled draft')} · ${esc(b.drafts[0]?.model.values.suite_number || '')} · ${b.drafts.length} space(s)</button>`).join('') || '<span class="hint">No saved drafts for this account and survey.</span>';
  node.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', async () => {
    if (surveyEditor.pending || surveyEditor.saving) return mountSurveyDraft();
    try { await persistSurveyDraft(); } catch { return; }
    surveyEditor.bundle = surveyEditor.archives[button.dataset.key]; node.classList.add('hidden'); mountSurveyDraft(); queueSurveyDraft();
  }));
});
$('btnAddSpace').addEventListener('click', () => addSurveySpace());
$('btnCombinedSpace').addEventListener('click', () => addSurveySpace(true));
async function showSurveyIssues(issues, index) {
  surveyEditor.bundle.active = index; mountSurveyDraft();
  await window.Layout?.apply("survey");
  $('screen-form').querySelectorAll('.field-error').forEach(el => el.remove());
  $('screen-form').querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  for (const issue of issues) {
    const id = FIELDS[issue.field]?.[0] || ({ rent:'fMonthlyBase',rent_total:'fMonthlyBase',rent_sf:'fLeaseRate',rent_acre:'fRentAcre',expenses_total:'fOpexTotal',expenses_sf:'fOpexPsf',expenses:'fOpexTotal',offered_acres:'fOfferedAcres',space_option:'fSpaceProposed' })[issue.field];
    const node = $(id); if (!node) continue;
    node.setAttribute('aria-invalid','true'); const error = document.createElement('span'); error.className = 'field-error'; error.textContent = issue.message; node.parentElement.append(error);
  }
  showError($('formError'),`Space ${index+1}: ${issues.map(x => x.message).join(' ')}`);
  const field = $('screen-form').querySelector('[aria-invalid="true"]');
  field?.closest('details')?.setAttribute('open','');
  if (field) { field.scrollIntoView({ block: 'center' }); field.focus(); } else $('formError').focus();
}
function sameVal(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b,k) && sameVal(a[k],b[k]));
  }
  return a === b;
}
async function applySurveySaved(rows) {
  const previous = surveyEditor.bundle;
  const entries = (previous?.drafts || []).map(draft => ({draft,row:rows.find(row => row.id === (draft.model.isNew ? draft.id : draft.model.baseline.id))})).filter(entry => entry.row);
  for (const row of rows) { const i = state.props.findIndex(p => p.id === row.id); if (i < 0) state.props.push(row); else state.props[i] = row; }
  if (previous) {
    // PostgREST readback order is not insertion order. Associate every source and
    // legacy destination with its actual draft ID, never with rows[0].
    for (const archive of Object.values(surveyEditor.archives)) if (archive.destinationKey === previous.key) {
      const entry = entries.find(({draft}) => draft.source && surveySourceKey(draft.source) === archive.key);
      if (entry) { archive.destinationKey = `row:${entry.row.id}`; archive.targetId = entry.row.id; archive.decision = 'update'; }
    }
    delete surveyEditor.archives[previous.key];
    for (const {draft,row} of entries) {
      if (draft.source) {
        const key = surveySourceKey(draft.source);
        surveyEditor.archives[key] = {key,active:0,drafts:[structuredClone(draft)],targetId:row.id,targetLabel:SurveySpaces.normalizeSpaceLabel(row.suite_number),decision:'update'};
      }
      surveyEditor.archives[`row:${row.id}`] = {key:`row:${row.id}`,active:0,drafts:[{...makeSurveyDraft(row,false,draft.source),flyerMode:draft.flyerMode,flyerBuilding:draft.flyerBuilding,sourceTargetLabel:SurveySpaces.normalizeSpaceLabel(row.suite_number)}]};
    }
  }
  surveyEditor.pending = null; surveyEditor.saving = false;
  const first = entries[0]?.row || rows[0], source = entries[0]?.draft.source || null;
  surveyEditor.bundle = surveyEditor.archives[`row:${first.id}`] || {key:`row:${first.id}`,active:0,drafts:[makeSurveyDraft(first,false,source)]};
  state.scraped = source; state.pendingDup = null; updateContextBar(); mountSurveyDraft(); await persistSurveyDraft();
  toast(`${rows.length} ${rows.length === 1 ? 'space' : 'spaces'} saved · <a href="${esc(CONFIG.APP_URL + '/surveys/' + state.survey.id)}" target="_blank">Open survey</a>`);
}
async function handleSurveySaveResult(res) {
  if (res.ok && res.status === 'saved' && res.properties?.length) return applySurveySaved(res.properties);
  if (res.pending) surveyEditor.pending = res.pending;
  else if (res.saveRejected && res.pending === null) { surveyEditor.pending = null; delete surveyEditor.bundle.reviewedRequest; await persistSurveyDraft(); }
  else { const lookup = await bg('GET_SURVEY_PENDING',{surveyId:state.survey.id}); if (lookup.ok && lookup.pending) surveyEditor.pending = lookup.pending; }
  const incoming = surveyEditor.pending, local = surveyEditor.bundle?.reviewedRequest;
  if (incoming && local && incoming.request.requestId !== local.request.requestId) {
    // Another panel owns the pending save. Keep this unsent draft separately and
    // show only that exact pending payload while checking its result.
    delete surveyEditor.bundle.reviewedRequest; surveyEditor.archives[surveyEditor.bundle.key] = structuredClone(surveyEditor.bundle);
    const request = incoming.request, rows = request.kind === 'insert' ? request.rows : [{...request.baseline,...request.patch}];
    surveyEditor.bundle = {key:`pending:${request.requestId}`,active:0,drafts:rows.map(row=>makeSurveyDraft(row,request.kind==='insert')),reviewedRequest:incoming};
    await persistSurveyDraft();
  }
  surveyEditor.saving = false; if (incoming && local && incoming.request.requestId !== local.request.requestId) mountSurveyDraft(); syncSurveyLock();
  if (handleAuthFailure(res)) return;
  if (res.status === 'none') { $('pendingSurveyText').textContent = 'No saved rows found yet. Retry this same reviewed save to verify its outcome.'; if (res.pending?.saveRejected) $('btnUnlockSurvey').classList.remove('hidden'); }
  if (res.status === 'partial' || res.status === 'changed') $('pendingSurveyText').textContent = res.error || 'Only part of this save can be verified, or the row changed elsewhere. Keep this draft and review the current saved record before another save.';
  if (res.status === 'changed' && surveyEditor.pending?.request.kind === 'update' && (res.canReviewCurrent || surveyEditor.pending.phase === 'prepared')) { $('btnReviewLatest').classList.remove('hidden'); surveyEditor.currentConflict = res.current || res.properties?.[0]; }
  showError($('formError'),res.error || 'Save not yet verified. Check the result before continuing.');
}
async function save() {
  if (surveyEditor.saving || surveyEditor.pending || surveyEditor.checkingSource || !activeSurveyDraft() || state.pendingDup) return;
  if (surveyEditor.flyerUploads) return showError($('formError'),'Wait for the flyer upload to finish before saving.');
  if (!state.propsLookupOk) return showError($('formError'),'Survey lookup failed. Refresh the survey before saving.');
  const originalBundle = surveyEditor.bundle, scope = surveyDraftKey(), sourceDraft = surveyEditor.bundle.drafts.find(d => d.source), source = sourceDraft?.source;
  if (source) {
    surveyEditor.checkingSource = true; surveyEditor.saving = true; ++surveyReadGeneration; syncSurveyLock();
    try {
      const live = await stableSurveyRead(source.sourceTabId,source);
      if (scope !== surveyDraftKey() || surveyEditor.bundle !== originalBundle) return;
      if (surveySourceKey(live) !== surveySourceKey(source) || (source.sourceTabId != null && live.sourceTabId !== source.sourceTabId))
        return showError($('formError'),'CoStar now shows a different space. Nothing was saved. Refresh to review that space; these edits remain in Drafts.');
      if (!sourceDraft.model.isNew && !sourceMatchesRow(live,sourceDraft.model.baseline,sourceDraft.sourceTargetLabel))
        return showError($('formError'),'The visible CoStar suite does not match this saved row. Nothing was saved. Refresh and add the current space.');
    } catch (error) { return showError($('formError'),'Nothing was saved. ' + error.message); }
    finally { surveyEditor.checkingSource = false; surveyEditor.saving = false; syncSurveyLock(); }
  }
  if (scope !== surveyDraftKey() || surveyEditor.bundle !== originalBundle) return;
  const results = surveyEditor.bundle.drafts.map(d => {
    const result = SurveyFields.serializeDraft(d.model);
    if (!result.values.address?.trim()) result.issues.push({field:'address',message:'Address is required.'});
    if (!result.values.for_sale_or_lease?.length) result.issues.push({field:'for_sale_or_lease',message:'Select For Sale and/or For Lease.'});
    if (d.combined && d.model.isNew) result.issues.push({field:'space_option',message:'Create this combined option in Master App to select and confirm the included suites.'});
    result.valid = result.issues.length === 0; return result;
  });
  const bad = results.findIndex(r => !r.valid); if (bad >= 0) return showSurveyIssues(results[bad].issues,bad);
  const isNew = activeSurveyDraft().model.isNew;
  if (!isNew && !Object.keys(results[0].patch).length) return toast('No changes to save.');
  hideError($('formError')); surveyEditor.saving = true; syncSurveyLock();
  try {
    await persistSurveyDraft();
    const request = isNew ? SurveySpaces.createBatchRequest({ accountId:state.accountId,surveyId:state.survey.id,rows:results.map((r,i) => ({...r.values,id:surveyEditor.bundle.drafts[i].id})) }) : SurveySpaces.createUpdateRequest({ accountId:state.accountId,surveyId:state.survey.id,id:state.editingId,baseline:state.baseline,patch:results[0].patch });
    // Keep the exact reviewed payload in the panel too until worker recovery verifies it.
    surveyEditor.pending = { request, phase:'prepared' };
    surveyEditor.bundle.reviewedRequest = surveyEditor.pending;
    try { await persistSurveyDraft(); } catch (error) { surveyEditor.pending = null; delete surveyEditor.bundle.reviewedRequest; throw error; }
    const res = await bg(isNew ? 'SAVE_SURVEY_BATCH' : 'SAVE_SURVEY_UPDATE',{request},{write:true});
    await handleSurveySaveResult(res);
  } catch (e) { surveyEditor.saving = false; syncSurveyLock(); showError($('formError'),e.message); }
}
$('btnSave').addEventListener('click',save); $('btnSaveBottom').addEventListener('click',save);
$('btnRecoverSurvey').addEventListener('click',async () => {
  if (surveyEditor.saving) return; surveyEditor.saving = true; syncSurveyLock();
  const res = await bg(surveyEditor.pending.request.kind === 'insert' ? 'SAVE_SURVEY_BATCH' : 'SAVE_SURVEY_UPDATE',{request:surveyEditor.pending.request},{write:true});
  await handleSurveySaveResult(res);
});
$('btnUnlockSurvey').addEventListener('click',async () => {
  if (surveyEditor.saving) return; surveyEditor.saving = true; syncSurveyLock();
  try {
    const res = await bg('ABANDON_SURVEY_PENDING',{surveyId:state.survey.id},{write:true});
    if (!res.ok) return showError($('formError'),res.error);
    surveyEditor.pending = null; delete surveyEditor.bundle.reviewedRequest; await persistSurveyDraft(); hideError($('formError'));
  } finally { surveyEditor.saving = false; syncSurveyLock(); }
});
$('btnReviewLatest').addEventListener('click',async () => {
  if (surveyEditor.saving) return; surveyEditor.saving = true; syncSurveyLock();
  try {
    const res = await bg('ABANDON_SURVEY_PENDING',{surveyId:state.survey.id},{write:true});
    if (!res.ok) return showError($('formError'),res.error);
    const current = res.current || res.properties?.[0] || surveyEditor.currentConflict;
    if (!current) return showError($('formError'),'This space no longer exists. Keep the draft and review the survey in the web app.');
    const previous = surveyEditor.bundle; const previousKey = previous.key; delete previous.reviewedRequest;
    delete surveyEditor.archives[previousKey]; previous.key = `conflict:${crypto.randomUUID()}`; surveyEditor.archives[previous.key] = structuredClone(previous);
    delete surveyEditor.archives[`row:${current.id}`]; surveyEditor.bundle = null; surveyEditor.pending = null; surveyEditor.saving = false;
    setupForm('update',current,{noSource:true});
    showError($('formError'),'Current saved space loaded. Your previous edits are preserved under Drafts; review and reapply changes deliberately.');
  } finally { surveyEditor.saving = false; syncSurveyLock(); }
});
$('btnCancelDraft').addEventListener('click',() => {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending) return;
  d.model = SurveyFields.hydrateDraft(d.model.baseline,{isNew:d.model.isNew}); mountSurveyDraft(); queueSurveyDraft();
});

const SURVEY_RENT_INPUTS = {
  fMonthlyBase: ['rent','total','monthly_base_rent','labelMonthlyBase'],
  fLeaseRate: ['rent','sf','lease_rate_psf','labelLeaseRate'],
  fRentAcre: ['rent','acre','lease_rate_per_acre','labelRentAcre'],
  fOpexTotal: ['expenses','total','total_monthly_opex','labelOpexTotal'],
  fOpexPsf: ['expenses','sf','monthly_opex_psf','labelOpexPsf'],
};
function renderSurveyRent() {
  const d = activeSurveyDraft(); if (!d) return;
  const m = d.model, rd = m.rentDraft;
  const rawBuilding = SurveyFields.parseNumericInput(m.values.building_sf,SurveyFields.surveyNumericOptions('building_sf',m.values.building_sf,m.baseline.building_sf));
  const area = { ...m.values, building_sf: rawBuilding.valid ? rawBuilding.value : null };
  const values = m.rentSupported ? SurveyRent.preview(rd,area,m.baseline) : m.baseline;
  $('rentCompatibility').classList.toggle('hidden',m.rentSupported);
  $('rentCompatibility').textContent = m.compatibilityMessage ? m.compatibilityMessage + ' The database may reject unrelated edits to this format; no pricing will be overwritten.' : '';
  for (const [id,[group,basis,col,label]] of Object.entries(SURVEY_RENT_INPUTS)) {
    const quote = rd?.[group], isSource = quote?.basis === basis;
    const input = $(id);
    if (document.activeElement !== input) input.value = isSource ? quote.amount : SurveyRent.displayed(values[col],basis,!quote);
    input.disabled = !m.rentSupported || Boolean(surveyEditor.pending || surveyEditor.saving);
    const amount = isSource ? SurveyFields.parseNumericInput(quote.amount,SurveyRent.quoteOptions(quote)).value : values[col];
    $(label).textContent = amount == null ? '' : !quote ? 'Saved · unlinked' : isSource ? (id === 'fMonthlyBase' && quote.amount === d.prefilledMonthlyRent ? 'CoStar' : 'Entered') : 'Calculated · editable';
    const adopt = input.parentElement.querySelector('button');
    if (adopt) adopt.classList.toggle('hidden',Boolean(quote) || values[col] == null || !m.rentSupported);
  }
  if (document.activeElement !== $('fOfferedAcres')) $('fOfferedAcres').value = rd?.offered_acres ?? '';
  $('fOfferedAcres').disabled = !m.rentSupported || Boolean(surveyEditor.pending || surveyEditor.saving);
  // Unlinked saved amounts stay unlinked; NNN can still show its known expense
  // treatment without adopting or recalculating historical numbers on open.
  const treatment = rd?.expenses?.treatment || (m.values.lease_type === 'NNN' ? 'additional' : '');
  surveyChoice('fExpenseTreatment',treatment);
  $('expenseAmounts').classList.toggle('hidden',Boolean(treatment) && treatment !== 'additional');
  $('fTotalLeaseRate').value = SurveyRent.displayed(values.total_lease_rate,'total',!rd);
  $('labelTotalLeaseRate').textContent = values.total_lease_rate == null ? '' : !rd ? 'Saved · unlinked' : 'Calculated';
  surveyDetailsIndicators();
  if (m.values.space_option && !['fixed','range'].includes(m.values.space_option.kind)) $('surveyPricing').querySelectorAll('input,button').forEach(el => { el.disabled = true; });
}
function recordSurveyInput(col,id,type) {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  const node = $(id), value = type === 'bool' ? node.checked : node.value;
  if (type === 'bool') node.indeterminate = false;
  if (sameVal(value,d.model.values[col] ?? '')) return;
  d.model.values[col] = value;
  if (col === 'flyer_url') {
    d.flyerRevision = (d.flyerRevision || 0) + 1; delete d.flyerInherited;
    if (!value) d.flyerMode = 'space';
  }
  if (col === 'lease_type' && value === 'NNN' && d.model.rentSupported && d.model.rentDraft?.expenses) {
    d.model.rentDraft = SurveyRent.changeExpenseTreatment(d.model.rentDraft, 'additional');
    delete d.expenseTreatmentEdited;
  }
  if (d.model.isNew && ['address','city','state','zip','building_sf','land_area_ac','zoning','photo_url'].includes(col)) {
    for (const sibling of surveyEditor.bundle.drafts) if (sibling !== d) sibling.model.values[col] = value;
  }
  if (SURVEY_CHOICE_OPTIONS[id]) surveyChoice(id,value);
  updateBlockVisibility(); renderSurveyRent(); renderSurveyDraftTabs(); renderSurveyFlyer(); queueSurveyDraft();
}
for (const [col,[id,type]] of Object.entries(FIELDS)) {
  if (SURVEY_RENT_INPUTS[id] || id === 'fTotalLeaseRate') continue;
  $(id).addEventListener(type === 'bool' || SURVEY_CHOICE_OPTIONS[id] ? 'change' : 'input', e => {
    if (SURVEY_CHOICE_OPTIONS[id] && e.target !== $(id)) return;
    recordSurveyInput(col,id,type);
  });
}
for (const id of ['fForSale','fForLease']) $(id).addEventListener('change',() => {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending) return;
  d.model.values.for_sale_or_lease = [...($('fForSale').checked ? ['sale'] : []),...($('fForLease').checked ? ['lease'] : [])];
  updateBlockVisibility(); queueSurveyDraft();
});
for (const [id,[group,basis]] of Object.entries(SURVEY_RENT_INPUTS)) $(id).addEventListener('input',() => {
  const d = activeSurveyDraft(); if (!d || !d.model.rentSupported || surveyEditor.pending || surveyEditor.saving) return;
  const current = d.model.rentDraft?.[group];
  if (current?.basis === basis && current.amount === $(id).value) return;
  const parsed = SurveyFields.parseNumericInput($(id).value,basis === 'total' ? SurveyRent.MONEY_OPTIONS : SurveyRent.RATE_OPTIONS);
  const area = { ...d.model.values, building_sf: SurveyFields.parseNumericInput(d.model.values.building_sf).value };
  const shown = SurveyRent.preview(d.model.rentDraft,area,d.model.baseline)[SURVEY_RENT_INPUTS[id][2]];
  if (parsed.valid && parsed.value === shown) return;
  d.model.rentDraft = group === 'rent' ? SurveyRent.editRent(d.model.rentDraft,basis,$(id).value) : SurveyRent.editExpenses(d.model.rentDraft,basis,$(id).value);
  if (basis === 'total' && d.model.values.space_option?.kind === 'range') d.model.values.space_option.quoteArea = String(SurveyRent.resolveSurveyRentArea(d.model.values) || '');
  if (SurveyFields.serializeDraft(d.model).valid) hideError($('formError'));
  renderSurveyRent(); queueSurveyDraft();
});
$('fOfferedAcres').addEventListener('input',() => {
  const d = activeSurveyDraft(); if (!d || !d.model.rentSupported || surveyEditor.pending) return;
  d.model.rentDraft = { ...(d.model.rentDraft || { rent:null,expenses:null }),offered_acres:$('fOfferedAcres').value };
  renderSurveyRent(); queueSurveyDraft();
});
$('fExpenseTreatment').addEventListener('change',e => {
  if (e.target !== $('fExpenseTreatment')) return;
  const d = activeSurveyDraft(); if (!d || !d.model.rentSupported || surveyEditor.pending) return;
  d.expenseTreatmentEdited = true;
  d.model.rentDraft = SurveyRent.changeExpenseTreatment(d.model.rentDraft,$('fExpenseTreatment').value);
  renderSurveyRent(); queueSurveyDraft();
});
$('btnResetRent').addEventListener('click',() => {
  const d = activeSurveyDraft(); if (!d || !d.model.rentSupported || surveyEditor.pending) return;
  d.model.rentDraft = SurveyRent.createSurveyRentDraft(d.model.baseline.rent_calculation,d.model.isNew);
  delete d.expenseTreatmentEdited; applyNnnExpenseDefault(d); renderSurveyRent(); queueSurveyDraft();
});
$('screen-form').querySelectorAll('[data-adopt-rent],[data-adopt-expenses]').forEach(button => button.addEventListener('click',() => {
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending) return;
  const input = button.parentElement.querySelector('input'); const basis = button.dataset.adoptRent || button.dataset.adoptExpenses;
  d.model.rentDraft = button.dataset.adoptRent ? SurveyRent.editRent(d.model.rentDraft,basis,input.value,true) : SurveyRent.editExpenses(d.model.rentDraft,basis,input.value,true);
  if (basis === 'total' && d.model.values.space_option?.kind === 'range') d.model.values.space_option.quoteArea = String(SurveyRent.resolveSurveyRentArea(d.model.values) || '');
  if (SurveyFields.serializeDraft(d.model).valid) hideError($('formError'));
  renderSurveyRent(); queueSurveyDraft();
}));

// Attach the open CoStar flyer PDF → upload to survey-files → fill Flyer URL.
function renderSurveyFlyer() {
  const draft = activeSurveyDraft(); if (!draft) return;
  if (!surveyEditor.pending && !surveyEditor.saving) SurveyFlyers.inherit(draft,surveyEditor.buildingFlyers);
  const id = SurveyFlyers.identity(draft), mode = SurveyFlyers.mode(draft,surveyEditor.buildingFlyers);
  const url = draft.model.values.flyer_url, valid = SurveyFlyers.usableUrl(url);
  if (document.activeElement !== $('fFlyerUrl')) $('fFlyerUrl').value = url || '';
  $('fFlyerScope').value = id ? mode : 'space';
  $('fFlyerScope').querySelector('[value="building"]').disabled = !id;
  $('fFlyerScope').disabled = Boolean(surveyEditor.pending || surveyEditor.saving || !id);
  $('currentFlyerLink').classList.toggle('hidden',!valid);
  if (valid) $('currentFlyerLink').href = url; else $('currentFlyerLink').removeAttribute('href');
  $('btnRemoveFlyer').classList.toggle('hidden',!url);
  $('flyerScopeHint').textContent = id && mode === 'building' ? 'Attach once. New spaces here reuse this flyer.' : 'Flyer applies to this space only.';
  const choices = SurveyFlyers.candidates(draft,state.props);
  const shared = id && surveyEditor.buildingFlyers[id.key];
  if (SurveyFlyers.usableUrl(shared?.url) && !choices.some(x=>x.url===shared.url)) choices.unshift({url:shared.url,label:'Saved building flyer'});
  $('reuseFlyerRow').classList.toggle('hidden', Boolean(url) || !choices.length);
  $('fSavedFlyer').innerHTML = choices.map((x,i)=>`<option value="${i}">${esc(x.label)}</option>`).join('');
  $('fSavedFlyer')._choices = choices;
  $('btnForgetBuildingFlyer').classList.toggle('hidden', !shared);
  $('btnAttachFlyer').textContent = url ? 'Replace with open CoStar flyer (PDF)' : 'Attach open CoStar flyer (PDF)';
  $('screen-form').style.paddingBottom = (document.querySelector('.survey-footer').offsetHeight + 18) + 'px';
}
function setSurveyFlyer(url, name) {
  const draft = activeSurveyDraft(); if (!draft || surveyEditor.pending || surveyEditor.saving) return;
  draft.flyerRevision = (draft.flyerRevision || 0) + 1;
  draft.model.values.flyer_url = url; delete draft.flyerInherited;
  draft.flyerMode = $('fFlyerScope').value;
  if (draft.flyerMode === 'building') SurveyFlyers.remember(draft,surveyEditor.buildingFlyers,url,name);
  renderSurveyFlyer(); surveyDetailsIndicators(); queueSurveyDraft();
}
$('fFlyerScope').addEventListener('change',()=>{
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  d.flyerRevision = (d.flyerRevision || 0) + 1; d.flyerMode = $('fFlyerScope').value;
  delete d.flyerInherited;
  if (d.flyerMode === 'building' && d.model.values.flyer_url) SurveyFlyers.remember(d,surveyEditor.buildingFlyers,d.model.values.flyer_url);
  renderSurveyFlyer(); queueSurveyDraft();
});
$('btnReuseFlyer').addEventListener('click',()=>{
  const choice = $('fSavedFlyer')._choices?.[Number($('fSavedFlyer').value)];
  if (choice) setSurveyFlyer(choice.url,choice.label);
});
$('btnRemoveFlyer').addEventListener('click',()=>{
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  d.flyerMode = 'space'; d.flyerRevision = (d.flyerRevision || 0) + 1;
  delete d.flyerInherited; d.model.values.flyer_url = null;
  renderSurveyFlyer(); queueSurveyDraft();
});
$('btnForgetBuildingFlyer').addEventListener('click',()=>{
  const d = activeSurveyDraft(), id = SurveyFlyers.identity(d);
  if (!id || surveyEditor.pending || surveyEditor.saving) return;
  delete surveyEditor.buildingFlyers[id.key]; d.flyerMode = 'space'; delete d.flyerInherited;
  d.flyerRevision = (d.flyerRevision || 0) + 1;
  renderSurveyFlyer(); queueSurveyDraft(); toast('Building flyer reuse stopped. Existing attachments are kept.');
});
$('fFlyerUrl').addEventListener('blur',()=>{
  const d = activeSurveyDraft(); if (!d || surveyEditor.pending || surveyEditor.saving) return;
  if (SurveyFlyers.mode(d,surveyEditor.buildingFlyers) === 'building') SurveyFlyers.remember(d,surveyEditor.buildingFlyers,d.model.values.flyer_url);
  renderSurveyFlyer(); queueSurveyDraft();
});
new ResizeObserver(()=>{
  $('screen-form').style.paddingBottom = (document.querySelector('.survey-footer').offsetHeight + 18) + 'px';
}).observe(document.querySelector('.survey-footer'));
$("btnAttachFlyer").addEventListener("click", async () => {
  if (!state.survey) return showError($("formError"), "Pick a survey first.");
  if (surveyEditor.pending || surveyEditor.saving || surveyEditor.flyerUploads) return;
  const btn = $("btnAttachFlyer"), target = activeSurveyDraft(); if (!target) return;
  const bundle = surveyEditor.bundle, workspaceKey = surveyDraftKey(), accountId = state.accountId, surveyId = state.survey.id;
  const id = SurveyFlyers.identity(target), address = SurveyFlyers.addressKey(target.model.values);
  const mode = $('fFlyerScope').value, revision = target.flyerRevision || 0;
  hideError($("formError")); surveyEditor.flyerUploads++; setLoading(btn,true); syncSurveyLock();
  try {
    const res = await bg("ATTACH_FLYER", { surveyId }, { write: true });
    if (handleAuthFailure(res)) return;
    if (!res.ok) return showError($("formError"), res.error);
    if ((target.flyerRevision || 0) !== revision || SurveyFlyers.addressKey(target.model.values) !== address || SurveyFlyers.identity(target)?.key !== id?.key) {
      toast('Flyer uploaded; your newer attachment choice was kept.'); return;
    }
    target.model.values.flyer_url = res.url; target.flyerMode = mode;
    const sameWorkspace = accountId === state.accountId && surveyId === state.survey?.id;
    if (sameWorkspace) {
      if (mode === 'building') SurveyFlyers.remember(target,surveyEditor.buildingFlyers,res.url,res.name);
      surveyEditor.archives[bundle.key] = structuredClone(bundle);
      // A same-building sibling may have been opened during the upload.
      if (activeSurveyDraft()) renderSurveyFlyer();
      await persistSurveyDraft();
    } else {
      const stored = (await chrome.storage.local.get(workspaceKey))[workspaceKey] || {version:1,bundles:{}};
      stored.buildingFlyers ||= {};
      if (mode === 'building') SurveyFlyers.remember(target,stored.buildingFlyers,res.url,res.name);
      stored.bundles[bundle.key] = structuredClone(bundle); await chrome.storage.local.set({[workspaceKey]:stored});
    }
    toast(`Flyer attached: <strong>${esc(res.name)}</strong> — remember to Save`);
  } catch (error) {
    showError($('formError'),'Flyer could not be saved to the draft: ' + error.message);
  } finally {
    surveyEditor.flyerUploads--; setLoading(btn,false); syncSurveyLock(); renderSurveyFlyer();
  }
});

// ─── Survey browser ────────────────────────────────────────────────────────────

function availPillClass(v) {
  return "av-" + String(v || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

function renderBrowse() {
  $("browseTitle").textContent = state.survey ? state.survey.name : "Survey properties";
  const list = $("browseList"); hideError($("browseError"));
  $("browseEmpty").classList.toggle("hidden",state.props.length > 0);
  list.innerHTML = SurveySpaces.groupSurveySpaces(state.props).map(group => `${group.property.tenancy === 'MT' ? `<h3 class="browse-group">${esc(group.property.address)} · ${esc(group.property.city || '')} · ${group.spaces.length} space(s)</h3>` : ''}${group.spaces.map(p => `<div class="prop-row" data-id="${esc(p.id)}"><button type="button" class="prop-edit"><div class="prop-top"><div class="prop-addr">${esc(p.tenancy === 'MT' ? SurveySpaces.getSpaceLabel(p) : p.address)}</div><div class="prop-meta">${esc(p.tenancy === 'MT' ? p.suite_size || 'Size unknown' : p.building_sf == null ? 'Size unknown' : Number(p.building_sf).toLocaleString())}${(p.tenancy === 'MT' ? p.suite_size : p.building_sf) ? ' SF' : ''}</div></div><span class="field-hint">${esc([p.city,p.state,p.internal_status].filter(Boolean).join(' · '))} · Edit space →</span></button><div class="survey-choices" id="browse-availability-${esc(p.id)}" role="radiogroup" aria-label="Availability for ${esc(p.suite_number || p.address)}"></div></div>`).join('')}`).join('');
  list.querySelectorAll('.prop-row').forEach(node => {
    const row = state.props.find(p => p.id === node.dataset.id);
    node.querySelector('.prop-edit').addEventListener('click',() => { state.scraped = null; setupForm('update',row,{noSource:true}); });
    const choices = node.querySelector('.survey-choices');
    const options = [...AVAILABILITY_OPTIONS]; if (row.availability && !options.includes(row.availability)) options.push(row.availability);
    choices.innerHTML = options.map((value,i) => `<label class="survey-choice"><input type="radio" name="browse-${esc(row.id)}" value="${esc(value)}" ${value === row.availability ? 'checked' : ''} /><span>${esc(value)}</span></label>`).join('');
    choices.addEventListener('change', e => {
      // Selection opens the exact row's reviewed draft. Save uses durable scoped transport.
      state.scraped = null; setupForm('update',row,{noSource:true});
      if (surveyEditor.pending) return;
      $('fAvailability').value = e.target.value; $('fAvailability').dispatchEvent(new Event('change',{bubbles:true}));
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
  yardEdited: false,  // distinguishes intentional Unknown from an omitted scrape value
  siteFieldsEdited: {},
  propertyFieldsEdited: {},
  leaseAreaOrigin: null, // building default, source, saved or manual; never infer from equality
  propertyTypeEdited: false,
  propertyMode: "auto",
  propertyId: null,
  originalPropertyId: null,
  propertyChoiceBase: null,
  propertyCandidates: [],
  requestId: null,
  pendingSave: null,
  saving: false,
  lookupSequence: 0,
  pendingMatch: null, // best dedup candidate awaiting the user's choice
  lastFilled: {},     // input id → last auto-filled value (protects user edits on re-scan)
  unmappedSubmarket: null,
  saleHighlights: "",
  saleNotes: "",
  importedBlocks: { highlights: null, notes: null }, // exact text each checkbox dropped into Notes
};

const COMP_INPUT_IDS = [
  ...CompPropertyFields.fields.map(field => "comp_" + field),
  "comp_status", "comp_address", "comp_property_name", "comp_city", "comp_state", "comp_zip",
  "comp_sub_market", "comp_building_sf", "comp_land_area", "comp_yard_included",
  "comp_suite", "comp_partial_site_override", "comp_multi_tenant",
  "comp_sale_price", "comp_cap_rate", "comp_rent_psf",
  "comp_lease_format", "comp_listing_brokerage", "comp_listing_agent",
  "comp_listing_agent_phone", "comp_listing_agent_email", "comp_list_date", "comp_notes",
];

const COMP_FIELD_LABELS = {
  ...CompPropertyFields.labels,
  status: "status",
  address: "address",
  property_name: "property name",
  city: "city",
  state: "state",
  zip: "ZIP",
  sub_market: "submarket",
  submarket_cluster: "submarket cluster",
  property_type: "property type",
  building_sf: "building SF",
  land_area: "land acres",
  yard_included: "yard included",
  suite: "suite",
  partial_site_override: "portion of site",
  multi_tenant: "multi-tenant building",
  sale_price: "asking price",
  price_psf: "price/SF",
  cap_rate: "cap rate",
  sale_type: "deal type",
  rent_psf: "asking rent",
  lease_format: "lease format",
  listing_brokerage: "brokerage",
  listing_agent: "listing agent",
  listing_agent_phone: "agent phone",
  listing_agent_email: "agent email",
  list_date: "list date",
  notes: "notes",
  flyer_url: "flyer",
};

const COMP_DIRECTION_WORDS = new Set([
  "n", "s", "e", "w", "ne", "nw", "se", "sw",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
]);
const COMP_STREET_TYPE_WORDS = new Set([
  "street", "road", "avenue", "boulevard", "drive", "lane", "parkway",
  "highway", "court", "circle", "place", "terrace", "way",
]);

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

function syncCompFeatureChecks() {
  for (const field of [...CompPropertyFields.flags, 'yard_included']) {
    const node = $('comp_' + field); node.checked = node.value === 'true'; node.indeterminate = !node.value;
    $('comp_' + field + '_answer').textContent = !node.value ? 'Unknown' : node.checked ? 'Yes' : 'No';
  }
}
function setCompPropertyValue(field, value, source) {
  const node = $('comp_' + field);
  node.value = value == null ? '' : ['office_sf','lease_area'].includes(field) && typeof value === 'number' ? value.toLocaleString('en-US',{maximumFractionDigits:20}) : String(value);
  setCompFieldSource(node.id, value == null ? null : source);
}
function resetCompPropertyFields() {
  comp.propertyFieldsEdited = {};
  comp.leaseAreaOrigin = null;
  for (const field of CompPropertyFields.fields) setCompPropertyValue(field,null,null);
  syncCompFeatureChecks(); $('compPropertySource').classList.add('hidden');
}
function fillCompPropertyFields(d) {
  const capture = CompPropertyFields.fromScrape(d);
  if (comp.mode !== 'update') for (const field of CompPropertyFields.fields) {
    if (comp.propertyFieldsEdited[field]) continue;
    if (field === 'lease_area') {
      if (capture.values[field] != null) {
        setCompPropertyValue(field,capture.values[field],'CoStar'); comp.leaseAreaOrigin = 'source';
      }
      continue;
    }
    setCompPropertyValue(field,capture.values[field] ?? null,capture.sources?.[field] || 'CoStar');
  }
  const source = $('compPropertySource'); source.textContent = capture.unresolved.join(' · ');
  source.classList.toggle('hidden', !source.textContent); syncCompFeatureChecks();
}
function syncCompLeaseDefault() {
  const hint = $('compLeaseDefaultHint');
  if (!comp.pendingSave && !comp.saving && comp.mode !== 'update' && !comp.propertyFieldsEdited.lease_area && !['manual','source','saved'].includes(comp.leaseAreaOrigin)) {
    const eligible = compStatusShows().showLease && $('comp_multi_tenant').value !== 'true' && $('comp_partial_site_override').value !== 'true' && !comp.scrape?.selectedSpace;
    const parsed = CompPropertyFields.parse('lease_area',$('comp_building_sf').value);
    if (eligible && !parsed.error && parsed.value != null) {
      setCompPropertyValue('lease_area',parsed.value,'Building SF default'); comp.leaseAreaOrigin = 'building';
    } else if (comp.leaseAreaOrigin === 'building') {
      setCompPropertyValue('lease_area',null,null); comp.leaseAreaOrigin = null;
    }
  }
  hint.classList.toggle('hidden',comp.leaseAreaOrigin !== 'building');
}
function compPropertyValues() {
  return CompPropertyFields.serialize(Object.fromEntries(CompPropertyFields.fields.map(field=>[field,$('comp_'+field)?.value])));
}

// "73040" → "73,040" for display; parseNum() strips the commas back out on save.
function fmtThousands(v) {
  const n = parseNum(v);
  return n == null ? "" : n.toLocaleString("en-US");
}

function populateCompSubmarkets() {
  const select = $("comp_sub_market");
  if (!select || typeof SUBMARKET_TO_CLUSTER === "undefined") return;
  const current = select.value;
  select.innerHTML = `<option value="">Select a submarket</option>`;
  for (const submarket of Object.keys(SUBMARKET_TO_CLUSTER).sort()) {
    const option = document.createElement("option");
    option.value = submarket;
    option.textContent = submarket;
    select.appendChild(option);
  }
  if (current && SUBMARKET_TO_CLUSTER[current]) select.value = current;
}

function officialCompSubmarket(value) {
  const raw = String(value || "").trim();
  if (!raw || typeof SUBMARKET_TO_CLUSTER === "undefined") return "";
  if (SUBMARKET_TO_CLUSTER[raw]) return raw;
  const lower = raw.toLowerCase();
  return Object.keys(SUBMARKET_TO_CLUSTER).find((name) => name.toLowerCase() === lower) || "";
}

function setCompFieldSource(id, source) {
  const node = $(id);
  const label = node && node.closest(".fld") && node.closest(".fld").querySelector(":scope > label > span, :scope > span");
  if (!label) return;
  let badge = label.querySelector(".field-source");
  if (!source) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("small");
    badge.className = "field-source";
    badge.setAttribute('aria-hidden','true'); // provenance must not change the control's name
    label.appendChild(badge);
  }
  badge.textContent = source;
  badge.classList.toggle("edited", source === "Edited");
  badge.classList.toggle("derived", source === "Derived" || source === "Today");
}

function setCompSubmarket(value) {
  const select = $("comp_sub_market");
  const hint = $("compSubmarketHint");
  if (!select) return;
  const priorAutoValue = comp.lastFilled.comp_sub_market ?? "";
  if (select.value && select.value !== priorAutoValue) return;
  const official = officialCompSubmarket(value);
  comp.unmappedSubmarket = value && !official ? String(value).trim() : null;
  setCompField("comp_sub_market", official, official ? "CoStar" : null);
  if (hint) {
    if (comp.unmappedSubmarket) {
      hint.textContent = `CoStar reported “${comp.unmappedSubmarket}.” Choose an official submarket.`;
      hint.classList.add("warning");
      hint.classList.remove("hidden");
    } else {
      hint.textContent = "";
      hint.classList.remove("warning");
      hint.classList.add("hidden");
    }
  }
}

function renderCompContentImport() {
  const card = $("compContentImport");
  const highlightsOption = $("compHighlightsOption");
  const notesOption = $("compNotesOption");
  const highlightsPreview = $("compHighlightsPreview");
  const notesPreview = $("compSaleNotesPreview");
  const count = $("compImportCount");
  const highlightsCheck = $("compIncludeHighlights");
  const notesCheck = $("compIncludeSaleNotes");
  const hasHighlights = hasVal(comp.saleHighlights);
  const hasNotes = hasVal(comp.saleNotes);
  if (!card) return;

  card.classList.toggle("hidden", !hasHighlights && !hasNotes);
  if (highlightsOption) highlightsOption.classList.toggle("hidden", !hasHighlights);
  if (notesOption) notesOption.classList.toggle("hidden", !hasNotes);
  if (highlightsPreview) highlightsPreview.textContent = comp.saleHighlights;
  if (notesPreview) notesPreview.textContent = comp.saleNotes;
  if (count) {
    const available = Number(hasHighlights) + Number(hasNotes);
    count.textContent = `${available} found`;
  }
  if (!hasHighlights && highlightsCheck) highlightsCheck.checked = false;
  if (!hasNotes && notesCheck) notesCheck.checked = false;
}

// We save exactly what's in the Notes field — CoStar highlights/notes are dropped
// into that field when their box is checked (see applyCompImport), so they're editable.
function compNotesValue() {
  const v = (($("comp_notes") && $("comp_notes").value) || "").trim();
  return v || null;
}

function compImportBlock(which) {
  if (which === "highlights") return comp.saleHighlights ? `Sale Highlights\n${comp.saleHighlights}` : "";
  return comp.saleNotes ? `Sale Notes\n${comp.saleNotes}` : "";
}

// Checking a box drops the CoStar text into the editable Notes field; unchecking pulls
// that block back out (unless it was edited). What you see is what gets saved.
function applyCompImport(which, checked) {
  const ta = $("comp_notes");
  if (!ta) return;
  const block = compImportBlock(which);
  if (!block) return;
  let text = ta.value;
  const prev = comp.importedBlocks[which];
  if (checked) {
    if (!text.includes(block)) text = text.trim() ? `${text.trimEnd()}\n\n${block}` : block;
    comp.importedBlocks[which] = block;
  } else {
    const target = prev && text.includes(prev) ? prev : text.includes(block) ? block : null;
    if (target) text = text.split(target).join("").replace(/\n{3,}/g, "\n\n").trim();
    comp.importedBlocks[which] = null;
  }
  ta.value = text;
  syncCompImportSelection();
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

function compAddressParts(input) {
  const normalized = normalizeCompAddress(input);
  const tokens = normalized.split(" ").filter(Boolean);
  const streetNumber = /^\d+[a-z]?$/.test(tokens[0] || "") ? tokens.shift() : "";
  while (tokens.length && COMP_DIRECTION_WORDS.has(tokens[0])) tokens.shift();
  const streetName = tokens
    .filter((tok) => !COMP_DIRECTION_WORDS.has(tok) && !COMP_STREET_TYPE_WORDS.has(tok))
    .join(" ");
  return { normalized, streetNumber, streetName };
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

async function setAppMode(mode) {
  if (mode !== "comp" && mode !== "survey") return;
  if (!IS_EXTENSION_CONTEXT) return;
  try { await persistSurveyDraft(); } catch { return; }
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
  if (comp.pendingSave) {
    syncCompReviewState();
    return;
  }
  scanComp();
}

// ─── Field fill (never clobber a value the user edited) ──────────────────────────

function setCompField(id, value, source = "CoStar") {
  const node = $(id);
  if (!node) return;
  const v = value == null ? "" : String(value);
  const prev = comp.lastFilled[id] ?? "";
  const cur = node.value;
  const wasAutoFilled = Object.prototype.hasOwnProperty.call(comp.lastFilled, id);
  if (wasAutoFilled && cur !== "" && cur !== prev) return; // user edited this field — leave it
  if (v === "" && cur !== "") return;          // don't wipe a prior auto-value with an empty scrape
  node.value = v;
  comp.lastFilled[id] = v;
  setCompFieldSource(id, v ? source : null);
}

function resetCompForm() {
  if (comp.pendingSave || comp.saving) return;
  comp.lastFilled = {};
  resetCompPropertyFields();
  comp.mode = "insert";
  comp.updateId = null;
  comp.baseline = null;
  comp.yardEdited = false;
  comp.siteFieldsEdited = {};
  comp.propertyTypeEdited = false;
  comp.propertyMode = "auto";
  comp.propertyId = null;
  comp.originalPropertyId = null;
  comp.propertyChoiceBase = null;
  comp.propertyCandidates = [];
  comp.requestId = null;
  comp.lookupSequence += 1;
  comp.flyerUrl = null;
  comp.flyerName = null;
  comp.pendingMatch = null;
  comp.unmappedSubmarket = null;
  comp.saleHighlights = "";
  comp.saleNotes = "";
  comp.importedBlocks = { highlights: null, notes: null };
  hideCompMatch();
  COMP_INPUT_IDS.forEach((id) => {
    const n = $(id);
    if (n) n.value = "";
    setCompFieldSource(id, null);
    const wrap = n && n.closest(".fld");
    if (wrap) wrap.classList.remove("needs-review");
  });
  setNameToggle("toggleCompPropName", "fldCompPropertyName", false);
  compClearChecks("comp_ptypes");
  compClearChecks("comp_sale_types");
  const includeHighlights = $("compIncludeHighlights");
  const includeSaleNotes = $("compIncludeSaleNotes");
  if (includeHighlights) includeHighlights.checked = false;
  if (includeSaleNotes) includeSaleNotes.checked = false;
  renderCompContentImport();
  const hint = $("compSubmarketHint");
  if (hint) { hint.textContent = ""; hint.classList.add("hidden"); }
  const flyerState = $("compFlyerState");
  if (flyerState) flyerState.textContent = "No flyer attached";
  syncCompFeatureChecks();
  syncCompModeUI();
}

async function fillCompForm(d) {
  if (comp.pendingSave || comp.saving) return;
  d = d || {};
  // Navigating to a genuinely different CoStar record → clear the form and update state.
  const sourceKey = source => {
    const property = source?.listingId || source?.costarId || normalizeCompAddress(source?.street || "");
    return property ? JSON.stringify([property, source?.selectedSpace?.identity || null]) : '';
  };
  const newKey = sourceKey(d);
  const oldKey = sourceKey(comp.scrape);
  if (comp.scrape && newKey && newKey !== oldKey) resetCompForm();

  comp.scrape = d;
  comp.costarId = d.costarId || null;
  comp.sourceUrl = d.sourceUrl || null;
  comp.saleHighlights = d.saleHighlights || "";
  comp.saleNotes = d.saleNotes || "";

  setCompField("comp_address", d.street);
  setCompField("comp_property_name", d.street); // default = address; Max renames as needed
  setCompField("comp_city", d.city);
  setCompField("comp_state", d.state);
  setCompField("comp_zip", d.zip);
  setCompSubmarket(d.submarket);
  setCompField("comp_building_sf", fmtThousands(d.rba));
  setCompField("comp_land_area", d.acLot);
  if (d.selectedSpace?.suite) setCompField("comp_suite", d.selectedSpace.suite);
  fillCompPropertyFields(d);
  // Yard describes this offered space/site. CoStar acreage, property class, and
  // the separate survey yard_area flag do not establish whether yard is included.
  // Leave the current answer alone on re-read; resetCompForm defaults new offers to Unknown.
  setCompField("comp_sale_price", fmtThousands(d.salePrice));
  setCompField("comp_cap_rate", d.capRate);
  setCompField("comp_rent_psf", d.leaseRate); // already $/SF/month for Phoenix industrial
  setCompField("comp_lease_format", mapLeaseFormat(d.leaseType));
  setCompField("comp_status", defaultCompStatus(d), "Derived");
  setCompField("comp_list_date", todayISO(), "Today");

  // Notes stay blank — Max adds his own. (Dedup relies on address matching and the
  // CoStar-ID stamps that older comps carry in notes; new comps aren't stamped.)

  syncNameToggle("toggleCompPropName", "fldCompPropertyName", "comp_property_name", "comp_address");
  renderCompContentImport();
  syncCompFieldVisibility();
  await runCompDedup(d);
  syncCompReviewState();
}

// Show only the economics that match the status: sale statuses hide the lease
// fields, lease statuses hide the sale fields; FOR SALE/LEASE shows both.
function compStatusShows() {
  const status = ($("comp_status") && $("comp_status").value) || "FOR SALE";
  const showSale = status !== "FOR LEASE" && status !== "PENDING LEASE";
  const showLease = status === "FOR LEASE" || status === "FOR SALE/LEASE" || status === "PENDING LEASE";
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
  toggle("comp_lease_area", showLease);
  toggle("comp_lease_format", showLease);
  const saleTypes = $("comp_sale_types_wrap");
  if (saleTypes) saleTypes.classList.toggle("hidden", !showSale);
  syncCompReviewState();
}

function setCompNeedsReview(id, needsReview) {
  const node = $(id);
  const wrap = node && node.closest(".fld");
  if (!wrap) return;
  wrap.classList.toggle("needs-review", !!needsReview);
  if (needsReview) node.setAttribute("aria-invalid", "true");
  else node.removeAttribute("aria-invalid");
}

function compMissingFields() {
  const missing = [];
  const { showSale, showLease } = compStatusShows();
  const value = (id) => {
    const node = $(id);
    return node ? String(node.value || "").trim() : "";
  };
  if (!value("comp_address")) missing.push({ id: "comp_address", label: "address" });
  if (!value("comp_sub_market")) missing.push({ id: "comp_sub_market", label: "submarket" });
  if (!value("comp_building_sf") && !value("comp_land_area")) {
    missing.push({ id: "comp_building_sf", label: "building SF or land acres" });
  }
  if (showSale && !value("comp_sale_price")) missing.push({ id: "comp_sale_price", label: "asking price" });
  if (showLease && !value("comp_rent_psf")) missing.push({ id: "comp_rent_psf", label: "asking rent" });
  return missing;
}

function compChangedFieldLabels() {
  if (comp.mode !== "update" || !comp.baseline) return [];
  const patch = compUpdatePatch(compFormRecord());
  return [...new Set(Object.keys(patch)
    .filter((key) => key !== "last_verified_at")
    .map((key) => COMP_FIELD_LABELS[key] || key.replaceAll("_", " ")))];
}

function syncCompModeUI() {
  const title = $("compTitle");
  const save = $("compSave");
  const note = $("compModeNote");
  const isUpdate = comp.mode === "update" && comp.updateId;
  if (title) title.textContent = isUpdate ? "Update comp" : "New comp";
  if (save) save.textContent = comp.saving ? "Saving…" : comp.pendingSave ? "Retry pending save" : isUpdate ? "Update comp" : "Save comp";
  renderCompPropertyLink();
  if (!note) return;
  if (!isUpdate) {
    note.classList.add("hidden");
    note.textContent = "";
    return;
  }
  const changed = compChangedFieldLabels();
  note.innerHTML = `<strong>Updating ${esc((comp.baseline && comp.baseline.address) || "existing comp")}</strong><br>` +
    (changed.length
      ? `Will change: ${esc(changed.join(", "))}.`
      : "No field changes yet; saving will refresh the verified date.");
  note.classList.remove("hidden");
}

function syncCompReviewState() {
  syncCompFeatureChecks();
  syncCompLeaseDefault();
  const tracked = ["comp_address", "comp_sub_market", "comp_building_sf", "comp_sale_price", "comp_rent_psf"];
  tracked.forEach((id) => setCompNeedsReview(id, false));
  const missing = compMissingFields();
  missing.forEach((item) => setCompNeedsReview(item.id, true));
  const summary = $("compCompleteness");
  if (summary) {
    summary.classList.toggle("ready", missing.length === 0);
    summary.classList.toggle("warning", missing.length > 0);
    summary.textContent = missing.length === 0
      ? "Ready to save"
      : `${missing.length} field${missing.length === 1 ? "" : "s"} to review`;
    summary.title = missing.length ? `Missing ${missing.map((item) => item.label).join(", ")}` : "";
  }
  const save = $("compSave");
  const blocksSave = missing.some((item) => item.id === "comp_address" || item.id === "comp_sub_market");
  if (save) {
    save.disabled = comp.saving || (!comp.pendingSave && blocksSave) || !IS_EXTENSION_CONTEXT;
    save.title = !IS_EXTENSION_CONTEXT
      ? "Open this panel from the installed extension to save a comp"
      : blocksSave ? "Address and an official submarket are required" : "";
  }
  syncCompModeUI();
}

function markCompFieldEdited(id) {
  const node = $(id);
  if (!node) return;
  if (id === "comp_notes") {
    syncCompImportSelection();
    return;
  }
  if (CompPropertyFields.fields.includes(id.slice(5))) {
    const field = id.slice(5); comp.propertyFieldsEdited[field] = true;
    if (CompPropertyFields.flags.includes(field)) { node.value = String(node.checked); syncCompFeatureChecks(); }
    if (!CompPropertyFields.parse(field,node.value).error) setCompNeedsReview(id,false);
  }
  if (id === "comp_yard_included") { comp.yardEdited = true; node.value = String(node.checked); }
  if (id === "comp_lease_area") comp.leaseAreaOrigin = 'manual';
  if (["comp_suite", "comp_multi_tenant", "comp_partial_site_override"].includes(id)) comp.siteFieldsEdited[id.slice(5)] = true;
  if (["comp_address", "comp_city", "comp_state"].includes(id) && !comp.pendingSave && comp.propertyCandidates.length) cancelCompPropertyChoice();
  setCompFieldSource(id, id === "comp_yard_included" || String(node.value || "").trim() ? "Edited" : null);
  if (id === "comp_sub_market") {
    comp.unmappedSubmarket = null;
    const hint = $("compSubmarketHint");
    if (hint) { hint.textContent = ""; hint.classList.add("hidden"); }
  }
  syncCompReviewState();
}

function syncCompImportSelection() {
  const manual = (($("comp_notes") && $("comp_notes").value) || "").trim();
  const importsSelected =
    ($("compIncludeHighlights") && $("compIncludeHighlights").checked) ||
    ($("compIncludeSaleNotes") && $("compIncludeSaleNotes").checked);
  const source = manual && importsSelected
    ? "Edited + CoStar"
    : importsSelected ? "CoStar selected" : manual ? "Edited" : null;
  setCompFieldSource("comp_notes", source);
  syncCompReviewState();
}

// ─── Scrape ──────────────────────────────────────────────────────────────────────

async function scanComp(opts = {}) {
  if (comp.pendingSave || comp.saving) return;
  setCompMsg("Reading CoStar…");
  // As in the survey flow: CoStar's SPA updates the URL before the content re-renders,
  // so on a record change we retry until the street is non-empty and has actually changed.
  const awaitChange = opts.awaitChangeFromStreet || null;
  let d = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await bg("READ_COSTAR");
    if (!res || !res.ok) { setCompMsg((res && res.error) || "Couldn't read the CoStar page.", true); return; }
    d = res.data || {};
    if (!awaitChange) break;
    if (d.street && d.street !== awaitChange) break;
    await sleep(600);
  }
  await fillCompForm(d);
  if (comp.lookupError) return setCompMsg(comp.lookupError, true);
  if (!($("comp_address") && $("comp_address").value.trim())) {
    setCompMsg("Couldn't read an address off the CoStar page — check the fields.", true);
  } else {
    setCompMsg("");
  }
}

// ─── Dedup (client-side scoring against SEARCH_COMPS candidates) ──────────────────

async function runCompDedup(d) {
  const sequence = ++comp.lookupSequence;
  comp.lookupError = null;
  hideCompMatch();
  const street = d.street || "";
  const targetParts = compAddressParts(street);
  const streetNumber = targetParts.streetNumber;
  const streetToken = (targetParts.streetName.split(" ")[0] || "").trim();
  if (!streetNumber && !streetToken && !d.costarId) return;

  const res = await bg("SEARCH_COMPS", { streetNumber, streetToken, costarId: d.costarId || null, city: d.city || "", state: d.state || "" });
  if (sequence !== comp.lookupSequence || comp.pendingSave || comp.saving) return;
  if (!res || !res.ok) {
    comp.lookupError = "Could not check existing deals. Re-read to retry. Your selected deal and property link are kept.";
    return;
  }

  let best = null, bestScore = 0, bestReason = "";
  for (const c of (res.comps || [])) {
    const candidateParts = compAddressParts(c.address);
    const cityConflict = d.city && c.city && d.city.trim().toLowerCase() !== c.city.trim().toLowerCase();
    const stateConflict = d.state && c.state && d.state.trim().toLowerCase() !== c.state.trim().toLowerCase();
    const zipConflict = d.zip && c.zip && String(d.zip).trim() !== String(c.zip).trim();
    const locationConflict = cityConflict || stateConflict || zipConflict;
    const cityMatch = d.city && c.city && d.city.trim().toLowerCase() === c.city.trim().toLowerCase();
    const zipMatch = d.zip && c.zip && String(d.zip).trim() === String(c.zip).trim();
    let score = 0;
    let reason = "";
    if (!locationConflict && /^\d+$/.test(String(d.costarId || "")) && new RegExp(`CoStar ID: ${d.costarId}\\b`).test(c.notes || "")) {
      score = 100;
      reason = "Same CoStar property ID";
    } else if (!locationConflict && targetParts.normalized &&
      candidateParts.normalized === targetParts.normalized) {
      score = zipMatch || cityMatch ? 96 : 92;
      reason = zipMatch ? "Exact address and ZIP match" : "Exact normalized address match";
    } else if (!locationConflict && streetNumber && targetParts.streetName &&
      candidateParts.streetNumber === streetNumber &&
      candidateParts.streetName === targetParts.streetName) {
      score = zipMatch || cityMatch ? 86 : 76;
      reason = zipMatch ? "Same street address and ZIP" : "Same street number and name";
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
      bestReason = reason;
    }
  }
  if (best && bestScore >= 76) showCompMatch(best, { score: bestScore, reason: bestReason });
  else comp.pendingMatch = null;
}

function showCompMatch(candidate, match = {}) {
  comp.pendingMatch = candidate;
  const banner = $("compMatch");
  if (!banner) return;
  const status = candidate.status
    ? `<span class="comp-match-status">${esc(candidate.status)}</span>`
    : "";
  banner.innerHTML =
    `<div class="comp-match-head">` +
      `<div class="comp-match-copy">` +
        `<span class="comp-match-kicker">Another deal at this address</span>` +
        `<strong class="comp-match-address">${esc(candidate.address)}</strong>` +
        `<span class="comp-match-reason">${esc(match.reason || "Address match")} · match score ${Number(match.score || 0)}</span>` +
      `</div>${status}` +
    `</div>` +
    `<p class="field-hint">Update only if this is the same deal. A new suite, sale, or lease gets its own deal under the same property.</p>` +
    `<div class="comp-match-actions">` +
      `<button type="button" id="compMatchView">View existing</button>` +
      `<button type="button" id="compMatchUpdate" class="primary">Update this comp</button>` +
      `<button type="button" id="compMatchNew">Save a separate deal</button>` +
    `</div>`;
  banner.classList.remove("hidden");
  const view = $("compMatchView"), upd = $("compMatchUpdate"), neu = $("compMatchNew");
  if (view) view.addEventListener("click", () =>
    chrome.tabs.create({ url: `${CONFIG.APP_URL}/comps/${candidate.id}` }));
  if (upd) upd.addEventListener("click", () => enterCompUpdate(candidate));
  if (neu) neu.addEventListener("click", () => {
    if (comp.mode === "update" || !comp.yardEdited) {
      $("comp_yard_included").value = "";
      comp.yardEdited = false;
      setCompFieldSource("comp_yard_included", null);
    }
    if (comp.mode === "update") {
      for (const field of ["suite", "partial_site_override", "multi_tenant"]) $("comp_" + field).value = "";
      comp.siteFieldsEdited = {};
    }
    if (comp.mode === "update") resetCompPropertyFields();
    comp.mode = "insert";
    comp.updateId = null;
    comp.baseline = null;
    comp.requestId = null;
    comp.originalPropertyId = null;
    comp.propertyMode = "auto";
    comp.propertyId = null;
    cancelCompPropertyChoice(false);
    hideCompMatch();
    syncCompReviewState();
  });
}

function hideCompMatch() {
  const b = $("compMatch");
  if (b) { b.classList.add("hidden"); b.innerHTML = ""; }
}

function enterCompUpdate(candidate) {
  if (comp.pendingSave || comp.saving) return;
  const sameDeal = comp.mode === "update" && comp.updateId === candidate.id;
  if (comp.updateId && !sameDeal) comp.propertyTypeEdited = false;
  if (!comp.propertyTypeEdited) {
    const types = CompPropertyFields.normalizePropertyTypes(candidate.property_type);
    $('comp_ptypes').querySelectorAll('input').forEach(n=>{n.checked=types.includes(n.value);});
  }
  if (comp.updateId && !sameDeal) comp.propertyFieldsEdited = {};
  for (const field of CompPropertyFields.fields) if (!comp.propertyFieldsEdited[field]) setCompPropertyValue(field,CompPropertyFields.rowValue(candidate,field),'Saved');
  if (!comp.propertyFieldsEdited.lease_area) comp.leaseAreaOrigin = 'saved';
  syncCompFeatureChecks();
  if (!sameDeal || comp.originalPropertyId === undefined || (Object.hasOwn(candidate, "property_id") && candidate.property_id !== comp.originalPropertyId)) {
    comp.requestId = null;
    comp.siteFieldsEdited = {};
    comp.propertyMode = candidate.property_id ? "preserve" : "auto";
    comp.propertyId = candidate.property_id || null;
    // Undefined means the lookup did not return identity. Saving must not treat it as null.
    comp.originalPropertyId = candidate.property_id;
    cancelCompPropertyChoice(false);
  }
  for (const field of ["suite", "partial_site_override", "multi_tenant"]) {
    if (comp.siteFieldsEdited[field]) continue;
    const node = $("comp_" + field);
    if (node) node.value = candidate[field] == null ? "" : String(candidate[field]);
  }
  // Switching DB rows starts a new answer; re-reading the same offer preserves
  // deliberate edits, including an explicitly selected Unknown (empty option).
  if (comp.updateId && comp.updateId !== candidate.id) comp.yardEdited = false;
  if (!comp.yardEdited) {
    const yard = $("comp_yard_included");
    if (yard) yard.value = typeof candidate.yard_included === "boolean" ? String(candidate.yard_included) : "";
    setCompFieldSource("comp_yard_included", typeof candidate.yard_included === "boolean" ? "Saved" : null);
  }
  comp.mode = "update";
  comp.updateId = candidate.id;
  comp.baseline = sameDeal ? { ...candidate, property_id: comp.originalPropertyId } : candidate;
  // Keep the comp's saved name — otherwise the scrape default (the address) would
  // look "changed" vs the baseline and the patch would overwrite a custom name.
  if (candidate.property_name) {
    const nameInput = $("comp_property_name");
    if (nameInput) { nameInput.value = candidate.property_name; setCompFieldSource("comp_property_name", null); }
    syncNameToggle("toggleCompPropName", "fldCompPropertyName", "comp_property_name", "comp_address");
  }
  hideCompMatch();
  setCompMsg("");
  syncCompReviewState();
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
    ...compPropertyValues().values,
    address: ($("comp_address") && $("comp_address").value.trim()) || "",
    property_name: txt("comp_property_name"),
    city: txt("comp_city"),
    state: txt("comp_state"),
    zip: txt("comp_zip"),
    sub_market: txt("comp_sub_market"),
    // Cluster is derived, never typed: recomputed from whatever submarket is on the form.
    submarket_cluster: (typeof SUBMARKET_TO_CLUSTER !== "undefined" &&
      SUBMARKET_TO_CLUSTER[(txt("comp_sub_market") || "")]) || null,
    property_type: CompPropertyFields.normalizePropertyTypes(compChecked("comp_ptypes")).join(", ") || null,
    building_sf: buildingSf,
    land_area: num("comp_land_area"),
    suite: txt("comp_suite"),
    partial_site_override: txt("comp_partial_site_override") === "true" ? true : txt("comp_partial_site_override") === "false" ? false : null,
    multi_tenant: txt("comp_multi_tenant") === "true" ? true : txt("comp_multi_tenant") === "false" ? false : null,
    yard_included: txt("comp_yard_included") === "true" ? true : txt("comp_yard_included") === "false" ? false : null,
    sale_price: salePrice,
    price_psf: (salePrice != null && buildingSf) ? Math.round((salePrice / buildingSf) * 100) / 100 : null,
    cap_rate: showSale ? num("comp_cap_rate") : null,
    sale_type: showSale ? (compChecked("comp_sale_types").join(", ") || null) : null,
    rent_psf: showLease ? num("comp_rent_psf") : null,
    lease_format: showLease ? (($("comp_lease_format") && $("comp_lease_format").value) || null) : null,
    status,
    internal_deal: false,
    source: "costar",
    listing_brokerage: txt("comp_listing_brokerage"),
    listing_agent: txt("comp_listing_agent"),
    listing_agent_phone: txt("comp_listing_agent_phone"),
    listing_agent_email: txt("comp_listing_agent_email"),
    list_date: txt("comp_list_date"),
    notes: compNotesValue(),
    last_verified_at: new Date().toISOString(),
  };
  if (comp.flyerUrl) rec.flyer_url = comp.flyerUrl;
  return rec;
}

// Update PATCH: non-empty changes, plus an explicitly edited yard answer (including Unknown).
// Always re-verify (last_verified_at); include flyer_url only if newly attached.
function compUpdatePatch(rec) {
  const base = comp.baseline || {};
  const skip = new Set(["last_verified_at", "flyer_url", "internal_deal", "source", "yard_included", "property_id", "suite", "partial_site_override", "multi_tenant"]);
  const patch = {};
  skip.add('property_type'); skip.add('clear_height_ft');
  if (comp.propertyTypeEdited && Object.hasOwn(rec,'property_type') && (base.property_type ?? null) !== rec.property_type) patch.property_type = rec.property_type;
  for (const field of CompPropertyFields.fields) {
    skip.add(field);
    if (field === 'clear_height') {
      if (comp.propertyFieldsEdited?.[field] && Object.hasOwn(rec,field) && ((base[field] ?? null) !== rec[field] || (base.clear_height_ft ?? null) !== rec.clear_height_ft)) {
        patch.clear_height = rec.clear_height; patch.clear_height_ft = rec.clear_height_ft;
      }
    } else if (comp.propertyFieldsEdited?.[field] && Object.hasOwn(rec,field) && (base[field] ?? null) !== rec[field]) patch[field] = rec[field];
  }
  for (const field of ["suite", "partial_site_override", "multi_tenant"]) {
    if (comp.siteFieldsEdited?.[field] && (base[field] ?? null) !== rec[field]) patch[field] = rec[field];
  }
  if (comp.yardEdited && (rec.yard_included === null || typeof rec.yard_included === "boolean") &&
      (base.yard_included ?? null) !== rec.yard_included) {
    patch.yard_included = rec.yard_included;
  }
  for (const [k, v] of Object.entries(rec)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === "") continue; // never blank out a DB value
    if (String(base[k] ?? "") !== String(v)) patch[k] = v;
  }
  patch.last_verified_at = rec.last_verified_at;
  if (comp.flyerUrl) patch.flyer_url = comp.flyerUrl;
  return patch;
}

const COMP_PENDING_SAVE_KEY = "comp_pending_property_save_v1";

function compPendingSaveKey() {
  return `${COMP_PENDING_SAVE_KEY}:${String(state.email || "").toLowerCase()}`;
}

function renderCompPropertyLink() {
  const status = $("compPropertyStatus");
  if (!status) return;
  const linkedId = comp.propertyMode === "skip" ? null : comp.propertyId || comp.originalPropertyId;
  const isUpdate = comp.mode === "update" && comp.updateId;
  status.textContent = comp.pendingSave
    ? "Save response not yet confirmed. Retry the same request to finish safely."
    : comp.propertyMode === "skip"
      ? (comp.originalPropertyId ? "Unlinked after this save — you chose to remove the property link." : "Unlinked — you chose to skip the property link.")
      : linkedId
        ? (comp.propertyMode === "auto" ? "Property change pending — will find its property on save. Current link stays until save succeeds." : comp.propertyMode === "preserve" ? "Property linked — existing link will be kept." : "Property selected — will link when saved.")
        : "Unlinked — will link automatically when saved.";
  const open = $("compOpenProperty");
  open.classList.toggle("hidden", !linkedId);
  if (linkedId) open.href = `${CONFIG.APP_URL}/properties/${encodeURIComponent(linkedId)}`;
  else open.removeAttribute("href");
  $("compSkipProperty").checked = comp.propertyMode === "skip";
  $("compChangeProperty").classList.toggle("hidden", !linkedId || !!comp.pendingSave);
  $("compKeepProperty").classList.toggle("hidden", !comp.originalPropertyId || comp.propertyMode === "preserve" || !!comp.pendingSave);
  $("compNewDeal").classList.toggle("hidden", !isUpdate || !!comp.pendingSave);
  $("compPropertyChoices").classList.toggle("hidden", !comp.propertyChoiceBase);
  $("compFindProperty").classList.toggle("hidden", !comp.propertyChoiceBase || comp.propertyCandidates.length > 0);
  $("compUseProperty").classList.toggle("hidden", comp.propertyCandidates.length === 0);
  $("compCreateProperty").classList.toggle("hidden", comp.propertyCandidates.length === 0);
}

function closeCompPropertyChoice() {
  comp.propertyChoiceBase = null;
  comp.propertyCandidates = [];
  $("compPropertyCandidates").replaceChildren();
  renderCompPropertyLink();
}

function cancelCompPropertyChoice(restore = true) {
  if (restore && comp.propertyChoiceBase) {
    comp.propertyMode = comp.propertyChoiceBase.mode;
    comp.propertyId = comp.propertyChoiceBase.id;
  }
  closeCompPropertyChoice();
}

function showCompPropertyChoice(result, before) {
  comp.propertyChoiceBase = before;
  comp.propertyCandidates = Array.isArray(result.candidates) ? result.candidates : [];
  const message = $("compPropertyChoiceMessage");
  message.textContent = result.message || "More than one property could match. Choose the building/site for this deal.";
  const list = $("compPropertyCandidates");
  list.replaceChildren();
  comp.propertyCandidates.forEach((candidate, index) => {
    const row = document.createElement("div");
    row.className = "comp-property-candidate";
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "comp_property_candidate";
    radio.value = candidate.id;
    radio.id = `comp-property-candidate-${index}`;
    const text = document.createElement("span");
    text.textContent = [candidate.address, candidate.city, candidate.state].filter(Boolean).join(", ");
    const facts = document.createElement("small");
    facts.textContent = [candidate.building_sf ? `${Number(candidate.building_sf).toLocaleString()} building SF` : "Building SF unknown", candidate.land_area ? `${candidate.land_area} acres` : "Site acreage unknown"].join(" · ");
    text.appendChild(facts);
    label.append(radio, text);
    const open = document.createElement("a");
    open.href = `${CONFIG.APP_URL}/properties/${encodeURIComponent(candidate.id)}`;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open Property →";
    row.append(label, open);
    list.appendChild(row);
  });
  $("compUseProperty").disabled = comp.propertyCandidates.length === 0;
  renderCompPropertyLink();
  message.focus();
}

function setCompSaveLocked(locked) {
  document.querySelectorAll("#screen-comp input, #screen-comp select, #screen-comp textarea, #screen-comp button").forEach((node) => {
    if (node.id === "compSave") return;
    if (locked) {
      if (node.dataset.saveDisabled === undefined) node.dataset.saveDisabled = String(node.disabled);
      node.disabled = true;
    } else if (node.dataset.saveDisabled !== undefined) {
      node.disabled = node.dataset.saveDisabled === "true";
      delete node.dataset.saveDisabled;
    }
  });
  syncCompReviewState();
}

function compDraftSnapshot() {
  return {
    fields: Object.fromEntries(COMP_INPUT_IDS.map((id) => [id, $(id)?.value || ""])),
    propertyTypes: compChecked("comp_ptypes"), saleTypes: compChecked("comp_sale_types"),
    baseline: comp.baseline, originalPropertyId: comp.originalPropertyId,
    propertyMode: comp.propertyMode, propertyId: comp.propertyId,
    yardEdited: comp.yardEdited, siteFieldsEdited: comp.siteFieldsEdited, propertyFieldsEdited: comp.propertyFieldsEdited,
    propertyTypeEdited: comp.propertyTypeEdited,
    leaseAreaOrigin: comp.leaseAreaOrigin,
    costarId: comp.costarId, sourceUrl: comp.sourceUrl, flyerUrl: comp.flyerUrl,
  };
}

async function restorePendingCompSave() {
  if (comp.pendingSave && comp.pendingSave.email !== state.email) {
    comp.pendingSave = null;
    setCompSaveLocked(false);
    resetCompForm();
  }
  if (comp.pendingSave) return;
  const stored = await chrome.storage.local.get([compPendingSaveKey()]);
  const pending = stored[compPendingSaveKey()];
  if (!pending || pending.email !== state.email || !pending.request?.p_request_id) return;
  comp.pendingSave = pending;
  comp.requestId = pending.request.p_request_id;
  comp.mode = pending.request.p_comp_id ? "update" : "insert";
  comp.updateId = pending.request.p_comp_id;
  const draft = pending.draft || {};
  for (const [id, value] of Object.entries(draft.fields || {})) {
    const node=$(id === 'comp_clear_height_ft' ? 'comp_clear_height' : id); if(node)node.value=value;
  }
  for (const [container, values] of [["comp_ptypes", draft.propertyTypes], ["comp_sale_types", draft.saleTypes]]) {
    const choices = container === 'comp_ptypes' ? CompPropertyFields.normalizePropertyTypes(values) : values || [];
    $(container).querySelectorAll("input").forEach((input) => { input.checked = choices.includes(input.value); });
  }
  comp.propertyTypeEdited = draft.propertyTypeEdited || false;
  for (const field of ["baseline", "originalPropertyId", "propertyMode", "propertyId", "yardEdited", "siteFieldsEdited", "propertyFieldsEdited", "leaseAreaOrigin", "costarId", "sourceUrl", "flyerUrl"]) {
    if (Object.hasOwn(draft, field)) comp[field] = draft[field];
  }
  if (comp.propertyFieldsEdited?.clear_height_ft) comp.propertyFieldsEdited.clear_height = true;
  syncCompFeatureChecks();
  setCompSaveLocked(true);
  setCompMsg("A previous save has no confirmed response. Retry pending save to recover it without creating a duplicate.", true);
}

function buildCompSaveRequest(rec) {
  const isUpdate = comp.mode === "update" && comp.updateId;
  if (isUpdate && comp.originalPropertyId === undefined) throw new Error("The existing deal's property link could not be loaded. Re-read and choose Update this comp again before saving.");
  const propertyFacts = /^\d+$/.test(comp.costarId || "") ? { costar_property_id: comp.costarId } : {};
  return {
    p_comp: isUpdate ? compUpdatePatch(rec) : rec,
    p_request_id: comp.requestId || (comp.requestId = crypto.randomUUID()),
    p_comp_id: isUpdate ? comp.updateId : null,
    p_property_mode: comp.propertyMode,
    p_property_id: comp.propertyMode === "existing" ? comp.propertyId : null,
    p_expected_property_id: isUpdate ? comp.originalPropertyId : null,
    // Form sizes describe the deal, not confirmed building/site totals.
    p_property_facts: propertyFacts,
  };
}

async function saveComp() {
  if (comp.saving) return;
  const rec = compFormRecord();
  if (!comp.pendingSave) {
    const issue = compPropertyValues().issues[0];
    if (issue) { setCompNeedsReview('comp_'+issue.field,true); $('comp_'+issue.field).focus(); return setCompMsg(issue.message,true); }
    if (!rec.address) return setCompMsg("Address is required.", true);
    if (!rec.sub_market || !SUBMARKET_TO_CLUSTER[rec.sub_market]) return setCompMsg("Choose an official submarket before saving.", true);
  }
  const before = comp.propertyChoiceBase || { mode: comp.propertyMode, id: comp.propertyId };
  const wasUpdate = comp.mode === "update";
  comp.saving = true;
  setCompMsg("");
  setCompSaveLocked(true);
  let res;
  try {
    if (!comp.pendingSave) {
      const pending = { email: state.email, request: buildCompSaveRequest(rec), draft: compDraftSnapshot() };
      // Persist before starting the write. A worker suspension or closed panel can
      // replay this exact request; failure to persist must prevent the write.
      await chrome.storage.local.set({ [compPendingSaveKey()]: pending });
      comp.pendingSave = pending;
    }
    res = await bg("SAVE_COMP", { request: comp.pendingSave.request }, { write: true });
    if (res?.saveRejected || res?.status === "needs_choice" || (res?.ok && res?.status === "saved" && res?.comp?.id && Object.hasOwn(res.comp, "property_id"))) {
      await chrome.storage.local.remove([compPendingSaveKey()]);
      comp.pendingSave = null;
    }
  } catch (error) {
    res = { ok: false, error: error.message };
  } finally {
    comp.saving = false;
    setCompSaveLocked(!!comp.pendingSave);
  }
  if (handleAuthFailure(res)) return;
  if (!res || !res.ok) {
    const suffix = comp.pendingSave ? " Retry pending save to confirm the result safely." : "";
    return setCompMsg(((res && res.error) || "Save failed.") + suffix, true);
  }
  if (res.status === "needs_choice") {
    showCompPropertyChoice(res, before);
    return setCompMsg("Choose a property above, or intentionally skip its link. No deal has been saved yet.");
  }
  if (res.status !== "saved" || !res.comp?.id || !Object.hasOwn(res.comp, "property_id")) return setCompMsg("Save response was incomplete. Retry pending save to confirm safely.", true);

  // The response is authoritative, including the existing/new property ID. Keep
  // this saved deal selected so a second click updates it instead of inserting again.
  const saved = res.comp;
  comp.mode = "update";
  comp.updateId = saved.id;
  comp.baseline = saved;
  comp.originalPropertyId = saved.property_id ?? null;
  comp.propertyId = saved.property_id ?? null;
  comp.propertyMode = saved.property_id ? "preserve" : "skip";
  comp.requestId = null;
  comp.yardEdited = false;
  comp.siteFieldsEdited = {};
  for (const id of COMP_INPUT_IDS) {
    const field = id.slice(5);
    if (Object.hasOwn(saved, field) && $(id)) $(id).value = saved[field] == null ? "" : String(saved[field]);
  }
  for (const field of CompPropertyFields.fields) if (Object.hasOwn(saved,field) || (field==='clear_height' && Object.hasOwn(saved,'clear_height_ft'))) setCompPropertyValue(field,CompPropertyFields.rowValue(saved,field),'Saved');
  comp.propertyFieldsEdited = {}; comp.leaseAreaOrigin = 'saved'; syncCompFeatureChecks();
  comp.propertyTypeEdited = false;
  closeCompPropertyChoice();
  syncCompReviewState();
  setCompMsg(wasUpdate ? "Comp updated ✓ (re-verified today)" : "Comp saved ✓");
  const link = document.createElement("a");
  link.href = `${CONFIG.APP_URL}/comps/${encodeURIComponent(saved.id)}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "View comp →";
  $("compMsg").append(" ", link);
}

// ─── Comp-mode wiring (guarded — panel.html owns these elements) ──────────────────

function initCompMode() {
  populateCompSubmarkets();
  syncCompFeatureChecks();
  document.querySelectorAll('[data-clear-comp-feature]').forEach(button => button.addEventListener('click', () => {
    if (comp.saving || comp.pendingSave) return;
    const field=button.dataset.clearCompFeature;
    if (field === 'yard_included') comp.yardEdited = true;
    else comp.propertyFieldsEdited[field]=true;
    setCompPropertyValue(field,null,'Edited'); syncCompFeatureChecks(); syncCompReviewState();
  }));
  $("compSkipProperty").addEventListener("change", () => {
    const skip = $("compSkipProperty").checked;
    cancelCompPropertyChoice();
    comp.propertyMode = skip ? "skip" : comp.originalPropertyId ? "preserve" : "auto";
    comp.propertyId = comp.originalPropertyId || null;
    renderCompPropertyLink();
  });
  $("compKeepProperty").addEventListener("click", () => {
    cancelCompPropertyChoice(false);
    comp.propertyMode = "preserve";
    comp.propertyId = comp.originalPropertyId;
    renderCompPropertyLink();
  });
  $("compChangeProperty").addEventListener("click", () => {
    const before = { mode: comp.propertyMode, id: comp.propertyId };
    comp.propertyMode = "auto";
    comp.propertyId = null;
    showCompPropertyChoice({ message: "Edit the address if needed, then find its property on save. Cancel keeps your previous choice.", candidates: [] }, before);
  });
  $("compFindProperty").addEventListener("click", saveComp);
  $("compCancelProperty").addEventListener("click", () => cancelCompPropertyChoice());
  $("compUseProperty").addEventListener("click", async () => {
    const selected = document.querySelector('input[name="comp_property_candidate"]:checked');
    if (!selected) return setCompMsg("Choose a property first.", true);
    comp.propertyMode = "existing";
    comp.propertyId = selected.value;
    await saveComp();
  });
  $("compCreateProperty").addEventListener("click", async () => {
    comp.propertyMode = "create";
    comp.propertyId = null;
    await saveComp();
  });
  $("compNewDeal").addEventListener("click", () => {
    const propertyId = comp.originalPropertyId;
    resetCompPropertyFields();
    comp.mode = "insert";
    comp.updateId = null;
    comp.baseline = null;
    comp.originalPropertyId = null;
    comp.propertyId = propertyId;
    comp.propertyMode = propertyId ? "existing" : "auto";
    comp.requestId = null;
    comp.yardEdited = false;
    $("comp_yard_included").value = "";
    $("comp_suite").value = "";
    $("comp_partial_site_override").value = "";
    $("comp_multi_tenant").value = "";
    comp.siteFieldsEdited = {};
    cancelCompPropertyChoice(false);
    setCompMsg("New separate deal. Review its sizes, price or rent, suite, and yard before saving.");
    syncCompReviewState();
  });
  const tg = $("modeToggle");
  if (tg) {
    tg.querySelectorAll("button[data-mode]").forEach((b) =>
      b.addEventListener("click", () => setAppMode(b.dataset.mode)));
  }
  const save = $("compSave"); if (save) save.addEventListener("click", saveComp);
  const rescan = $("compRescan"); if (rescan) rescan.addEventListener("click", () => scanComp());
  const statusSel = $("comp_status");
  if (statusSel) statusSel.addEventListener("change", () => {
    markCompFieldEdited("comp_status");
    syncCompFieldVisibility();
  });
  COMP_INPUT_IDS.forEach((id) => {
    if (id === "comp_status") return;
    const node = $(id);
    if (!node) return;
    const eventName = node.tagName === "SELECT" ? "change" : "input";
    node.addEventListener(eventName, () => markCompFieldEdited(id));
  });
  ["comp_ptypes", "comp_sale_types"].forEach((containerId) => {
    const node = $(containerId);
    if (node) node.addEventListener("change", () => { if (containerId === 'comp_ptypes') comp.propertyTypeEdited = true; syncCompReviewState(); });
  });
  const IMPORT_TOGGLES = { compIncludeHighlights: "highlights", compIncludeSaleNotes: "notes" };
  Object.entries(IMPORT_TOGGLES).forEach(([id, which]) => {
    const node = $(id);
    if (node) node.addEventListener("change", () => applyCompImport(which, node.checked));
  });
  // Keep big numbers readable: re-format with thousands separators when typing ends.
  ["comp_building_sf", "comp_sale_price"].forEach((id) => {
    const n = $(id);
    if (n) n.addEventListener("blur", () => { if (n.value.trim()) n.value = fmtThousands(n.value); });
  });
  for (const field of ['office_sf','lease_area']) $('comp_'+field).addEventListener('blur', () => {
    const parsed=CompPropertyFields.parse(field,$('comp_'+field).value);
    if (!parsed.error && parsed.value !== null) setCompPropertyValue(field,parsed.value,comp.propertyFieldsEdited[field]?'Edited':field==='lease_area'&&comp.leaseAreaOrigin==='building'?'Building SF default':comp.mode==='update'?'Saved':'CoStar');
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
    const flyerState = $("compFlyerState");
    if (flyerState) {
      flyerState.textContent = `Flyer: ${res.name}`;
      flyerState.title = res.name;
    }
    setCompMsg(`Flyer attached: ${res.name}`);
    syncCompReviewState();
  });
  syncCompReviewState();
}

// ─── Comp-mode SPA auto-re-scan (parallel to maybeReReadOnNav) ────────────────────

let lastCompNavKey = null;
let compNavBusy = false;
async function maybeReScanCompOnNav() {
  if (poppingOut || document.body.inert) return;
  if (comp.pendingSave || comp.saving) return;
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
if (IS_EXTENSION_CONTEXT) {
  chrome.tabs.onUpdated.addListener((_id, changeInfo) => { if (changeInfo.url) maybeReScanCompOnNav(); });
  chrome.tabs.onActivated.addListener(() => maybeReScanCompOnNav());
  // One shared safety-net poll for both modes; the tab listeners above are the fast
  // path, so this only has to catch SPA navigations that never touch the URL events.
  setInterval(() => { maybeReReadOnNav(); maybeReScanCompOnNav(); }, 2500);
}

// ─── Go ────────────────────────────────────────────────────────────────────────

function initLocalPreview() {
  for (const id of Object.keys(SURVEY_CHOICE_OPTIONS)) surveyChoice(id, null);

  state.authed = true;
  state.appMode = "comp";
  initCompMode();
  showScreen("comp");

  const sample = {
    street: "128 W Boxelder",
    city: "Chandler",
    state: "AZ",
    zip: "85225",
    submarket: "Chandler N/Gilbert",
    rba: "14157",
    acLot: "0.86",
    salePrice: "3140000",
    leaseRate: "1.50",
    leaseType: "Modified Gross",
    saleHighlights:
      "• Two leased suites generating $4,660 monthly income\n" +
      "• Immediate occupancy available for ±10,157 SF\n" +
      "• Six grade-level doors and 18′ clear height",
    saleNotes:
      "Built in 1986, the property features six grade-level doors, separately metered power, and flexible industrial suites.",
  };

  comp.scrape = sample;
  comp.saleHighlights = sample.saleHighlights;
  comp.saleNotes = sample.saleNotes;
  setCompField("comp_address", sample.street);
  setCompField("comp_city", sample.city);
  setCompField("comp_state", sample.state);
  setCompField("comp_zip", sample.zip);
  setCompSubmarket(sample.submarket);
  setCompField("comp_building_sf", fmtThousands(sample.rba));
  setCompField("comp_land_area", sample.acLot);
  setCompField("comp_sale_price", fmtThousands(sample.salePrice));
  setCompField("comp_rent_psf", sample.leaseRate);
  setCompField("comp_lease_format", mapLeaseFormat(sample.leaseType));
  setCompField("comp_status", defaultCompStatus(sample), "Derived");
  setCompField("comp_list_date", todayISO(), "Today");

  const propertyTypes = $("comp_ptypes");
  if (propertyTypes) {
    propertyTypes.querySelectorAll("input").forEach((input) => {
      input.checked = input.value === "ISF" || input.value === "Vintage";
    });
  }
  const ownerUser = $("comp_sale_types")?.querySelector('input[value="Owner User"]');
  if (ownerUser) ownerUser.checked = true;

  renderCompContentImport();
  syncCompFieldVisibility();
  syncCompReviewState();

  const headerActions = document.querySelector(".header-actions");
  if (headerActions) headerActions.classList.add("hidden");
  $("modeToggle")?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  const save = $("compSave");
  if (save) {
    save.disabled = true;
    save.textContent = "Preview only";
    save.title = "Open this panel from the installed extension to save a comp";
  }
}

if (IS_EXTENSION_CONTEXT) void (async () => {
  try { await init(); }
  catch (error) {
    if (popoutKey) await chrome.storage.session.set({ [popoutKey]: { status: "error", error: error.message } });
    toast("Could not open the form: " + esc(error.message), true);
  }
})();
else initLocalPreview();
