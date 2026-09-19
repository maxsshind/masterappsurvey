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
    const save=async()=>{await p.locator('#compSave').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Comp saved')||$('compMsg').textContent.includes('Comp updated'));return (await lastSave()).p_comp;};
    await p.locator('#comp_status').selectOption('FOR LEASE');
    assert.equal(await p.locator('#comp_lease_area').inputValue(),'20,000');
    assert.equal(await p.locator('#compLeaseDefaultHint').isVisible(),true);
    assert.ok((await p.locator('#comp_lease_area').locator('..').innerText()).includes('Building SF default'));
    await p.locator('#comp_building_sf').fill('31426');assert.equal(await p.locator('#comp_lease_area').inputValue(),'31,426');
    for(const field of ['multi_tenant','partial_site_override']){
      await p.locator('#comp_'+field).selectOption('true');assert.equal(await p.locator('#comp_lease_area').inputValue(),'');
      await p.locator('#comp_'+field).selectOption('');assert.equal(await p.locator('#comp_lease_area').inputValue(),'31,426');
    }
    await p.locator('#comp_status').selectOption('FOR SALE');assert.equal(await p.locator('#comp_lease_area').inputValue(),'');
    await p.locator('#comp_status').selectOption('FOR SALE/LEASE');assert.equal(await p.locator('#comp_lease_area').inputValue(),'31,426');
    let payload=await save();assert.equal(payload.lease_area,31426);
    await p.locator('#comp_building_sf').fill('35000');payload=await save();assert.equal(Object.hasOwn(payload,'lease_area'),false);assert.equal(await p.locator('#comp_lease_area').inputValue(),'31,426');
    results.push('Untouched lease default follows Building SF and status; either site flag disables it; saved size never silently follows later building edits');
    for(const value of ['1200','']){
      await fresh();await p.locator('#comp_lease_area').fill(value);
      await p.locator('#comp_building_sf').fill('40000');await p.locator('#comp_multi_tenant').selectOption('true');await p.locator('#comp_multi_tenant').selectOption('');
      await p.evaluate(()=>fillCompForm(fixture.scrape));
      assert.equal(await p.locator('#comp_lease_area').inputValue(),value?'1,200':'');assert.equal(await p.locator('#compLeaseDefaultHint').isVisible(),false);
      payload=await save();assert.equal(payload.lease_area,value?1200:null);
    }
    results.push('Manual lease size and deliberate blank survive building edits, flags and re-read');
    await fresh();await p.evaluate(()=>fillCompForm({...fixture.scrape,selectedSpace:{identity:'suite-7',suite:'7',availableSf:'1200'},propertyFacts:{power:'200 amps'}}));
    await p.locator('#comp_building_sf').fill('50000');await p.locator('#comp_multi_tenant').selectOption('true');
    assert.equal(await p.locator('#comp_lease_area').inputValue(),'1,200');
    await p.evaluate(()=>fillCompForm({...fixture.scrape,selectedSpace:{identity:'suite-7',suite:'7'},propertyFacts:{}}));
    assert.equal(await p.locator('#comp_lease_area').inputValue(),'1,200');
    await fresh();await p.evaluate(()=>enterCompUpdate({id:'test-existing',property_id:null,address:'100 Fixture Way',lease_area:null,power:'Saved 600A',multi_tenant:null}));
    await p.locator('#comp_building_sf').fill('30000');assert.equal(await p.locator('#comp_lease_area').inputValue(),'');
    assert.equal(await p.locator('#comp_power').inputValue(),'Saved 600A');
    results.push('Captured suite size survives missing source refresh; existing saved blank is never defaulted; Power hydrates');
    await fresh('commitThenLose');await p.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');await p.locator('#comp_yard_included_choice').focus(); await p.locator('#comp_yard_included_choice').selectOption('true');
    await p.locator('#compSave').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Retry pending save'));
    const pending=await lastSave();await p.reload();await p.waitForFunction(()=>$('compSave').textContent==='Retry pending save');
    assert.equal(await p.locator('#comp_power').inputValue(),'3,400 amps, 277/480V, 3-phase');assert.equal(await p.locator('#comp_yard_included').isChecked(),true);
    assert.equal(await p.locator('#comp_lease_area').inputValue(),'20,000');await save();assert.equal(JSON.stringify(await lastSave()),JSON.stringify(pending));
    results.push('Pending save reload preserves Power, Yard, default area and exact immutable retry');
    await fresh();await p.locator('#comp_power').evaluate(n=>{n.value='x'.repeat(4001);n.dispatchEvent(new Event('input',{bubbles:true}));});
    const count=await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length);await p.locator('#compSave').click();assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length),count);
    await p.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');
    assert.equal(await p.locator('#comp_heavy_power_answer').innerText(),'Unknown');
    results.push('Overlong Power blocked before save; amp text never checks Heavy power');
    await p.evaluate(()=>setCompMsg(''));
    for(const width of [560,720,390,320]){
      await p.setViewportSize({width,height:1000});await p.evaluate(()=>Layout.apply('comp'));
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+'px overflow');
      const a=await p.locator('[data-sec="ptype"]').boundingBox(),b=await p.locator('[data-sec="yard"]').boundingBox();
      if(width>=540){assert.ok(Math.abs(a.y-b.y)<2,'Same row');assert.ok(b.x>=a.x+a.width,'Features right of type');}
      else assert.ok(b.y>=a.y+a.height,'Features stack below type');
      for(const f of ['yard_included','class_a','heavy_power','has_rail','has_truckwell_or_dock'])assert.equal(await p.locator('#comp_'+f).evaluate(n=>n.closest('[data-sec]').dataset.sec),'yard');
      await p.locator('[data-sec="ptype"]').evaluate(n=>window.scrollTo(0,n.getBoundingClientRect().top+window.scrollY-65));await p.screenshot({path:'/tmp/masterappsurvey-features-'+width+'.png'});
    }
    results.push('Yard and features share controls; type/features side by side560/720 and stacked390/320, no overflow');
    assert.equal(errors.length,0,'Runtime errors');assert.equal(blocked.length,0,'External requests');
    return {passed:results.length,results,errors,externalRequests:blocked};
  } finally {await context.close();}
}
