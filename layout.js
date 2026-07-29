// layout.js — customizable form layout: section order, hide/collapse, field moves,
// custom sections, density. Self-contained; panel.js only calls Layout.apply(...).
// Prefs live in chrome.storage.local under "layout_prefs". Nodes are always MOVED
// (never cloned) so IDs, values, and listeners survive every rearrangement.
(() => {
  const KEY = "layout_prefs";
  const SCREENS = { survey: "screen-form", comp: "screen-comp" };
  // Fields the forms can't function without — hide is a no-op for these.
  const NON_HIDEABLE = new Set(["fAddress", "fForSale", "fForLease", "comp_address", "comp_status"]);

  const blank = () => ({ order: [], hiddenSecs: [], collapsedSecs: [], openDetails: [], hiddenFields: [], fieldMoves: {}, customSecs: [] });
  const defaults = () => ({ v: 1, density: "comfortable", survey: blank(), comp: blank() });

  let prefs = defaults();
  let editScreen = null; // "survey" | "comp" while edit mode is active
  let selectedFld = null;

  const el = (id) => document.getElementById(id);
  const container = (sk) => el(SCREENS[sk]);
  const anchorEl = (sk) => sk === "survey" ? el("btnSaveBottom") : container("comp").querySelector(".comp-sticky-footer");
  const sections = (sk) => [...container(sk).querySelectorAll("[data-sec]")];
  const fldKey = (unit) => unit.querySelector("input, select, textarea")?.id || unit.id;
  const fldOf = (key) => document.getElementById(key)?.closest(".fld, .chk");
  const toggleIn = (list, key, on) => {
    const out = list.filter((x) => x !== key);
    if (on) out.push(key);
    return out;
  };

  const ready = chrome.storage.local.get([KEY]).then((res) => {
    const p = res[KEY];
    if (p && p.v === 1) {
      prefs = { ...defaults(), ...p, survey: { ...blank(), ...p.survey }, comp: { ...blank(), ...p.comp } };
    }
    document.body.classList.toggle("density-compact", prefs.density === "compact");
    syncDensitySeg();
  });
  const save = () => chrome.storage.local.set({ [KEY]: prefs });

  function makeSection(sk, def) {
    const d = document.createElement("div");
    d.className = "sec sec-custom";
    d.dataset.sec = def.key;
    d.dataset.secTitle = def.title;
    d.innerHTML = `<div class="section-label mt-section"></div><div class="fieldset"></div>`;
    d.querySelector(".section-label").textContent = def.title;
    container(sk).insertBefore(d, anchorEl(sk));
  }

  // Idempotent: safe to run every time a form screen shows.
  async function apply(sk) {
    await ready;
    const p = prefs[sk];
    const cont = container(sk);
    if (!cont) return;
    for (const def of p.customSecs) {
      if (!cont.querySelector(`[data-sec="${def.key}"]`)) makeSection(sk, def);
    }
    const present = sections(sk);
    const byKey = new Map(present.map((s) => [s.dataset.sec, s]));
    const ordered = p.order.filter((k) => byKey.has(k));
    const rest = present.map((s) => s.dataset.sec).filter((k) => !ordered.includes(k));
    const anchor = anchorEl(sk);
    for (const k of [...ordered, ...rest]) cont.insertBefore(byKey.get(k), anchor);
    for (const [fk, secKey] of Object.entries(p.fieldMoves)) {
      const unit = fldOf(fk);
      const target = byKey.get(secKey)?.querySelector(".fieldset");
      if (unit && target && !target.contains(unit)) target.appendChild(unit);
    }
    for (const s of present) s.classList.toggle("u-hidden", p.hiddenSecs.includes(s.dataset.sec));
    cont.querySelectorAll(".fld, .chk").forEach((unit) => {
      const k = fldKey(unit);
      if (k) unit.classList.toggle("u-hidden", p.hiddenFields.includes(k));
    });
    for (const s of present) {
      if (s.tagName === "DETAILS") s.open = p.openDetails.includes(s.dataset.sec);
      else s.classList.toggle("sec-collapsed", p.collapsedSecs.includes(s.dataset.sec));
    }
    document.body.classList.toggle("density-compact", prefs.density === "compact");
  }

  // ── Collapse on header click (always on) + persisted <details> state ──
  for (const sk of Object.keys(SCREENS)) {
    const cont = container(sk);
    if (!cont) continue;
    cont.addEventListener("click", (e) => {
      if (editScreen) return;
      const label = e.target.closest("[data-sec] > .section-label");
      if (!label) return;
      const sec = label.parentElement;
      sec.classList.toggle("sec-collapsed");
      prefs[sk].collapsedSecs = toggleIn(prefs[sk].collapsedSecs, sec.dataset.sec, sec.classList.contains("sec-collapsed"));
      save();
    });
    cont.addEventListener("toggle", (e) => {
      const d = e.target;
      if (!d.dataset || !d.dataset.sec) return;
      const has = prefs[sk].openDetails.includes(d.dataset.sec);
      if (d.open === has) return; // programmatic set from apply() — no-op
      prefs[sk].openDetails = toggleIn(prefs[sk].openDetails, d.dataset.sec, d.open);
      save();
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
      head.appendChild(ctl);
    }
  }

  function fillMoveTo(sk) {
    const sel = el("lbMoveTo");
    sel.innerHTML = `<option value="">Move to…</option>` +
      sections(sk).map((s) => `<option value="${s.dataset.sec}">${s.dataset.secTitle || s.dataset.sec}</option>`).join("") +
      `<option value="__reset">↩ Default spot</option>`;
  }

  function selectFld(unit) {
    selectedFld?.classList.remove("fld-selected");
    selectedFld = unit || null;
    selectedFld?.classList.add("fld-selected");
    const label = el("lbSelected");
    if (!selectedFld) { label.textContent = "Tap a field to hide or move it"; el("lbHide").textContent = "Hide"; return; }
    const k = fldKey(selectedFld);
    const span = selectedFld.querySelector("span");
    label.textContent = (span ? span.textContent : k).replace(/[+–] Name/, "").trim() || k;
    el("lbHide").textContent = prefs[editScreen].hiddenFields.includes(k) ? "Unhide" : "Hide";
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
      const p = prefs[editScreen];
      if (btn.dataset.act === "hidesec") {
        p.hiddenSecs = toggleIn(p.hiddenSecs, k, !p.hiddenSecs.includes(k));
      } else {
        const keys = sections(editScreen).map((s) => s.dataset.sec);
        const i = keys.indexOf(k);
        const j = btn.dataset.act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= keys.length) return;
        [keys[i], keys[j]] = [keys[j], keys[i]];
        p.order = keys;
      }
      save();
      apply(editScreen);
      return;
    }
    const unit = e.target.closest(".fld, .chk");
    if (unit && container(editScreen).contains(unit)) {
      e.preventDefault();
      e.stopPropagation();
      selectFld(unit === selectedFld ? null : unit);
    }
  }, true);

  el("lbHide")?.addEventListener("click", () => {
    if (!editScreen || !selectedFld) return;
    const k = fldKey(selectedFld);
    if (NON_HIDEABLE.has(k)) { el("lbSelected").textContent = "Required field — can't hide"; return; }
    const p = prefs[editScreen];
    p.hiddenFields = toggleIn(p.hiddenFields, k, !p.hiddenFields.includes(k));
    save();
    apply(editScreen).then(() => selectFld(selectedFld));
  });

  el("lbMoveTo")?.addEventListener("change", () => {
    const v = el("lbMoveTo").value;
    if (!editScreen || !selectedFld || !v) return;
    const k = fldKey(selectedFld);
    const p = prefs[editScreen];
    if (v === "__reset") {
      // Restoring the default spot needs the original DOM — cheapest correct way is a reload.
      delete p.fieldMoves[k];
      save().then(() => location.reload());
      return;
    }
    p.fieldMoves[k] = v;
    save();
    apply(editScreen).then(() => selectFld(selectedFld));
  });

  el("lbAddSec")?.addEventListener("click", () => {
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
    const p = prefs[editScreen];
    const key = "c" + (Math.max(0, ...p.customSecs.map((c) => parseInt(c.key.slice(1), 10) || 0)) + 1);
    p.customSecs.push({ key, title });
    save();
    apply(editScreen).then(() => { ensureCtls(editScreen); fillMoveTo(editScreen); });
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
  el("btnLayoutReset")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed) { chrome.storage.local.remove(KEY).then(() => location.reload()); return; }
    b.dataset.armed = "1";
    b.textContent = "Tap again to reset layout";
    setTimeout(() => { delete b.dataset.armed; b.textContent = "Reset layout to default"; }, 2500);
  });

  window.Layout = { apply, enterEdit };
})();
