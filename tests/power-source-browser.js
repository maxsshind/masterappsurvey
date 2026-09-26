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
      scrape: { sourceOfferings: ['sale','lease'], costarId: '123456', street: '100 Fixture Way', city: 'Phoenix', state: 'AZ', zip: '85040',
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
    const fallback='800a/120 - 208v 3p Heavy';
    const read = async (facts={}) => p.evaluate(async facts => {fixture.scrape.propertyFacts=facts;await fillCompForm(fixture.scrape);},facts);
    await read({powerFallback:fallback,loading:'Docks: None; Drive-ins: 7 tot.'});
    assert.equal(await p.locator('#comp_power').inputValue(),'');
    assert.equal(await p.locator('#compPowerFallback').isVisible(),true);
    assert.equal(await p.locator('#compPowerFallbackValue').innerText(),fallback);
    assert.equal(await p.locator('#comp_loading').inputValue(),'Docks: None; Drive-ins: 7 tot.');
    assert.equal(await p.locator('#comp_heavy_power_answer').innerText(),'Unknown');
    results.push('Property power is shown as an explicit choice while Power remains blank; Loading has no levelators');
    for(const width of [390,320]) {
      await p.setViewportSize({width,height:950});await p.locator('#comp_power').scrollIntoViewIfNeeded();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await p.locator('#compUsePropertyPower').isVisible(),true);
      assert.equal(await p.locator('#compSkipPropertyPower').isVisible(),true);
      await p.screenshot({path:'output/review/power-fallback-'+width+'.png'});
    }
    results.push('Power choice and both actions fit 390px and 320px without horizontal scrolling');
    await p.locator('#compUsePropertyPower').click();
    assert.equal(await p.locator('#comp_power').inputValue(),fallback);
    assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    await read({power:'1,000 amps',powerSource:'Sale highlights',powerFallback:'600 amps'});
    assert.equal(await p.locator('#comp_power').inputValue(),fallback);
    await p.locator('#compSave').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Comp saved'));
    assert.equal((await lastSave()).p_comp.power,fallback);assert.equal((await lastSave()).p_comp.heavy_power,null);
    results.push('Accepting property power protects that reviewed value on re-read and saves it without inferring Heavy power');
    await fresh(); await read({powerFallback:fallback});await p.locator('#compSkipPropertyPower').click();
    await read({power:'1,000 amps',powerSource:'Sale highlights',powerFallback:fallback});
    assert.equal(await p.locator('#comp_power').inputValue(),'');assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    assert.equal(await p.evaluate(()=>compDraftSnapshot().powerFallbackDismissed),true);
    results.push('Keep blank is a deliberate clear, retained even if a later re-read discovers marketing power');
    await fresh();await read({power:'600AMP 277/480V 3-Phase power',powerSource:'Sale highlights',powerFallback:fallback});
    assert.equal(await p.locator('#comp_power').inputValue(),'600AMP 277/480V 3-Phase power');
    assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    assert.ok((await p.locator('#comp_power').locator('..').innerText()).includes('Sale highlights'));
    await p.locator('#comp_power').fill('');await read({power:'600 amps',powerSource:'Description',powerFallback:fallback});
    assert.equal(await p.locator('#comp_power').inputValue(),'');assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    results.push('Marketing power shows its source; a typed clear survives refresh and does not reopen the property prompt');
    await p.evaluate(async fallback=>{await fillCompForm({...fixture.scrape,costarId:'next-property',street:'102 Fixture Way',propertyFacts:{powerFallback:fallback}});},fallback);
    assert.equal(await p.locator('#comp_power').inputValue(),'');assert.equal(await p.locator('#compPowerFallback').isVisible(),true);
    await p.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');
    await read({powerFallback:fallback});
    // read returns to the original listing; same-source typing is checked separately.
    await p.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');await read({powerFallback:fallback});
    assert.equal(await p.locator('#comp_power').inputValue(),'3,400 amps, 277/480V, 3-phase');assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    results.push('Different properties reset the choice; manual power is never replaced or accompanied by a conflicting fallback');
    await fresh();await read({power:'800 amps\nUtilities\nWater'});
    assert.equal(await p.locator('#comp_power').inputValue(),'');assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    await read({powerFallback:fallback});
    await p.evaluate(()=>enterCompUpdate({id:'30000000-0000-4000-8000-000000000001',address:'100 Fixture Way',property_id:null,power:null}));
    assert.equal(await p.locator('#comp_power').inputValue(),'');assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    results.push('Unmarked old scrape text cannot reintroduce spillover; saved unknown Power stays unknown during updates');
    await fresh('commitThenLose');await read({powerFallback:fallback});await p.locator('#compUsePropertyPower').click();
    await p.locator('#compSave').click();await p.waitForFunction(()=>$('compSave').textContent==='Retry pending save');
    const request=await lastSave();await p.reload();await p.waitForFunction(()=>$('compSave').textContent==='Retry pending save');
    assert.equal(await p.locator('#comp_power').inputValue(),fallback);assert.equal(await p.locator('#compPowerFallback').isVisible(),false);
    await p.locator('#compSave').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Comp saved'));
    assert.equal(JSON.stringify(await lastSave()),JSON.stringify(request));
    results.push('Accepted property power survives a lost-response reload and retries the original request unchanged');
    assert.equal(errors.length,0,'Runtime errors');assert.equal(blocked.length,0,'External requests');
    return {passed:results.length,results,errors,externalRequests:blocked};
  } finally { await context.close(); }
}
