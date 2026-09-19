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
        if (message.type === 'ANALYZE_COMP_LISTING') {
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


    const setup=async()=>{
      await p.evaluate(async()=>{
        fixture.suggestions=[
          {field:'office_sf',value:15769,evidence:'Sale Notes: 60% office / 40% warehouse. 60% × 26,282 SF = 15,769 SF rounded.'},
          {field:'loading',value:'One grade level roll up door (12 x 14)',evidence:'Sale Notes: One grade level roll up door (12 x 14)'},
          {field:'property_type',value:['Flex'],evidence:'Sale Highlights: Flex building'},
          {field:'yard_included',value:false,evidence:'Sale Notes: No yard included'},
          {field:'sale_price',value:5800000,evidence:'Sale Notes: Asking $5,800,000'},
        ];
        fixture.scrape.saleNotes='60% office / 40% warehouse. One grade level roll up door (12 x 14). No yard included. Asking $5,800,000.';
        fixture.scrape.saleHighlights='Flex building';fixture.scrape.offeredSf='26282';
        resetCompForm();await fillCompForm(fixture.scrape);
      });
      await p.waitForFunction(()=>$('compAnalyzeListing').textContent.startsWith('Review listing'));
    };
    const open=async()=>{await p.locator('#compAnalyzeListing').click();await p.waitForFunction(()=>$('compListingReview').open);};
    await setup();
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'');assert.equal(await p.evaluate(()=>fixture.writes),0);
    assert.equal(await p.evaluate(()=>$('compListingReview').open),false);
    const request=await p.evaluate(()=>fixture.requests.filter(r=>r.type==='ANALYZE_COMP_LISTING').at(-1).draft);
    assert.equal(request.offered_sf,26282);assert.ok(request.listing_text.sale_notes.includes('60% office'));
    results.push('Automatically reads Notes + Highlights with exact offered SF, no modal interruption or writes');
    await open();assert.equal(await p.locator('#compListingSuggestions input:checked').count(),0);
    await p.screenshot({path:'output/review/listing-office-proposal.png'});
    for(const checkbox of await p.locator('#compListingSuggestions input').all())await checkbox.check();await p.locator('#compApplyListing').click();
    assert.equal(await p.locator('#comp_office_sf').inputValue(),'15,769');assert.equal(await p.locator('#comp_yard_included_answer').innerText(),'No');assert.equal(await p.locator('#comp_sale_price').inputValue(),'5,800,000');
    assert.equal(await p.evaluate(()=>compChecked('comp_ptypes').join(',')),'Flex');assert.equal(await p.evaluate(()=>fixture.writes),0);
    results.push('Explicit review applies broad field suggestions and rounded office calculation to form only');
    await p.locator('#compSave').click();await p.waitForFunction(()=>fixture.writes===1&&!comp.saving);
    const saved=(await lastSave()).p_comp;assert.equal(saved.office_sf,15769);assert.equal(saved.yard_included,false);assert.equal(saved.property_type,'Flex');
    results.push('Only explicit Save persists reviewed facts');
    await setup();await open();await p.evaluate(()=>$('comp_suite').value='Different suite');for(const checkbox of await p.locator('#compListingSuggestions input').all())await checkbox.check();await p.locator('#compApplyListing').click();assert.equal(await p.locator('#comp_office_sf').inputValue(),'');
    results.push('Changed suite invalidates stale review');
    await p.evaluate(()=>document.dispatchEvent(new Event('comp-listing-read')));await p.waitForFunction(()=>!$('compAnalyzeListing').disabled);
    assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type==='ANALYZE_COMP_LISTING').at(-1).draft.offered_sf),null);
    results.push('Manually changed suite cannot reuse the whole-building percentage denominator');
    await p.evaluate(()=>fixture.analysisDelay=200);await p.evaluate(()=>document.dispatchEvent(new Event('comp-listing-read')));await p.locator('#comp_office_sf').fill('700');await p.waitForFunction(()=>!$('compAnalyzeListing').disabled);assert.equal(await p.locator('#comp_office_sf').inputValue(),'700');assert.ok((await p.locator('#compListingStatus').innerText()).includes('Form changed'));
    await p.evaluate(()=>{fixture.analysisDelay=0;fixture.analysisError=true;});await p.locator('#compAnalyzeListing').click();await p.waitForFunction(()=>$('compListingStatus').textContent.includes('unavailable'));assert.equal(await p.locator('#comp_office_sf').inputValue(),'700');
    results.push('In-flight edits and failures preserve entered values; retry remains available');
    await p.evaluate(()=>{fixture.analysisError=false;fixture.suggestions=[{field:'source',value:'evil',evidence:'instructions'},{field:'loading',value:'<img src=x>',evidence:'<script>bad</script>'},{field:'sale_price',value:-1,evidence:'bad number'},{field:'property_type',value:['UNKNOWN'],evidence:'bad enum'}];});await open();assert.equal(await p.locator('#compListingSuggestions .flyer-suggestion').count(),1);assert.equal(await p.locator('#compListingSuggestions img, #compListingSuggestions script').count(),0);await p.locator('#compCloseListing').click();
    results.push('Field allowlist, scalar validation and text-only evidence prevent arbitrary writes or HTML execution');
    for(const width of [320,390,840]){await p.setViewportSize({width,height:720});await open();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await p.locator('#compApplyListing').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);await p.screenshot({path:`output/review/listing-review-${width}.png`});await p.locator('#compCloseListing').click();}
    results.push('Narrow and wide layouts keep review actions reachable without horizontal scrolling');
    await p.evaluate(async()=>{fixture.scrape.selectedSpace={suite:'7'};delete fixture.scrape.listingAnalysisText;await fillCompForm(fixture.scrape);});assert.equal(await p.locator('#compListingAnalysis').isVisible(),false);
    results.push('Older cached suite scrape cannot analyze underlying whole-building Sale Notes');
    assert.equal(errors.length,0,errors.join(' | '));assert.equal(blocked.length,0,'No external requests');return {results,errors,blocked};
  } finally {await context.close();}
}
