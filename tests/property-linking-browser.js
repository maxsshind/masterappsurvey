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
    await p.waitForFunction(() => document.getElementById('comp_address').value === '100 Fixture Way');
    assert.ok(await p.getByText('Skip property link for now', { exact: true }).isVisible());
    assert.equal(await p.evaluate(() => fixture.requests.filter(r => r.type === 'SAVE_COMP').length), 0, 'Typing/reading never creates a property');
    for (const status of ['FOR SALE', 'FOR LEASE', 'FOR SALE/LEASE', 'PENDING SALE', 'PENDING LEASE']) {
      await fresh(); await p.locator('#comp_status').selectOption(status); await p.locator('#compSave').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
      const r = await lastSave(); assert.equal(r.p_property_mode, 'auto'); assert.equal(r.p_comp.status, status);
      assert.ok((await p.locator('#compOpenProperty').getAttribute('href')).includes('/properties/20000000'));
      assert.equal(await p.evaluate(() => comp.mode), 'update');
    }
    results.push('All five statuses automatically save and show Open Property; successful save retains its deal');
    for (const scenario of ['new', 'alias']) {
      await fresh(scenario); await p.locator('#compSave').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
      assert.equal((await lastSave()).p_property_mode, 'auto');
    }
    results.push('No-match and alias decisions use the shared save service without client-side eager property writes');

    await fresh(); await p.locator('#compSkipProperty').check(); await p.locator('#compSave').click();
    await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
    assert.equal((await lastSave()).p_property_mode, 'skip');
    assert.ok((await p.locator('#compPropertyStatus').innerText()).includes('Unlinked'));
    assert.equal(await p.locator('#compOpenProperty').isHidden(), true);
    results.push('Explicit skip persists an unlinked deal and shows its state');

    await fresh('ambiguous'); await p.locator('#compSave').click();
    await p.getByText('Choose the building for this deal.').waitFor();
    const first = await lastSave();
    assert.equal(await p.evaluate(() => document.activeElement.id), 'compPropertyChoiceMessage');
    await p.locator('#compCancelProperty').click();
    assert.equal(await p.locator('#compPropertyChoices').isHidden(), true);
    assert.equal(await p.evaluate(() => comp.propertyMode), 'auto');
    await p.locator('#compSave').click(); await p.locator('#comp-property-candidate-1').check();
    await p.locator('#compUseProperty').focus(); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
    const chosen = await lastSave();
    assert.equal(chosen.p_request_id, first.p_request_id); assert.equal(chosen.p_property_mode, 'existing');
    assert.equal(chosen.p_property_id, '20000000-0000-4000-8000-000000000002');
    results.push('Ambiguous candidates have accessible keyboard choice; Cancel is harmless; selected save reuses request ID');

    for (const internal of [true, false]) {
      await fresh();
      await p.evaluate(internal => enterCompUpdate({ id: '30000000-0000-4000-8000-000000000001', address: fixture.scrape.street,
        property_id: fixture.property, internal_deal: internal, source: internal ? 'manual' : 'costar', yard_included: true, suite: 'A', partial_site_override: true, multi_tenant: true }), internal);
      await p.locator('#compChangeProperty').click(); await p.locator('#compCancelProperty').click();
      assert.equal(await p.evaluate(() => comp.propertyMode), 'preserve');
      await p.evaluate(() => { fixture.failLookup = true; }); await p.locator('#compRescan').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Could not check existing deals'));
      assert.equal(await p.evaluate(() => comp.originalPropertyId), '20000000-0000-4000-8000-000000000001');
      await p.locator('#compSave').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp updated'));
      const r = await lastSave(); assert.equal(r.p_property_mode, 'preserve'); assert.equal(r.p_expected_property_id, '20000000-0000-4000-8000-000000000001');
      assert.equal(Object.hasOwn(r.p_comp, 'internal_deal'), false); assert.equal(Object.hasOwn(r.p_comp, 'source'), false);
    }
    results.push('R&G and external edits preserve links and ownership/source through canceled change and failed lookup');

    await fresh(); await p.locator('#comp_suite').fill('B');
    await p.locator('#comp_partial_site_override').selectOption('true'); await p.locator('#comp_multi_tenant').selectOption('true');
    await p.locator('#comp_building_sf').fill('7500'); await p.locator('#comp_land_area').fill('0.5'); await p.locator('#comp_yard_included').check(); await p.locator('#comp_yard_included').uncheck();
    await p.locator('#compSave').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
    const portion = await lastSave(); assert.equal(portion.p_comp.suite, 'B'); assert.equal(portion.p_comp.partial_site_override, true);
    assert.equal(portion.p_comp.building_sf, 7500); assert.equal(portion.p_comp.yard_included, false);
    assert.equal(Object.hasOwn(portion.p_property_facts, 'building_sf'), false); assert.equal(Object.hasOwn(portion.p_property_facts, 'latitude'), false);
    await p.locator('#compNewDeal').click(); assert.equal(await p.locator('#comp_yard_included').inputValue(), '');
    assert.equal(await p.evaluate(() => comp.mode), 'insert'); assert.equal(await p.evaluate(() => comp.propertyMode), 'existing');
    results.push('Suite/portion data stays on the deal; no guessed site totals/coordinates; new deal clears yard and reuses site');

    await fresh('commitThenLose'); const writesBeforeLoss = await p.evaluate(() => fixture.writes); await p.locator('#compSave').click();
    await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Retry pending save'));
    const failed = await lastSave(); assert.equal(await p.locator('#comp_address').isDisabled(), true);
    assert.ok(await p.evaluate(() => !!fixture.storage[compPendingSaveKey()]));
    await p.reload(); await p.waitForFunction(() => document.getElementById('compSave').textContent === 'Retry pending save');
    assert.equal(await p.locator('#comp_address').inputValue(), '100 Fixture Way');
    await p.locator('#compSave').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
    const retried = await lastSave(); assert.equal(JSON.stringify(retried), JSON.stringify(failed));
    assert.equal(await p.evaluate(() => fixture.storage[compPendingSaveKey()]), undefined);
    assert.equal(await p.evaluate(() => fixture.writes), writesBeforeLoss + 1, 'Committed save is recovered, not inserted twice');
    results.push('Lost-response recovery survives panel reload and sends identical request UUID/payload');

    await fresh('rejected'); await p.locator('#compSave').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Fixture conflict'));
    assert.equal(await p.locator('#comp_address').isDisabled(), false); assert.equal(await p.evaluate(() => comp.propertyMode), 'auto');
    assert.equal(await p.evaluate(() => comp.pendingSave), null);
    results.push('Confirmed rejection unlocks editable draft without changing property intent or skipping');

    await fresh(); await p.evaluate(() => { fixture.delay = 150; });
    const writes = await p.evaluate(() => fixture.writes);
    await p.evaluate(async () => { await Promise.all([saveComp(), saveComp()]); });
    assert.equal(await p.evaluate(() => fixture.writes), writes + 1, 'Concurrent Save calls dispatch one write');
    const savedId = await p.evaluate(() => comp.updateId);
    await p.locator('#compSave').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp updated'));
    assert.equal((await lastSave()).p_comp_id, savedId, 'Second save updates same deal');
    results.push('Concurrent save calls make one request and a second click updates the saved deal');

    await fresh();
    await p.evaluate(() => { fixture.failPersist = true; });
    const beforeStorageFailure = await p.evaluate(() => fixture.requests.filter(r => r.type === 'SAVE_COMP').length);
    await p.locator('#compSave').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Fixture storage full'));
    assert.equal(await p.evaluate(() => fixture.requests.filter(r => r.type === 'SAVE_COMP').length), beforeStorageFailure);
    assert.equal(await p.locator('#comp_address').isDisabled(), false);
    await p.evaluate(() => { fixture.failPersist = false; });
    results.push('Local storage failure prevents dispatch and leaves the editable draft intact');

    await fresh('malformed'); await p.locator('#compSave').click();
    await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Save response was incomplete'));
    const malformed = await lastSave(); assert.ok(await p.evaluate(() => !!comp.pendingSave));
    await p.evaluate(() => { fixture.scenario = 'exact'; }); await p.locator('#compSave').click();
    await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
    assert.equal((await lastSave()).p_request_id, malformed.p_request_id);
    assert.ok(await p.locator('#compOpenProperty').isVisible());
    results.push('Incomplete saved response cannot erase identity; exact retry recovers its property link');

    await fresh();
    await p.evaluate(() => enterCompUpdate({ id: '30000000-0000-4000-8000-000000000001', address: fixture.scrape.street, property_id: fixture.property }));
    await p.locator('#compSkipProperty').check();
    assert.ok((await p.locator('#compPropertyStatus').innerText()).includes('remove the property link'));
    await p.locator('#compSkipProperty').uncheck(); assert.equal(await p.evaluate(() => comp.propertyMode), 'preserve');
    await p.locator('#compChangeProperty').click();
    await p.evaluate(() => { fixture.scenario = 'ambiguous'; }); await p.locator('#compFindProperty').click();
    await p.locator('#comp-property-candidate-1').check(); await p.evaluate(() => { fixture.scenario = 'rejected'; });
    await p.locator('#compUseProperty').click(); await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Fixture conflict'));
    await p.locator('#compCancelProperty').click();
    assert.equal(await p.evaluate(() => comp.propertyMode), 'preserve');
    assert.equal(await p.evaluate(() => comp.propertyId), '20000000-0000-4000-8000-000000000001');
    results.push('Cancel after a rejected property replacement restores the existing link; unchecked skip keeps it');

    await fresh('ambiguous'); await p.locator('#compSave').click(); await p.getByText('Choose the building for this deal.').waitFor();
    await p.screenshot({ path: '/tmp/masterappsurvey-property-choice-390.png', fullPage: true });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '390px overflow');
    await p.setViewportSize({ width: 320, height: 800 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '320px overflow');
    await p.locator('#compCancelProperty').click();
    const blank = { order: [], hiddenSecs: [], collapsedSecs: [], openDetails: [], hiddenFields: [], fieldMoves: {}, customSecs: [] };
    await p.evaluate(async blank => {
      fixture.storage.layout_prefs = { v: 1, density: 'compact', survey: blank, comp: { ...blank, hiddenSecs: ['property', 'sizing', 'ptype'], collapsedSecs: ['yard'] } };
      sessionStorage.setItem('fixtureStore', JSON.stringify(fixture.storage));
    }, blank);
    await p.reload(); await p.waitForFunction(() => document.getElementById('comp_address').value === '100 Fixture Way');
    assert.ok(await p.getByText('Skip property link for now', { exact: true }).isVisible());
    await p.screenshot({ path: '/tmp/masterappsurvey-property-legacy-320.png', fullPage: true });
    results.push('Property controls stay visible in legacy hidden layouts; no horizontal overflow at 390px or 320px');
    assert.equal(errors.length, 0, 'Runtime errors'); assert.equal(blocked.length, 0, 'Unexpected external requests');
    return { passed: results.length, results, errors, externalRequests: blocked };
  } finally { await context.close(); }
}
