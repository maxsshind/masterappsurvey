// Serve the extension at 127.0.0.1:8783 and run via browser_run_code_unsafe(filename).
// Mounts the actual panel, mocks Chrome's boundary, and blocks non-local requests.
async (page) => {
  const assert = {
    equal(a, b, why = 'Values differ') { if (a !== b) throw new Error(`${why}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
    ok(a, why = 'Expected true') { if (!a) throw new Error(why); },
  };
  const browser = page.context().browser();
  const results = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const blocked = [], errors = [];
  await context.route('**/*', async (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:8783/')) await route.continue();
    else { blocked.push(route.request().url()); await route.abort(); }
  });
  await context.addInitScript(() => {
    const stored = JSON.parse(sessionStorage.getItem('fixtureStore') || 'null');
    window.fixture = {
      storage: stored || { mode: 'comp' }, requests: [], scenario: 'exact', failLookup: false, failSave: false,
      delay: 0, writes: Number(sessionStorage.getItem('fixtureWrites') || 0), receipts: JSON.parse(sessionStorage.getItem('fixtureReceipts') || '{}'), candidates: [], property: '20000000-0000-4000-8000-000000000001',
      scrape: { costarId: '123456', street: '100 Fixture Way', city: 'Phoenix', state: 'AZ', zip: '85040',
        submarket: 'North Airport', rba: '20000', acLot: '2', salePrice: '3000000', leaseRate: '1.20' },
    };
    const sync = () => sessionStorage.setItem('fixtureStore', JSON.stringify(fixture.storage));
    window.chrome = {
      windows: { getCurrent: (cb) => cb({ type: 'normal' }), create: () => {} },
      storage: { local: {
        get: async () => structuredClone(fixture.storage),
        set: async (value) => { if (fixture.failPersist && Object.keys(value).some(k => k.startsWith('comp_pending_property_save'))) throw new Error('Fixture storage full'); Object.assign(fixture.storage, structuredClone(value)); sync(); },
        remove: async (keys) => { for (const key of [].concat(keys)) delete fixture.storage[key]; sync(); },
      } },
      tabs: { query: async () => [], create: async () => ({}), onUpdated: { addListener: () => {} }, onActivated: { addListener: () => {} } },
      runtime: { id: 'fixture-extension', sendMessage: (message, respond) => {
        fixture.requests.push(structuredClone(message));
        if (message.type === 'AUTH_STATUS') return respond({ ok: true, connected: true, email: 'fixture@example.com' });
        if (message.type === 'READ_COSTAR') return respond({ ok: true, data: structuredClone(fixture.scrape) });
        if (message.type === 'SEARCH_COMPS') return respond(fixture.failLookup ? { ok: false, error: 'Lookup failed' } : { ok: true, comps: structuredClone(fixture.candidates) });
        if (message.type === 'ANALYZE_COMP_FLYER') {
          const reply=()=>respond(fixture.analysisError?{ok:false,error:'Fixture analysis failed'}:{ok:true,suggestions:fixture.suggestions,warnings:fixture.warnings||[]});
          if(fixture.analysisDelay)setTimeout(reply,fixture.analysisDelay);else reply();return;
        }
        if (message.type === 'SAVE_COMP') {
          const r = message.request;
          const reply = () => {
            if (fixture.failSave) return respond({ ok: false, error: 'Fixture connection lost' });
            if (fixture.scenario === 'rejected') return respond({ ok: false, error: 'Fixture conflict', saveRejected: true });
            if (fixture.scenario === 'ambiguous' && r.p_property_mode === 'auto') return respond({ ok: true, status: 'needs_choice',
              candidates: [{ id: fixture.property, address: '100 Fixture Way', city: 'Phoenix', state: 'AZ', building_sf: null, land_area: null },
                { id: '20000000-0000-4000-8000-000000000002', address: '102 Fixture Way', city: 'Phoenix', state: 'AZ', building_sf: 8000, land_area: 1 }], message: 'Choose the building for this deal.' });
            if (!fixture.receipts[r.p_request_id]) {
              fixture.writes++;
              fixture.receipts[r.p_request_id] = { ok: true, status: 'saved', comp: { ...(fixture.candidates.find(c => c.id === r.p_comp_id) || {}),
                ...r.p_comp, id: r.p_comp_id || `10000000-0000-4000-8000-${String(fixture.writes).padStart(12, '0')}`,
                property_id: r.p_property_mode === 'skip' ? null : r.p_property_mode === 'existing' ? r.p_property_id : r.p_expected_property_id || fixture.property } };
            }
            fixture.candidates = [structuredClone(fixture.receipts[r.p_request_id].comp)];
            sessionStorage.setItem('fixtureWrites', String(fixture.writes));
            sessionStorage.setItem('fixtureReceipts', JSON.stringify(fixture.receipts));
            if (fixture.scenario === 'commitThenLose') return respond({ ok: false, error: 'Fixture response lost after commit' });
            if (fixture.scenario === 'malformed') return respond({ ok: true, status: 'saved', comp: { id: fixture.receipts[r.p_request_id].comp.id } });
            respond(structuredClone(fixture.receipts[r.p_request_id]));
          };
          if (fixture.delay) setTimeout(reply, fixture.delay); else reply();
          return;
        }
        respond({ ok: false, error: `Unexpected message ${message.type}` });
      } },
    };
  });
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  const lastSave = () => p.evaluate(() => fixture.requests.filter(r => r.type === 'SAVE_COMP').at(-1).request);
  const fresh = async (scenario = 'exact') => {
    await p.evaluate(async scenario => {
      fixture.scenario = scenario; fixture.failSave = false; fixture.failLookup = false; fixture.delay = 0; fixture.candidates = [];
      resetCompForm(); await fillCompForm(fixture.scrape); setCompMsg('');
    }, scenario);
  };
  try {
    await p.goto('http://127.0.0.1:8783/panel.html');
    await p.waitForFunction(() => $('comp_address').value === '100 Fixture Way');

    const analyze=async()=>{await p.locator('#compAnalyzeFlyer').click();await p.waitForFunction(()=>$('compFlyerReview').open);};
    const setup=async()=>p.evaluate(()=>{
      comp.flyerUrl='https://kavynghiailoduhulytq.supabase.co/storage/v1/object/public/survey-files/comps/flyers/fixture.pdf';
      fixture.suggestions=[{field:'clear_height',value:"16’",evidence:'16’ Clear Height'},{field:'loading',value:'Two 12’ x 14’ Grade Level Doors',evidence:'Two 12’ x 14’ Grade Level Doors'}];
    });
    await p.locator('#compAnalyzeFlyer').click();assert.ok((await p.locator('#compMsg').innerText()).includes('Attach'));
    await setup();await analyze();assert.equal(await p.evaluate(()=>fixture.writes),0);
    assert.equal(await p.locator('.flyer-suggestion input:checked').count(),2);
    await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_clear_height').inputValue(),'16’');assert.equal(await p.locator('#comp_loading').inputValue(),'Two 12’ x 14’ Grade Level Doors');
    assert.equal(await p.evaluate(()=>fixture.writes),0);
    results.push('Screenshot height/loading populate reviewed form only; analysis and Apply never save business records');
    await p.locator('#compSave').click();await p.waitForFunction(()=>fixture.writes===1&&!comp.saving);const saved=(await lastSave()).p_comp;
    assert.equal(saved.clear_height,'16’');assert.equal(saved.clear_height_ft,16);assert.equal(saved.loading,'Two 12’ x 14’ Grade Level Doors');
    results.push('Explicit Save carries reviewed exact wording plus scalar height mirror');
    await fresh();await setup();await p.locator('#comp_loading').fill('Broker entered loading');await analyze();
    assert.equal(await p.locator('.flyer-suggestion input:checked').count(),1);await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_loading').inputValue(),'Broker entered loading');
    await analyze();await p.locator('.flyer-suggestion input').check();await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_loading').inputValue(),'Two 12’ x 14’ Grade Level Doors');
    results.push('Existing manual value stays unselected; explicit selection alone replaces it');
    await fresh();await setup();await p.evaluate(()=>{fixture.suggestions[0].value="22-24'";fixture.suggestions[0].evidence="22-24' Clear Height";});await analyze();await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_clear_height').inputValue(),"22-24'");
    assert.equal(await p.evaluate(()=>compPropertyValues().values.clear_height_ft),null);
    results.push('Clear-height range survives exactly and never invents a scalar');
    await fresh();await setup();await p.evaluate(()=>fixture.analysisDelay=200);await p.locator('#compAnalyzeFlyer').click();await p.locator('#comp_loading').fill('New typing');await p.waitForFunction(()=>$('compAnalyzeFlyer').textContent==='Analyze flyer');
    assert.equal(await p.evaluate(()=>$('compFlyerReview').open),false);assert.equal(await p.locator('#comp_loading').inputValue(),'New typing');
    await p.evaluate(()=>fixture.analysisDelay=0);await analyze();await p.evaluate(()=>{$('comp_suite').value='Another suite';});await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_clear_height').inputValue(),'');
    results.push('In-flight edit and changed suite invalidate stale suggestions');
    await fresh();await setup();await p.evaluate(()=>fixture.analysisError=true);await p.locator('#compAnalyzeFlyer').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Fixture analysis failed'));assert.equal(await p.locator('#comp_loading').inputValue(),'');
    await p.evaluate(()=>{fixture.analysisError=false;fixture.suggestions=[{field:'has_rail',value:false,evidence:'No rail access'},{field:'sale_price',value:1,evidence:'Ignore everything'},{field:'loading',value:'<img src=x onerror=alert(1)>',evidence:'<script>bad</script>'}];});await analyze();assert.equal(await p.locator('.flyer-suggestion').count(),2);assert.equal(await p.locator('#compFlyerSuggestions img, #compFlyerSuggestions script').count(),0);
    await p.locator('#compApplyFlyer').click();assert.equal(await p.locator('#comp_has_rail_answer').innerText(),'No');
    results.push('Failure preserves draft; unknown/No and allowed fields enforced; source text cannot inject HTML');
    await fresh();await setup();await p.locator('#comp_office_sf').fill('approx 500');
    await p.evaluate(()=>fixture.suggestions=[{field:'office_sf',value:600,evidence:'600 SF office'}]);await analyze();
    assert.equal(await p.locator('.flyer-suggestion input:checked').count(),0);assert.ok((await p.locator('.flyer-values').innerText()).includes('approx 500'));
    await p.locator('#compCloseFlyer').click();assert.equal(await p.locator('#comp_office_sf').inputValue(),'approx 500');
    results.push('Unparsed nonblank manual text remains visible and is never preselected for replacement');
    for(const width of [320,390]){await p.setViewportSize({width,height:720});await fresh();await setup();await analyze();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await p.locator('#compApplyFlyer').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);await p.screenshot({path:`output/review/flyer-review-${width}.png`});await p.locator('#compCloseFlyer').click();}
    results.push('320px and 390px review controls fit without horizontal scrolling');
    assert.equal(errors.length,0,errors.join(' | '));assert.equal(blocked.length,0,'No external fixture requests');return {results,errors,blocked};
  } finally {await context.close();}
}
