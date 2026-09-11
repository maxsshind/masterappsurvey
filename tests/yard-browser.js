// Run with Playwright browser_run_code_unsafe(filename) while serving the extension
// at 127.0.0.1:8783. Uses the actual mounted panel and Chrome message contract, with
// all backend responses mocked and all non-local network requests blocked.
async (page) => {
  const assert = {
    equal(actual, expected, message = 'Values differ') {
      if (actual !== expected) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
    },
    deepEqual(actual, expected, message = 'Objects differ') {
      this.equal(JSON.stringify(actual), JSON.stringify(expected), message);
    },
    ok(value, message = 'Expected truthy value') { if (!value) throw new Error(message); },
  };
  const browser = page.context().browser();
  const results = [];
  const blank = { order: [], hiddenSecs: [], collapsedSecs: [], openDetails: [], hiddenFields: [], fieldMoves: {}, customSecs: [] };
  const oldSections = ['property', 'sizing', 'ptype', 'deal', 'notes', 'details'];
  const legacy = {
    v: 1, density: 'compact', survey: { ...blank },
    comp: { ...blank, order: ['notes', 'property', 'c1', 'ptype', 'deal', 'sizing', 'details'],
      hiddenSecs: ['property', 'ptype', 'c1'], collapsedSecs: oldSections,
      hiddenFields: ['comp_land_area'], fieldMoves: { comp_building_sf: 'c1' },
      customSecs: [{ key: 'c1', title: 'My saved layout' }] },
  };
  for (const prefs of [null, legacy]) {
    const context = await browser.newContext({ viewport: { width: 420, height: 920 } });
    const blocked = [];
    const errors = [];
    await context.route('**/*', async (route) => {
      if (route.request().url().startsWith('http://127.0.0.1:8783/')) await route.continue();
      else { blocked.push(route.request().url()); await route.abort(); }
    });
    await context.addInitScript(({ prefs }) => {
      window.fixture = {
        storage: { mode: 'comp', ...(prefs ? { layout_prefs: prefs } : {}) },
        requests: [], candidates: [], failSave: false,
        scrape: { costarId: 'fixture-a', street: '100 Fixture Way', city: 'Phoenix', state: 'AZ', zip: '85040',
          submarket: 'North Airport', rba: '20000', acLot: '2', salePrice: '3000000', leaseRate: '1.20' },
      };
      window.chrome = {
        windows: { getCurrent: (respond) => respond({ type: 'normal' }), create: () => {} },
        storage: { local: {
          get: async () => structuredClone(window.fixture.storage),
          set: async (value) => Object.assign(window.fixture.storage, structuredClone(value)),
          remove: async (keys) => { for (const key of [].concat(keys)) delete window.fixture.storage[key]; },
        } },
        tabs: { query: async () => [], create: async () => ({}),
          onUpdated: { addListener: () => {} }, onActivated: { addListener: () => {} } },
        runtime: { id: 'fixture-extension', sendMessage: (message, respond) => {
          window.fixture.requests.push(structuredClone(message));
          if (message.type === 'AUTH_STATUS') respond({ ok: true, connected: true, email: 'fixture@example.com' });
          else if (message.type === 'READ_COSTAR') respond({ ok: true, data: structuredClone(window.fixture.scrape) });
          else if (message.type === 'SEARCH_COMPS') respond({ ok: true, comps: structuredClone(window.fixture.candidates) });
          else if (message.type === 'SAVE_COMP') {
            respond(window.fixture.failSave ? { ok: false, error: 'Fixture save failure', saveRejected: true } : { ok: true, status: 'saved', comp: { ...message.request.p_comp, id: message.request.p_comp_id || 'fixture-saved', property_id: message.request.p_expected_property_id || 'fixture-property' } });
          } else respond({ ok: false, error: `Unexpected fixture message: ${message.type}` });
        } },
      };
    }, { prefs });
    const p = await context.newPage();
    p.on('pageerror', (error) => errors.push(error.message));
    try {
      await p.goto('http://127.0.0.1:8783/panel.html');
      await p.waitForFunction(() => document.getElementById('comp_address').value === '100 Fixture Way');
      await p.evaluate(() => Layout.apply('comp'));
      const yard = p.getByLabel('Yard included', { exact: true });
      assert.equal(await yard.isVisible(), true, 'Yard visible in default and legacy custom layouts');
      assert.equal(await yard.inputValue(), '', 'New listing defaults Unknown');
      assert.deepEqual(await yard.locator('option').allTextContents(), ['Unknown', 'Yes', 'No']);
      if (prefs) {
        assert.deepEqual(await p.evaluate(() => fixture.storage.layout_prefs), prefs, 'No reset/migration of saved layout');
        assert.equal(await p.locator('#comp_building_sf').evaluate((node) => node.closest('[data-sec]').dataset.sec), 'c1');
        assert.equal(await p.locator('#screen-comp [data-sec="property"]').evaluate((node) => node.classList.contains('u-hidden')), true);
        assert.equal(await p.locator('#screen-comp [data-sec="yard"]').evaluate((node) => node.classList.contains('sec-collapsed')), false);
        await p.screenshot({ path: '/tmp/masterappsurvey-yard-legacy.png', fullPage: true });
        assert.deepEqual(errors, [], 'No legacy-layout runtime errors');
        assert.deepEqual(blocked, [], 'No legacy-layout external network requests');
        results.push('Legacy custom section moves, hidden fields, collapsed sections, and compact density preserved; Yard visible');
        continue;
      }
      await p.screenshot({ path: '/tmp/masterappsurvey-yard-default.png', fullPage: true });
      const saves = () => p.evaluate(() => fixture.requests.filter((r) => r.type === 'SAVE_COMP'));
      for (const [choice, value] of [['true', true], ['false', false], ['', null]]) {
        await p.evaluate(async () => { resetCompForm(); await fillCompForm(fixture.scrape); });
        await yard.selectOption(choice);
        await p.locator('#compSave').click();
        await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp saved'));
        const request = (await saves()).at(-1);
        assert.equal(request.type, 'SAVE_COMP');
        assert.equal(request.request.p_comp_id, null);
        assert.equal(request.request.p_comp.yard_included, value);
        assert.equal(Object.hasOwn(request.request.p_comp, 'type'), false);
      }
      results.push('Mounted Save comp sends true/false/null inserts through Chrome message contract');

      for (const saved of [true, false, null]) {
        await p.evaluate(async (saved) => {
          resetCompForm();
          fixture.candidates = [{ property_id: 'fixture-property', id: 'fixture-existing', address: fixture.scrape.street, yard_included: saved }];
          await fillCompForm(fixture.scrape);
        }, saved);
        await p.locator('#compMatchUpdate').click();
        assert.equal(await yard.inputValue(), saved === null ? '' : String(saved));
        await p.locator('#compRescan').click();
        await p.locator('#compMatchUpdate').waitFor();
        await p.locator('#compMatchUpdate').click();
        assert.equal(await yard.inputValue(), saved === null ? '' : String(saved), 'Saved value survives refresh and re-selection');
        assert.equal(await p.evaluate(() => Object.hasOwn(compUpdatePatch(compFormRecord()), 'yard_included')), false);
      }
      results.push('Existing Yes/No/Unknown hydrate; unchanged refresh omits yard update');

      await p.evaluate(() => enterCompUpdate({ property_id: 'fixture-property', id: 'fixture-other', address: fixture.scrape.street, yard_included: true }));
      await yard.selectOption('');
      assert.ok((await p.locator('#compModeNote').innerText()).includes('yard included'));
      await p.evaluate(() => { fixture.candidates = [{ property_id: 'fixture-property', id: 'fixture-other', address: fixture.scrape.street, yard_included: true }]; });
      await p.locator('#compRescan').click();
      await p.locator('#compMatchUpdate').click();
      assert.equal(await yard.inputValue(), '', 'Intentional Unknown survives refresh and duplicate re-selection');
      await p.evaluate(() => { fixture.failSave = true; });
      await p.locator('#compSave').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Fixture save failure'));
      assert.equal((await saves()).at(-1).request.p_comp.yard_included, null);
      assert.equal(await p.evaluate(() => comp.yardEdited), true, 'Failure retains touched intent');
      await p.evaluate(() => { fixture.failSave = false; });
      await p.locator('#compSave').click();
      await p.waitForFunction(() => document.getElementById('compMsg').textContent.includes('Comp updated'));
      assert.equal((await saves()).at(-1).request.p_comp.yard_included, null);
      results.push('Intentional Unknown patches null, survives re-read/re-selection/failure, and succeeds on retry');

      // A manually selected No must survive a refresh and the first duplicate decision.
      await p.evaluate(() => resetCompForm());
      await yard.selectOption('false');
      await p.evaluate(async () => {
        fixture.scrape.yard_area = true;
        fixture.scrape.yard_included = true; // Untrusted scrape field must not infer this offer's yard answer.
        await fillCompForm(fixture.scrape);
      });
      await p.locator('#compMatchUpdate').click();
      assert.equal(await yard.inputValue(), 'false');
      assert.equal(await p.evaluate(() => compUpdatePatch(compFormRecord()).yard_included), false);
      await p.evaluate(() => enterCompUpdate({ property_id: 'fixture-property', id: 'fixture-different-row', address: fixture.scrape.street, yard_included: null }));
      assert.equal(await yard.inputValue(), '', 'Switching DB records loads its own answer');
      assert.equal(await p.evaluate(() => comp.yardEdited), false);
      await yard.selectOption('true');
      await p.evaluate(async () => {
        fixture.scrape = { ...fixture.scrape, costarId: 'fixture-b', street: '200 Fixture Way' };
        fixture.candidates = [];
        await fillCompForm(fixture.scrape);
      });
      assert.equal(await yard.inputValue(), '', 'Different listing resets Unknown despite yard-ish scrape fields');
      assert.equal(await p.evaluate(() => comp.yardEdited), false);
      results.push('Manual No preserved; different comp/listing resets; no acreage/class/survey yard inference');

      // Yard remains movable in the existing layout editor, with value and handlers intact.
      await yard.selectOption('false');
      await p.evaluate(() => Layout.enterEdit('comp'));
      await p.locator('label[for="comp_yard_included"]').click();
      await p.locator('#lbMoveTo').selectOption('property');
      assert.equal(await yard.evaluate((node) => node.closest('[data-sec]').dataset.sec), 'property');
      await p.locator('#lbDone').click();
      await p.evaluate(() => showScreen('comp'));
      await yard.selectOption('true');
      assert.equal(await p.evaluate(() => compFormRecord().yard_included), true);
      assert.equal(await p.evaluate(() => comp.yardEdited), true);
      results.push('Layout move preserves selector ID, value, and edit listener');
      assert.equal(await p.locator('#fYardArea').getAttribute('type'), 'checkbox', 'Separate survey yard control unchanged');
    } catch (error) {
      throw new Error(`${error.message}; page errors: ${JSON.stringify(errors)}; ${await p.locator('body').innerText()}`);
    } finally {
      await context.close();
    }
    assert.deepEqual(errors, [], 'No mounted runtime errors');
    assert.deepEqual(blocked, [], 'No external network requests');
  }
  return { passed: results, screenshots: ['/tmp/masterappsurvey-yard-default.png', '/tmp/masterappsurvey-yard-legacy.png'] };
}
