// Real Chrome windows/storage in a disposable extension profile; database replies
// are synthetic and all network requests are blocked. Never uses an installed copy.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const extension = path.resolve(process.env.EXTENSION_ROOT || path.join(__dirname, '..'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'survey-popout-test-'));
  let context;
  const results = [], errors = [], blocked = [];
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: null,
      ...(process.env.EXTENSION_CHROMIUM_PATH ? { executablePath: process.env.EXTENSION_CHROMIUM_PATH } : { channel: 'chromium' }),
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    await context.route(/^https?:/, async route => { blocked.push(route.request().url()); await route.abort(); });
    context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const url = `chrome-extension://${new URL(worker.url()).host}/panel.html`;
    await context.addInitScript(() => {
      if (!location.href.startsWith('chrome-extension:')) return;
      chrome.runtime.sendMessage = (m, cb) => {
        if (m.type === 'AUTH_STATUS') return cb({ ok: true, connected: true, accountId: 'fixture-account', email: 'fixture@example.invalid' });
        if (m.type === 'GET_SURVEY') return cb({ ok: true, survey: { id: m.id, name: 'Disposable pop-out survey', survey_type: 'lease' } });
        if (m.type === 'LIST_SURVEY_PROPERTIES') return cb({ ok: true, properties: [] });
        if (m.type === 'GET_SURVEY_PENDING') return cb({ ok: true, pending: null });
        if (m.type === 'READ_COSTAR') return cb({ ok: false, error: 'No CoStar page in this isolated test' });
        if (m.type === 'LIST_SURVEYS') return cb({ ok: true, surveys: [] });
        throw new Error('Unexpected fixture message: ' + m.type);
      };
    });
    await worker.evaluate(() => chrome.storage.local.set({ mode: 'survey', last_survey_id: 'fixture-survey' }));
    const openPanel = async () => {
      const page = await context.newPage(); await page.goto(url);
      await page.waitForFunction(() => state.survey?.id === 'fixture-survey' && activeMessages === 0);
      return page;
    };
    const pop = async source => {
      const opened = context.waitForEvent('page');
      const closed = source.waitForEvent('close');
      await source.locator('#btnPopout').click();
      const target = await opened;
      await target.waitForFunction(() => typeof IS_POPOUT !== 'undefined' && IS_POPOUT && state.survey && !popoutHandoff && !location.search.includes('handoff'));
      await closed;
      assert.deepEqual(await worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(k => k.startsWith('panel_handoff:'))), []);
      return target;
    };
    let source = await openPanel();
    await source.evaluate(() => {
      setupForm('insert', { address: '100 Fixture Way', city: 'Phoenix', state: 'AZ', tenancy: 'MT', suite_number: '101', suite_size: '40000', for_sale_or_lease: ['lease'] }, { key: 'popout-fixture', noSource: true });
      addSurveySpace();
    });
    await source.locator('#fSuiteNumber').fill('102');
    await source.locator('#fSuiteSize').fill('5000');
    await source.locator('#fMonthlyBase').fill('6250');
    await source.locator('#fNotes').fill('Keep this unsaved suite and quote');
    await source.locator('[data-sec="flyer"] > summary').click();
    await source.locator('#fFlyerUrl').fill('https://fixture.invalid/building.pdf');
    await source.locator('#fFlyerScope').selectOption('building');
    const flyersBefore = await source.evaluate(() => surveyEditor.buildingFlyers);
    const before = await source.evaluate(() => surveyEditor.bundle);
    await source.setViewportSize({ width: 320, height: 740 });
    assert.equal(await source.locator('#btnPopout').innerText(), '⤢ Pop out');
    assert.equal(await source.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await source.evaluate(() => window.scrollTo(0, 0));
    const shots = process.env.SURVEY_SCREENSHOT_DIR || 'output/review/popout'; fs.mkdirSync(shots, { recursive: true });
    await source.screenshot({ path: path.join(shots, 'panel-320.png') });
    // Playwright's viewport emulation also changes screen.availWidth; restore
    // desktop dimensions before testing the native screen-clamped window size.
    await source.setViewportSize({ width: 1280, height: 1000 });
    let target = await pop(source);
    assert.deepEqual(await target.evaluate(() => surveyEditor.bundle), before);
    assert.deepEqual(await target.evaluate(() => surveyEditor.buildingFlyers), flyersBefore);
    assert.equal(await target.locator('#fFlyerUrl').inputValue(), 'https://fixture.invalid/building.pdf');
    assert.equal(await target.locator('#fFlyerScope').inputValue(), 'building');
    assert.equal(await target.locator('#fMonthlyBase').inputValue(), '6250');
    assert.equal(await target.locator('#fNotes').inputValue(), 'Keep this unsaved suite and quote');
    assert.equal(await target.locator('#btnPopout').isVisible(), false);
    assert.equal(await target.locator('#popoutLabel').isVisible(), true);
    assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bounds = await target.evaluate(() => chrome.windows.getCurrent());
    assert.equal(bounds.type, 'popup'); assert.ok(bounds.width >= 600);
    await target.evaluate(() => window.scrollTo(0, 0));
    await target.screenshot({ path: path.join(shots, 'window-720.png') });
    await target.evaluate(async () => { const win = await chrome.windows.getCurrent(); await chrome.windows.update(win.id, { width: 560, height: 760 }); });
    assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    results.push('Real resizable popup preserves exact multi-space Survey draft, active suite, monthly quote and notes; closes source after restore; narrow header and wider form fit');

    source = await openPanel();
    const count = context.pages().length;
    await source.locator('#btnPopout').click();
    await source.waitForFunction(() => !poppingOut);
    assert.equal(context.pages().length, count); assert.equal(source.isClosed(), false);
    assert.match(await source.locator('#toast').innerText(), /already open/);
    assert.equal(await target.locator('#fNotes').inputValue(), 'Keep this unsaved suite and quote');
    await target.close();
    results.push('Repeated opening focuses the existing popup without replacing either draft');

    await source.evaluate(() => { window.realCreate = chrome.windows.create; chrome.windows.create = async () => { throw new Error('Fixture window unavailable'); }; });
    await source.locator('#btnPopout').click();
    await source.waitForFunction(() => !poppingOut);
    assert.match(await source.locator('#toast').innerText(), /Fixture window unavailable/);
    assert.equal(await source.evaluate(() => document.body.inert), false);
    assert.equal(await source.locator('#fNotes').inputValue(), 'Keep this unsaved suite and quote');
    assert.deepEqual(await worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(k => k.startsWith('panel_handoff:'))), []);
    await source.evaluate(() => { chrome.windows.create = window.realCreate; });
    results.push('Failed window creation retains editable original draft and removes temporary handoff');

    await source.evaluate(() => {
      window.realSet = chrome.storage.session.set;
      chrome.storage.session.set = async () => { throw new Error('Fixture memory unavailable'); };
    });
    await source.locator('#btnPopout').click(); await source.waitForFunction(() => !poppingOut);
    assert.match(await source.locator('#toast').innerText(), /Fixture memory unavailable/);
    assert.equal(await source.evaluate(() => document.body.inert), false);
    await source.evaluate(() => { chrome.storage.session.set = window.realSet; surveyEditor.saving = true; });
    await source.locator('#btnPopout').click(); assert.match(await source.locator('#toast').innerText(), /Finish the current/);
    await source.evaluate(() => { surveyEditor.saving = false; });
    results.push('Storage failure and in-flight save keep source open and never create a popup');

    await source.evaluate(async () => {
      await setAppMode('comp');
      comp.mode = 'update'; comp.updateId = 'existing-fixture-comp';
      comp.baseline = { id: comp.updateId, address: '200 Fixture Way', property_id: 'fixture-property' };
      comp.originalPropertyId = 'fixture-property'; comp.propertyMode = 'skip';
      comp.flyerUrl = 'https://fixture.invalid/flyer.pdf'; comp.flyerName = 'Fixture flyer.pdf';
      comp.saleHighlights = 'Fixture source highlight';
      comp.importedBlocks.highlights = 'Sale Highlights\nFixture source highlight';
      renderCompContentImport();
      $('compIncludeHighlights').checked = true;
      $('comp_ptypes').querySelector('input').checked = true;
      $('comp_sale_types').querySelector('input').checked = true;
    });
    await source.locator('#comp_address').fill('200 Fixture Way');
    await source.locator('#comp_notes').fill('Private unsaved comp edit');
    await source.locator('#comp_building_sf').fill('5,000 - 6,000');
    await source.locator('#comp_notes').focus(); // Existing blur formatting runs before a header click.
    await source.locator('#comp_clear_height').fill("22-24'");
    await source.locator('#comp_office_sf').fill('6,500');
    await source.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');
    await source.locator('#comp_yard_included_choice').focus(); await source.locator('#comp_yard_included_choice').selectOption('true'); await source.locator('#comp_yard_included_choice').focus(); await source.locator('#comp_yard_included_choice').selectOption('false');
    await source.locator('#comp_heavy_power_choice').focus(); await source.locator('#comp_heavy_power_choice').selectOption('true');
    await source.locator('#comp_has_rail_choice').focus(); await source.locator('#comp_has_rail_choice').selectOption('true'); await source.locator('#comp_has_rail_choice').focus(); await source.locator('#comp_has_rail_choice').selectOption('false');
    const compBefore = await source.evaluate(() => ({ model: comp, fields: compDraftSnapshot(), highlights: $('compIncludeHighlights').checked }));
    target = await pop(source);
    assert.equal(await target.evaluate(() => state.appMode), 'comp');
    assert.equal(await target.locator('#screen-comp').isVisible(), true);
    assert.deepEqual(await target.evaluate(() => ({ model: comp, fields: compDraftSnapshot(), highlights: $('compIncludeHighlights').checked })), compBefore);
    assert.equal(await target.locator('#compFlyerState').innerText(), 'Fixture flyer.pdf');
    assert.equal(await target.locator('#comp_clear_height').inputValue(),"22-24'");
    assert.equal(await target.locator('#comp_office_sf').inputValue(),'6,500');
    assert.equal(await target.locator('#comp_power').inputValue(),'3,400 amps, 277/480V, 3-phase');
    assert.equal(await target.locator('#comp_yard_included_answer').innerText(),'No');
    assert.equal(await target.locator('#comp_heavy_power').isChecked(),true);
    assert.equal(await target.locator('#comp_has_rail_answer').innerText(),'No');
    assert.equal(await target.locator('#comp_class_a').evaluate(n=>n.indeterminate),true);
    results.push('Comp handoff preserves raw text, selected existing deal and original property link, skip choice, checkboxes, notes and flyer without rescraping');


    await target.close();
    for (const dismissed of [false,true]) {
      source=await openPanel();
      await source.evaluate(async dismissed=>{
        await setAppMode('comp');comp.mode='insert';comp.updateId=null;comp.baseline=null;
        comp.propertyFieldsEdited=dismissed?{power:true}:{};comp.powerFallbackDismissed=dismissed;
        comp.scrape={costarId:'airport',propertyFacts:{powerFallback:'800a/120 - 208v 3p Heavy'}};
        setCompPropertyValue('power',null,null);syncCompReviewState();
      },dismissed);
      assert.equal(await source.locator('#compPowerFallback').isVisible(),!dismissed);
      target=await pop(source);
      assert.equal(await target.locator('#compPowerFallback').isVisible(),!dismissed);assert.equal(await target.locator('#comp_power').inputValue(),'');
      if(!dismissed)assert.equal(await target.locator('#compPowerFallbackValue').innerText(),'800a/120 - 208v 3p Heavy');
      assert.equal(await target.evaluate(()=>comp.powerFallbackDismissed),dismissed);
      results.push(dismissed?'Keep blank and its deliberate-clear state survive actual pop-out':'Unaccepted property-power choice survives actual pop-out without silently filling Power');
      await target.close();
    }

    const staleKey = 'panel_handoff:other-account';
    await worker.evaluate(key => chrome.storage.session.set({ [key]: { status: 'opening', accountId: 'different-account', email: 'other@example.invalid', createdAt: Date.now(), compControls: [] } }), staleKey);
    const rejected = await context.newPage(); await rejected.goto(url + '?view=popout&handoff=other-account');
    await rejected.waitForFunction(() => !$('toast').classList.contains('hidden'));
    assert.match(await rejected.locator('#toast').innerText(), /different or expired session/);
    assert.equal(await worker.evaluate(async key => (await chrome.storage.session.get(key))[key].status, staleKey), 'error');
    assert.equal(await rejected.locator('#comp_address').inputValue(), '');
    results.push('Account mismatch rejects the handoff before restoring private form fields');
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    console.log(JSON.stringify({ result: 'passed', scenarios: results.length, results, remoteRequests: blocked.length }, null, 2));
  } finally { if (context) await context.close(); fs.rmSync(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
