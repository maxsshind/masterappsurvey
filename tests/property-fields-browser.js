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
    const fields = ['clear_height','office_sf','lease_area','year_built','loading','power','class_a','heavy_power','has_rail','has_truckwell_or_dock'];
    const flags = fields.slice(6);
    const save = async text => { await p.locator('#compSave').click(); await p.waitForFunction(text => $('compMsg').textContent.includes(text), text); return (await lastSave()).p_comp; };
    for (const field of flags) {
      assert.equal(await p.locator('#comp_'+field+'_answer').innerText(),'Unknown');
      assert.equal(await p.locator('#comp_'+field).evaluate(n=>n.indeterminate),true);
    }
    let payload=await save('Comp saved');
    for(const field of fields)assert.equal(payload[field],null,'Untouched optional/default '+field);
    results.push('Untouched facts remain null; unknown whole-premises scope never defaults lease area');

    await fresh();
    await p.evaluate(async()=>fillCompForm({...fixture.scrape,yearBuilt:'1980',propertyFacts:{clearHeight:'24\'6"',officeSf:'6,600 SF',loading:'Docks: 10 ext',docks:'10 ext',classA:'Yes',power:'200 amps',powerSource:'Sale highlights',railLine:'Union Pacific'}}));
    assert.equal(await p.locator('#comp_clear_height').inputValue(),'24\'6"' );
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'6,600');
    assert.equal(await p.locator('#comp_class_a').isChecked(),true);
    assert.equal(await p.locator('#comp_has_truckwell_or_dock').isChecked(),true);
    assert.equal(await p.locator('#comp_heavy_power_answer').innerText(),'Unknown');
    assert.equal(await p.locator('#comp_has_rail_answer').innerText(),'Unknown');
    assert.equal(await p.locator('#comp_power').inputValue(),'200 amps');
    await p.locator('#comp_for_sale').setChecked(false);await p.locator('#comp_for_lease').setChecked(true);await p.locator('#comp_stage').selectOption('ACTIVE');
    await p.locator('#comp_lease_area').fill('12000'); await p.locator('#comp_office_sf').fill('4500');
    await p.locator('#comp_clear_height').fill('18\'6"');
    await p.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase'); await p.locator('#comp_year_built').fill('2001'); await p.locator('#comp_loading').fill('2 docks; 1 grade-level door');
    await p.locator('#comp_heavy_power').check(); await p.locator('#comp_has_rail').check(); await p.locator('#comp_has_rail').uncheck();
    assert.equal(await p.locator('#comp_has_rail_answer').innerText(),'No');
    await p.locator('#comp_ptypes label[title="ISF"]').click(); await p.locator('#comp_ptypes label[title="Vintage"]').click();
    payload=await save('Comp saved');
    assert.equal(payload.property_type,'ISF, Vintage');
    for(const [key,value] of Object.entries({clear_height:'18\'6"',clear_height_ft:18.5,office_sf:4500,lease_area:12000,year_built:2001,loading:'2 docks; 1 grade-level door',power:'3,400 amps, 277/480V, 3-phase',class_a:true,heavy_power:true,has_rail:false,has_truckwell_or_dock:true}))assert.equal(payload[key],value,key);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'4,500'); assert.equal(await p.locator('#comp_lease_area').inputValue(),'12,000');
    results.push('Source capture and actual edited controls serialize numbers/units and explicit Yes/No; SF displays commas after save');

    await p.locator('#comp_notes').fill('Notes only'); payload=await save('Comp updated');
    for(const key of fields)assert.equal(Object.hasOwn(payload,key),false,'Notes save preserves '+key);
    await p.locator('#comp_office_sf').fill('0'); await p.locator('#comp_clear_height').fill(''); await p.locator('#comp_loading').fill('');
    await p.locator('#comp_power').fill(''); await p.locator('#comp_heavy_power').uncheck(); await p.locator('[data-clear-comp-feature="has_rail"]').click();
    payload=await save('Comp updated');
    for(const [key,value] of Object.entries({office_sf:0,clear_height:null,clear_height_ft:null,loading:null,power:null,heavy_power:false,has_rail:null}))assert.equal(payload[key],value,key);
    for(const key of ['class_a','has_truckwell_or_dock','lease_area','year_built'])assert.equal(Object.hasOwn(payload,key),false,'Untouched saved '+key);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'0'); assert.equal(await p.locator('#comp_has_rail').evaluate(n=>n.indeterminate),true);
    results.push('Unrelated updates omit all new facts; intentional zero/No/null clears survive authoritative readback');

    await fresh();
    const baseline={status:'FOR SALE/LEASE',id:'30000000-0000-4000-8000-000000000001',address:'100 Fixture Way',property_id:'20000000-0000-4000-8000-000000000001',clear_height_ft:32,office_sf:1500,lease_area:12000,year_built:1995,loading:'Truckwell',property_type:'ISF, Class C',class_a:false,heavy_power:true,has_rail:null,has_truckwell_or_dock:true};
    await p.evaluate(row=>{fixture.candidates=[row];enterCompUpdate(row);},baseline);
    assert.equal(await p.locator('#comp_ptypes input[value="Vintage"]').isChecked(),true);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'1,500'); assert.equal(await p.locator('#comp_heavy_power').isChecked(),true);
    await p.locator('#comp_office_sf').fill('2500'); await p.locator('[data-clear-comp-feature="heavy_power"]').click();
    await p.evaluate(async row=>{await fillCompForm({...fixture.scrape,propertyFacts:{officeSf:'6600 SF',heavyPower:'Yes'}});enterCompUpdate(row);},baseline);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'2,500'); assert.equal(await p.locator('#comp_heavy_power_answer').innerText(),'Unknown');
    await p.evaluate(row=>enterCompUpdate({...row,id:'30000000-0000-4000-8000-000000000002',office_sf:700,heavy_power:false}),baseline);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'700'); assert.equal(await p.locator('#comp_heavy_power_answer').innerText(),'No');
    await p.locator('#compNewDeal').click();
    for(const field of fields)assert.equal(await p.locator('#comp_'+field).inputValue(),'','Separate deal '+field);
    results.push('Saved facts hydrate; same-deal re-read preserves manual edits and clears; another row and separate deal cannot inherit them');

    await fresh(); await p.locator('#comp_office_sf').fill('3300'); await p.locator('#comp_notes').focus();
    await p.evaluate(row=>enterCompUpdate(row),baseline);
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'3,300');
    results.push('Manual review before choosing Update this comp is retained');

    await fresh();
    const before=await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length);
    for(const [field,value] of [['clear_height','x'.repeat(201)],['office_sf','4,50'],['lease_area','0'],['year_built','2000s']]){
      await p.locator('#comp_for_sale').setChecked(false);await p.locator('#comp_for_lease').setChecked(true);await p.locator('#comp_stage').selectOption('ACTIVE');
      if(field==='clear_height')await p.locator('#comp_'+field).evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},value);
      else await p.locator('#comp_'+field).fill(value);
      await p.locator('#compSave').click();
      assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length),before,'Invalid '+field+' never writes');
      assert.equal(await p.locator('#comp_'+field).inputValue(),value,'Invalid input not truncated');
      await p.locator('#comp_'+field).fill('');
    }
    await p.locator('#comp_loading').evaluate(n=>{n.value='x'.repeat(4001);n.dispatchEvent(new Event('input',{bubbles:true}));}); await p.locator('#compSave').click();
    assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length),before);
    results.push('Oversized height text, malformed/ranged SF, invalid year, zero lease area and oversized loading block all writes without silent truncation');

    await fresh();
    await p.evaluate(async()=>fillCompForm({...fixture.scrape,selectedSpace:{identity:'suite-a',suite:'A',availableSf:'1200'},propertyFacts:{scope:'selected-space',officeSf:'100 SF',loading:'Docks: 2',docks:'2'}}));
    await p.locator('#comp_heavy_power').check();
    await p.evaluate(async()=>fillCompForm({...fixture.scrape,selectedSpace:{identity:'suite-b',suite:'B',availableSf:'2400'},propertyFacts:{scope:'selected-space'}}));
    assert.equal(await p.locator('#comp_suite').inputValue(),'B'); assert.equal(await p.locator('#comp_lease_area').inputValue(),'2,400');
    for(const field of ['office_sf','loading','heavy_power','has_truckwell_or_dock'])assert.equal(await p.locator('#comp_'+field).inputValue(),'','Different suite '+field);
    await p.evaluate(async()=>fillCompForm({...fixture.scrape,selectedSpace:{identity:'suite-c',suite:'C',availableRange:{min:'5000',max:'10000'}},propertyFacts:{officeSf:'600',docks:'10',loading:'Docks: 10'}}));
    for(const field of ['office_sf','lease_area','loading','has_truckwell_or_dock'])assert.equal(await p.locator('#comp_'+field).inputValue(),'','Divisible suite '+field);
    results.push('Re-reading another selected suite resets offering facts; a divisible suite never inherits whole-source office/loading/flags');

    await fresh('commitThenLose'); await p.locator('#comp_clear_height').fill("22-24'"); await p.locator('#comp_office_sf').fill('6500'); await p.locator('#comp_heavy_power').check(); await p.locator('#comp_has_rail').check(); await p.locator('#comp_has_rail').uncheck();
    await p.locator('#compSave').click(); await p.waitForFunction(()=>$('compMsg').textContent.includes('Retry pending save'));
    const pending=await lastSave(); await p.reload(); await p.waitForFunction(()=>$('compSave').textContent==='Retry pending save');
    assert.equal(await p.locator('#comp_clear_height').inputValue(),"22-24'"); assert.equal(await p.locator('#comp_office_sf').inputValue(),'6,500'); assert.equal(await p.locator('#comp_heavy_power').isChecked(),true); assert.equal(await p.locator('#comp_has_rail_answer').innerText(),'No'); assert.equal(await p.locator('#comp_class_a').evaluate(n=>n.indeterminate),true);
    await save('Comp saved'); assert.equal(JSON.stringify(await lastSave()),JSON.stringify(pending));
    results.push('Lost-response reload restores numeric text, Yes/No/Unknown and exact immutable save request');


    for(const [raw,numeric] of [["22-24'",null],['22–24′',null],['18–22 ft depending on bay',null],["24'6\"",24.5]]){
      await fresh(); await p.locator('#comp_clear_height').fill(raw);payload=await save('Comp saved');
      assert.equal(payload.clear_height,raw);assert.equal(payload.clear_height_ft,numeric);assert.equal(await p.locator('#comp_clear_height').inputValue(),raw);
      await p.locator('#comp_notes').fill('Unrelated follow-up');payload=await save('Comp updated');
      assert.equal(Object.hasOwn(payload,'clear_height'),false);assert.equal(Object.hasOwn(payload,'clear_height_ft'),false);
    }
    results.push('Exact ASCII/unicode ranges and descriptions persist without a fabricated scalar; single height retains its numeric equivalent; unrelated edits omit both');
    await fresh(); await p.evaluate(row=>{fixture.candidates=[row];enterCompUpdate(row);},baseline);
    assert.equal(await p.locator('#comp_clear_height').inputValue(),'32');
    await p.locator('#comp_clear_height').fill("22-24'");payload=await save('Comp updated');
    assert.equal(payload.clear_height,"22-24'");assert.equal(payload.clear_height_ft,null);
    await p.locator('#comp_clear_height').fill('');payload=await save('Comp updated');assert.equal(payload.clear_height,null);assert.equal(payload.clear_height_ft,null);
    results.push('Legacy numeric height hydrates; replacing with a range removes obsolete scalar and clearing sends both null');
    await fresh('commitThenLose');await p.locator('#comp_clear_height').fill('22.5');await p.locator('#compSave').click();await p.waitForFunction(()=>$('compMsg').textContent.includes('Retry pending save'));
    const oldPending=await p.evaluate(()=>{
      const pending=fixture.storage[compPendingSaveKey()];delete pending.request.p_comp.clear_height;
      pending.draft.fields.comp_clear_height_ft='22.5';delete pending.draft.fields.comp_clear_height;
      pending.draft.propertyFieldsEdited={clear_height_ft:true};
      delete fixture.receipts[pending.request.p_request_id].comp.clear_height;
      sessionStorage.setItem('fixtureStore',JSON.stringify(fixture.storage));sessionStorage.setItem('fixtureReceipts',JSON.stringify(fixture.receipts));return pending.request;
    });
    await p.reload();await p.waitForFunction(()=>$('compSave').textContent==='Retry pending save');assert.equal(await p.locator('#comp_clear_height').inputValue(),'22.5');
    await save('Comp saved');assert.equal(JSON.stringify(await lastSave()),JSON.stringify(oldPending));assert.equal(await p.locator('#comp_clear_height').inputValue(),'22.5');
    results.push('Older numeric-only pending save restores the new text control and retries its original payload unchanged');
    const blank={order:[],hiddenSecs:[],collapsedSecs:[],openDetails:[],hiddenFields:[],fieldMoves:{},customSecs:[]};
    await p.evaluate(blank=>{fixture.storage.layout_prefs={v:1,density:'compact',survey:blank,comp:{...blank,hiddenSecs:['sizing','ptype'],collapsedSecs:['yard'],fieldMoves:{comp_clear_height_ft:'height-review'},customSecs:[{key:'height-review',title:'My height review'}]}};sessionStorage.setItem('fixtureStore',JSON.stringify(fixture.storage));},blank);
    await p.reload();await p.waitForFunction(()=>$('comp_address').value==='100 Fixture Way');
    assert.equal(await p.locator('#comp_clear_height').evaluate(n=>n.closest('[data-sec]').dataset.sec),'height-review');
    await p.locator('#comp_clear_height').fill("22-24'");assert.equal(await p.locator('#comp_clear_height').inputValue(),"22-24'");
    for(const width of [390,320]){
      await p.setViewportSize({width,height:900});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+'px overflow');
      assert.equal(await p.locator('#comp_has_truckwell_or_dock').isVisible(),false,'Saved Features collapse respected');
      await p.locator('#comp_loading').scrollIntoViewIfNeeded();
      await p.screenshot({path:'/tmp/masterappsurvey-property-fields-'+width+'.png'});
    }
    results.push('New text field retains numeric-era custom placement; controls remain discoverable and fit 390px/320px');
    assert.equal(errors.length,0,'Runtime errors');assert.equal(blocked.length,0,'External requests');
    return {passed:results.length,results,errors,externalRequests:blocked};
  } finally { await context.close(); }
}
