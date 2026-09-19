// Serve the extension at 127.0.0.1:8783 and run via browser_run_code_unsafe(filename).
// Mounts the actual panel, mocks Chrome's boundary, and blocks non-local requests.
async (page) => {
  const assert = {
    equal(a, b, why = 'Values differ') { if (a !== b) throw new Error(`${why}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
    ok(a, why = 'Expected true') { if (!a) throw new Error(why); },
  };
  const browser = page.context().browser();
  const results = [], metrics = [];
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
        submarket: 'North Airport', rba: '20000', acLot: '2', salePrice: '3000000', leaseRate: '1.20', saleHighlights: 'Fixture marketing highlights for a small industrial property.', saleNotes: 'Fixture sale description. ' .repeat(12) },
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
    const pickFeature = async (name, value) => {
      const selector = await p.evaluate(name => {
        const hidden = document.getElementById('comp_' + name);
        const candidates = [...document.querySelectorAll('[data-comp-feature-select]')];
        const n = candidates.find(n => [name, 'comp_' + name].includes(n.dataset.compFeatureSelect)) || hidden.closest('label, .comp-feature-control, .comp-feature, .fld')?.querySelector('[data-comp-feature-select]');
        if (!n) throw new Error('Missing feature select: ' + name);
        return n.id ? '#' + n.id : '[data-comp-feature-select="' + n.dataset.compFeatureSelect + '"]';
      }, name);
      await p.locator(selector).selectOption(value);
    };
    const save = async () => {
      await p.locator('#compSave').click();
      await p.waitForFunction(() => $('compMsg').textContent.includes('Comp saved') || $('compMsg').textContent.includes('Comp updated'));
      return (await lastSave()).p_comp;
    };
    for (const width of [320, 390, 585, 720]) {
      await p.setViewportSize({width, height:900});
      await p.evaluate(() => Layout.apply('comp'));
      await p.screenshot({path:'output/review/compact-'+width+'.png',fullPage:true});
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,width+'px overflow '+JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).map(n=>({id:n.id,cls:n.className,right:n.getBoundingClientRect().right})).slice(0,15))));
      assert.equal(await p.locator('#compPropertyHelp').evaluate(n=>n.open),false,'Property detail is initially collapsed');
      assert.equal(await p.locator('#compSkipProperty').isVisible(),true,'Skip remains directly available');
      assert.equal(await p.locator('#compContentImport').isVisible(),true,'Description remains available');
      const importBox = await p.locator('#compContentImport').boundingBox();
      const propertyBox = await p.locator('#screen-comp [data-sec="property"]').boundingBox();
      assert.ok(importBox.y < propertyBox.y,'Description remains above Property');
      assert.ok(importBox.height < 230,'Description stays compact');
      metrics.push({width,descriptionHeight:importBox.height,propertyTop:propertyBox.y+(await p.evaluate(()=>scrollY)),scrollHeight:await p.evaluate(()=>document.documentElement.scrollHeight),scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
      const font = await p.locator('#comp_address').evaluate(n=>parseFloat(getComputedStyle(n).fontSize));
      assert.ok(font >= 13,'Readable field font');
      for (const section of ['property','sizing','space-specs','notes']) {
        await p.locator('#screen-comp [data-sec="'+section+'"]').evaluate(n=>n.classList.add('sec-collapsed'));
        await p.locator('[data-comp-jump="'+section+'"]').click();
        assert.equal(await p.locator('#screen-comp [data-sec="'+section+'"]').evaluate(n=>n.classList.contains('sec-collapsed')),false,'Jump expands '+section);
        const bar = await p.locator('[data-comp-jump="property"]').boundingBox();
        assert.ok(bar.y>=0 && bar.y+bar.height<=900,'Sticky navigation remains in viewport');
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Jump introduces no overflow');
      }
      await p.evaluate(()=>window.scrollTo(0,0));
      await p.screenshot({path:'output/review/compact-'+width+'.png',fullPage:true});
    }
    results.push('320/390/585/720px: no horizontal overflow, readable fields, compact description retained near top, visible skip, sticky navigation expands each collapsed section');
    await fresh();
    await p.locator('#comp_status').selectOption('FOR SALE/LEASE');
    await p.locator('#comp_land_area').fill('');
    await p.locator('#comp_building_sf').fill('');
    await p.locator('#comp_sale_price').fill('');
    await p.locator('#comp_rent_psf').fill('');
    const missing = await p.evaluate(()=>compMissingFields().map(f=>f.id));
    assert.ok(missing.length>=2,'Fixture has multiple missing fields');
    const focused=[];
    for(let i=0;i<missing.length;i++){
      await p.locator('#compCompleteness').click();
      focused.push(await p.evaluate(()=>document.activeElement.id));
    }
    assert.equal(new Set(focused).size,missing.length,'Review cycles through missing fields');
    assert.ok(focused.every(id=>missing.includes(id)),'Review focuses only missing fields');
    results.push('Clickable missing-field summary cycles focus through missing controls');
    await fresh();
    for(const name of ['yard_included','class_a','heavy_power','has_rail','has_truckwell_or_dock']) {
      for(const value of ['true','false','']) {
        await pickFeature(name,value);
        const payload=await save();
        assert.equal(payload[name],value===''?null:value==='true',name+' tri-state payload '+value);
      }
    }
    results.push('All five feature selectors serialize Yes/No/Unknown as true/false/null across repeated saves');
    await fresh();
    await p.locator('#comp_loading').fill('Two grade level doors');
    await p.locator('#comp_power').fill('600 amps, 480V, 3-phase');
    const shortHeight=await p.locator('#comp_loading').evaluate(n=>n.clientHeight);
    const longLoading=Array.from({length:10},(_,i)=>'Loading detail '+i).join('\n');
    await p.locator('#comp_loading').fill(longLoading);
    assert.ok(await p.locator('#comp_loading').evaluate(n=>n.clientHeight)>shortHeight,'Loading grows with content');
    await p.evaluate(()=>fillCompForm(fixture.scrape));
    assert.equal(await p.locator('#comp_loading').inputValue(),longLoading,'Re-read preserves typed loading');
    assert.equal(await p.locator('#comp_power').inputValue(),'600 amps, 480V, 3-phase','Re-read preserves typed power');
    const payload=await save();
    assert.equal(payload.loading,longLoading,'Save preserves loading');
    assert.equal(payload.power,'600 amps, 480V, 3-phase','Save preserves power');
    results.push('Textareas grow and typed loading/power survive source re-read and serialization');
    assert.equal(errors.length,0,'Runtime errors');
    assert.equal(blocked.length,0,'External requests');
    return {passed:results.length,results,metrics,errors,externalRequests:blocked};
  } finally {await context.close();}
}
