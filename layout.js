// layout.js — customizable form layout: section order, hide/collapse, field moves,
// custom sections, density. Self-contained; panel.js only calls Layout.apply(...).
// Prefs live in chrome.storage.local under "layout_prefs". Nodes are always MOVED
// (never cloned) so IDs, values, and listeners survive every rearrangement.
(() => {
  const KEY = "layout_prefs";
  const BACKUP_KEY = "layout_prefs_survey_v2_backup";
  const SURVEY_VERSION = 3;
  const SURVEY_TOP = ["setup", "size", "lease", "offering"];
  const SURVEY_SECTIONS = [...SURVEY_TOP, "sale", "building", "flyer", "notes", "more"];
  const SURVEY_REQUIRED = new Set(["fAddress", "fTenancy", "fAvailability", "fNotes", "fDateAvailable", "fSpaceKind", "rangeFields", "combinedSpaceNotice", "surveyPricing", "fForSale", "fForLease"]);
  const SECTION_ALIASES = { address: "setup", tenancy: "setup", status: "offering" };
  const PRICING_FIELDS = new Set(["fLeaseRate", "fMonthlyBase", "fOpexPsf", "fOpexTotal", "fTotalLeaseRate", "fRentPerAcre", "fRentAcre", "fOfferedAcres", "fExpenseTreatment", "fExpenseBasis", "fExpenseAmount"]);
  const SCREENS = { survey: "screen-form", comp: "screen-comp" };
  // Fields the forms can't function without — hide is a no-op for these.
  const NON_HIDEABLE = new Set(["fAddress", "fForSale", "fForLease", "comp_address", "comp_status", "comp_for_sale", "comp_for_lease", "comp_stage"]);

  const blank = () => ({ order: [], hiddenSecs: [], collapsedSecs: [], openDetails: [], hiddenFields: [], fieldMoves: {}, customSecs: [] });
  const defaults = () => ({ v: 1, surveyLayoutVersion: SURVEY_VERSION, density: "comfortable", survey: blank(), comp: blank() });
  const unique = (values) => [...new Set(values)];
  const array = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sectionKey = (key) => SECTION_ALIASES[key] || key;
  const fieldKey = (key) => PRICING_FIELDS.has(key) ? "surveyPricing" : key;

  // Migrate Survey only. In particular, never normalize or fill in the Comp object:
  // older/newer Comp clients may own properties this module does not understand.
  function normalizeSurvey(value) {
    const p = { ...blank(), ...object(value) };
    p.customSecs = array(p.customSecs).filter((s) => s && typeof s.key === "string" &&
      /^[A-Za-z0-9_-]+$/.test(s.key) && !SURVEY_SECTIONS.includes(sectionKey(s.key)) && typeof s.title === "string")
      .filter((s, i, all) => all.findIndex((candidate) => candidate.key === s.key) === i);
    const known = new Set([...SURVEY_SECTIONS, ...p.customSecs.map((s) => s.key)]);
    const sectionList = (values) => unique(array(values).map(sectionKey).filter((key) => known.has(key)));
    p.order = unique([...SURVEY_TOP, ...sectionList(p.order)]);
    p.hiddenSecs = sectionList(p.hiddenSecs).filter((key) => !SURVEY_TOP.includes(key));
    p.collapsedSecs = sectionList(p.collapsedSecs).filter((key) => !SURVEY_TOP.includes(key));
    p.openDetails = sectionList(p.openDetails);
    p.hiddenFields = unique(array(p.hiddenFields).filter((key) => typeof key === "string").map(fieldKey))
      .filter((key) => !SURVEY_REQUIRED.has(key));
    p.fieldMoves = Object.fromEntries(Object.entries(object(p.fieldMoves))
      .map(([key, dest]) => [fieldKey(key), sectionKey(dest)])
      .filter(([key, dest]) => !SURVEY_REQUIRED.has(key) && known.has(dest)));
    return p;
  }

  function migratePreferences(value) {
    if (!value || value.v !== 1) return { preferences: defaults(), migrated: false };
    const preferences = { ...value, survey: normalizeSurvey(value.survey) };
    const migrated = !(value.surveyLayoutVersion >= SURVEY_VERSION);
    if (migrated) {
      preferences.surveyLayoutVersion = SURVEY_VERSION;
      preferences.surveyMigrationNoticePending = true;
    }
    return { preferences, migrated };
  }

  const fldKey = (unit) => unit.dataset?.layoutKey || unit.querySelector("input, select, textarea")?.id || unit.id;
  // Radio IDs belong to their current space draft, not to the layout. The outer
  // explicit unit also keeps all linked pricing controls together when edited.
  function layoutUnit(node) {
    let unit = node?.closest?.("[data-layout-key], .fld, .chk");
    let parent = unit?.parentElement?.closest("[data-layout-key]");
    while (parent) { unit = parent; parent = parent.parentElement?.closest("[data-layout-key]"); }
    return unit;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { migratePreferences, normalizeSurvey, fldKey, layoutUnit, BACKUP_KEY, SURVEY_VERSION };
  }
  if (typeof document === "undefined") return;

  let prefs = defaults();
  let editScreen = null; // "survey" | "comp" while edit mode is active
  let selectedFld = null;

  const el = (id) => document.getElementById(id);
  const container = (sk) => el(SCREENS[sk]);
  const anchorEl = (sk) => sk === "survey" ? el("btnSaveBottom") : container("comp")?.querySelector(".comp-sticky-footer");
  const sectionAnchor = (sk) => {
    let anchor = anchorEl(sk);
    while (anchor?.parentElement && anchor.parentElement !== container(sk)) anchor = anchor.parentElement;
    return anchor?.parentElement === container(sk) ? anchor : null;
  };
  const sections = (sk) => [...container(sk).querySelectorAll("[data-sec]")];
  const units = (sk) => unique([...container(sk).querySelectorAll("[data-layout-key], .fld, .chk")].map(layoutUnit));
  const fldOf = (sk, key) => units(sk).find((unit) => fldKey(unit) === key);
  const screenPrefs = (sk) => ({ ...blank(), ...prefs[sk] });
  const editablePrefs = (sk) => (prefs[sk] = screenPrefs(sk));
  const lockedSection = (sk, key) => (sk === "survey" && SURVEY_TOP.includes(key)) || (sk === "comp" && sections(sk).some(section => section.dataset.sec === key && [...section.querySelectorAll('[data-layout-key], .fld')].some(unit => NON_HIDEABLE.has(fldKey(unit)))));
  const lockedField = (sk, key) => NON_HIDEABLE.has(key) || (sk === "survey" && SURVEY_REQUIRED.has(key));
  const populatedNote = (sk, section) => sk === "survey" && section.dataset.sec === "notes" && section.dataset.hasDetails === "true";
  const toggleIn = (list, key, on) => {
    const out = list.filter((x) => x !== key);
    if (on) out.push(key);
    return out;
  };

  let persistenceAvailable = true;
  const ready = (async () => {
    try {
      const res = await chrome.storage.local.get([KEY, BACKUP_KEY]);
      const result = migratePreferences(res[KEY]);
      prefs = result.preferences;
      if (result.migrated) {
        // Do not replace the prior preferences unless their exact backup is saved.
        if (!Object.hasOwn(res, BACKUP_KEY)) await chrome.storage.local.set({ [BACKUP_KEY]: res[KEY] });
        await chrome.storage.local.set({ [KEY]: prefs });
      }
    } catch (error) {
      persistenceAvailable = false;
      console.warn("Layout preferences could not be saved; existing storage was retained.", error);
    }
    document.body.classList.toggle("density-compact", prefs.density === "compact");
    syncDensitySeg();
  })();
  async function save() {
    await ready;
    if (!persistenceAvailable) return false;
    try { await chrome.storage.local.set({ [KEY]: prefs }); return true; }
    catch (error) { console.warn("Layout preferences could not be saved.", error); return false; }
  }

  async function showMigrationNotice() {
    const offering = sections("survey").find((s) => s.dataset.sec === "offering");
    const existing = el("surveyLayoutNotice");
    if (existing) { if (offering) offering.after(existing); return; }
    if (!prefs.surveyMigrationNoticePending) return;
    const notice = document.createElement("details");
    notice.id = "surveyLayoutNotice";
    notice.className = "hint";
    const summary = document.createElement("summary");
    summary.textContent = "Survey layout updated";
    const body = document.createElement("p");
    body.textContent = "Area now comes before monthly pricing, followed by availability, client notes and date. Your other Survey sections, spacing and Comp layout were kept.";
    notice.append(summary, body);
    // A single compact line after the offering keeps primary review controls first.
    if (offering) offering.after(notice); else container("survey").appendChild(notice);
    prefs.surveyMigrationNoticePending = false;
    await save();
  }

  function makeSection(sk, def) {
    const d = document.createElement("div");
    d.className = "sec sec-custom";
    d.dataset.sec = def.key;
    d.dataset.secTitle = def.title;
    d.innerHTML = `<div class="section-label mt-section"></div><div class="fieldset"></div>`;
    d.querySelector(".section-label").textContent = def.title;
    container(sk).insertBefore(d, sectionAnchor(sk));
  }

  // Idempotent: safe to run every time a form screen shows.
  async function apply(sk) {
    await ready;
    const cont = container(sk);
    if (!cont) return;
    if (sk === "survey") prefs.survey = normalizeSurvey(prefs.survey);
    const p = screenPrefs(sk);
    for (const def of p.customSecs) {
      if (!sections(sk).some((s) => s.dataset.sec === def.key)) makeSection(sk, def);
    }
    const present = sections(sk);
    const byKey = new Map(present.map((s) => [s.dataset.sec, s]));
    const ordered = p.order.filter((k) => byKey.has(k));
    const rest = present.map((s) => s.dataset.sec).filter((k) => !ordered.includes(k));
    const anchor = sectionAnchor(sk);
    for (const k of [...ordered, ...rest]) cont.insertBefore(byKey.get(k), anchor);
    for (const [fk, secKey] of Object.entries(p.fieldMoves)) {
      if (lockedField(sk, fk)) continue;
      const unit = fldOf(sk, fk);
      const target = byKey.get(secKey)?.querySelector(".fieldset");
      if (unit && target && !target.contains(unit)) target.appendChild(unit);
    }
    for (const s of present) s.classList.toggle("u-hidden", !lockedSection(sk, s.dataset.sec) && !populatedNote(sk, s) && p.hiddenSecs.includes(s.dataset.sec));
    units(sk).forEach((unit) => {
      const k = fldKey(unit);
      if (k) unit.classList.toggle("u-hidden", !lockedField(sk, k) && p.hiddenFields.includes(k));
    });
    for (const s of present) {
      if (s.tagName === "DETAILS") s.open = lockedSection(sk, s.dataset.sec) || populatedNote(sk, s) || p.openDetails.includes(s.dataset.sec);
      else s.classList.toggle("sec-collapsed", !lockedSection(sk, s.dataset.sec) && p.collapsedSecs.includes(s.dataset.sec));
    }
    document.body.classList.toggle("density-compact", prefs.density === "compact");
    if (sk === "survey") await showMigrationNotice();
  }

  // ── Collapse on header click (always on) + persisted <details> state ──
  for (const sk of Object.keys(SCREENS)) {
    const cont = container(sk);
    if (!cont) continue;
    cont.addEventListener("click", async (e) => {
      if (editScreen) return;
      const label = e.target.closest("[data-sec] > .section-label");
      if (!label) return;
      const sec = label.parentElement;
      if (lockedSection(sk, sec.dataset.sec)) return;
      await ready;
      const p = editablePrefs(sk);
      sec.classList.toggle("sec-collapsed");
      p.collapsedSecs = toggleIn(p.collapsedSecs, sec.dataset.sec, sec.classList.contains("sec-collapsed"));
      await save();
    });
    cont.addEventListener("toggle", async (e) => {
      const d = e.target;
      if (!d.dataset || !d.dataset.sec) return;
      if (lockedSection(sk, d.dataset.sec)) { if (!d.open) d.open = true; return; }
      await ready;
      const has = screenPrefs(sk).openDetails.includes(d.dataset.sec);
      if (d.open === has) return; // programmatic set from apply() — no-op
      const p = editablePrefs(sk);
      p.openDetails = toggleIn(p.openDetails, d.dataset.sec, d.open);
      await save();
    }, true); // toggle doesn't bubble
  }

  // ── Edit mode ──
  function ensureCtls(sk) {
    for (const sec of sections(sk)) {
      const head = sec.querySelector(":scope > .section-label, :scope > summary");
      if (!head) continue;
      if (!sec.dataset.secTitle) {
        const t = head.matches("summary") && head.querySelector("span") ? head.querySelector("span").textContent : head.textContent;
        sec.dataset.secTitle = t.trim().replace(/\s+/g, " ");
      }
      if (head.querySelector(".sec-ctl")) continue;
      const ctl = document.createElement("span");
      ctl.className = "sec-ctl";
      ctl.innerHTML = `<button type="button" data-act="up" title="Move up">↑</button><button type="button" data-act="down" title="Move down">↓</button><button type="button" data-act="hidesec" title="Show/hide section">👁</button>`;
      if (lockedSection(sk, sec.dataset.sec)) ctl.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
        button.title = "Required Survey section";
      });
      head.appendChild(ctl);
    }
  }

  function fillMoveTo(sk) {
    const sel = el("lbMoveTo");
    sel.replaceChildren();
    for (const [value, title] of [["", "Move to…"], ...sections(sk).map((s) => [s.dataset.sec, s.dataset.secTitle || s.dataset.sec]), ["__reset", "↩ Default spot"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      sel.appendChild(option);
    }
  }

  function selectFld(unit) {
    selectedFld?.classList.remove("fld-selected");
    selectedFld = unit || null;
    selectedFld?.classList.add("fld-selected");
    const label = el("lbSelected");
    if (!selectedFld) { label.textContent = "Tap a field to hide or move it"; el("lbHide").textContent = "Hide"; return; }
    const k = fldKey(selectedFld);
    const fieldLabel = selectedFld.querySelector(":scope > label, :scope > span") || selectedFld.querySelector("label, span");
    label.textContent = k === "surveyPricing" ? "Linked monthly pricing" : (fieldLabel ? fieldLabel.textContent : k).replace(/[+–] Name/, "").trim() || k;
    el("lbHide").textContent = screenPrefs(editScreen).hiddenFields.includes(k) ? "Unhide" : "Hide";
    el("lbMoveTo").value = "";
  }

  async function enterEdit(sk) {
    await ready;
    window.showScreen?.(sk === "survey" ? "form" : "comp");
    await apply(sk);
    ensureCtls(sk);
    fillMoveTo(sk);
    editScreen = sk;
    selectFld(null);
    document.body.classList.add("layout-editing");
    el("layoutBar").classList.remove("hidden");
  }

  function exitEdit() {
    const sk = editScreen;
    editScreen = null;
    selectFld(null);
    document.body.classList.remove("layout-editing");
    el("layoutBar").classList.add("hidden");
    el("lbSecName").classList.add("hidden");
    el("lbAddSec").textContent = "+ Section";
    save();
    if (sk) apply(sk);
    window.showScreen?.("settings");
  }

  // One capture-phase handler drives all edit-mode clicks (beats panel.js listeners).
  document.addEventListener("click", (e) => {
    if (!editScreen) return;
    if (e.target.closest("#layoutBar")) return;
    const btn = e.target.closest(".sec-ctl button");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const sec = btn.closest("[data-sec]");
      const k = sec.dataset.sec;
      if (lockedSection(editScreen, k)) return;
      const p = editablePrefs(editScreen);
      if (btn.dataset.act === "hidesec") {
        p.hiddenSecs = toggleIn(p.hiddenSecs, k, !p.hiddenSecs.includes(k));
      } else {
        const keys = sections(editScreen).map((s) => s.dataset.sec);
        const i = keys.indexOf(k);
        const j = btn.dataset.act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= keys.length) return;
        if (lockedSection(editScreen, keys[j])) return;
        [keys[i], keys[j]] = [keys[j], keys[i]];
        p.order = keys;
      }
      save();
      apply(editScreen);
      return;
    }
    const unit = layoutUnit(e.target);
    if (unit && container(editScreen).contains(unit)) {
      e.preventDefault();
      e.stopPropagation();
      selectFld(unit === selectedFld ? null : unit);
    }
  }, true);

  el("lbHide")?.addEventListener("click", async () => {
    if (!editScreen || !selectedFld) return;
    const k = fldKey(selectedFld);
    if (NON_HIDEABLE.has(k) || lockedField(editScreen, k)) { el("lbSelected").textContent = "Required field — can't hide"; return; }
    const p = editablePrefs(editScreen);
    p.hiddenFields = toggleIn(p.hiddenFields, k, !p.hiddenFields.includes(k));
    await save();
    await apply(editScreen);
    selectFld(selectedFld);
  });

  el("lbMoveTo")?.addEventListener("change", async () => {
    const v = el("lbMoveTo").value;
    if (!editScreen || !selectedFld || !v) return;
    const k = fldKey(selectedFld);
    if (lockedField(editScreen, k)) { el("lbSelected").textContent = "Required field — stays in this section"; el("lbMoveTo").value = ""; return; }
    const p = editablePrefs(editScreen);
    if (v === "__reset") {
      // Restoring the default spot needs the original DOM — cheapest correct way is a reload.
      delete p.fieldMoves[k];
      if (await save()) location.reload();
      return;
    }
    p.fieldMoves[k] = v;
    await save();
    await apply(editScreen);
    selectFld(selectedFld);
  });

  el("lbAddSec")?.addEventListener("click", async () => {
    if (!editScreen) return;
    const inp = el("lbSecName");
    if (inp.classList.contains("hidden")) {
      inp.classList.remove("hidden");
      el("lbAddSec").textContent = "Add";
      inp.focus();
      return;
    }
    const title = inp.value.trim();
    inp.value = "";
    inp.classList.add("hidden");
    el("lbAddSec").textContent = "+ Section";
    if (!title) return;
    const p = editablePrefs(editScreen);
    const key = "c" + (Math.max(0, ...p.customSecs.map((c) => parseInt(c.key.slice(1), 10) || 0)) + 1);
    p.customSecs.push({ key, title });
    await save();
    await apply(editScreen);
    ensureCtls(editScreen);
    fillMoveTo(editScreen);
  });

  el("lbDone")?.addEventListener("click", exitEdit);

  // ── Settings wiring ──
  function syncDensitySeg() {
    el("densitySeg")?.querySelectorAll("[data-v]").forEach((b) =>
      b.classList.toggle("active", b.dataset.v === prefs.density));
  }
  el("densitySeg")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    prefs.density = b.dataset.v;
    document.body.classList.toggle("density-compact", prefs.density === "compact");
    syncDensitySeg();
    save();
  });
  el("btnCustomizeSurvey")?.addEventListener("click", () => enterEdit("survey"));
  el("btnCustomizeComp")?.addEventListener("click", () => enterEdit("comp"));
  el("btnLayoutReset")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed) {
      try { await chrome.storage.local.remove(KEY); location.reload(); }
      catch (error) { console.warn("Layout reset could not be saved.", error); }
      return;
    }
    b.dataset.armed = "1";
    b.textContent = "Tap again to reset layout";
    setTimeout(() => { delete b.dataset.armed; b.textContent = "Reset layout to default"; }, 2500);
  });

  window.Layout = { apply, enterEdit };
})();
