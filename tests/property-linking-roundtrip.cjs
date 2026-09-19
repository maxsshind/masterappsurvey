// Real extension request/transport -> disposable PostgreSQL/PostgREST fixture.
// Usage: node tests/property-linking-roundtrip.cjs http://127.0.0.1:8894
// Start Master App's verify-property-save + property-save-browser-server first.
// Only a synthetic loopback endpoint is accepted. No production env is loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const endpoint = new URL(process.argv[2] || 'http://127.0.0.1:8894');
assert.equal(endpoint.protocol, 'http:');
assert.equal(endpoint.hostname, '127.0.0.1');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (c, source, name) => {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert.ok(match, `Missing ${name}`); vm.runInContext(match[0], c);
};
(async () => {
  let checks = 0;
  const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  const localFetch = async (url, init) => {
    const u = new URL(url); assert.equal(u.hostname, '127.0.0.1', 'External network blocked');
    return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  };
  const fixture = await (await localFetch(new URL('/__fixtures', endpoint))).json();
  assert.equal(new URL(fixture.postgrestUrl).hostname, '127.0.0.1');
  const storage = { sb_session: { access_token: fixture.approvedJwt, refresh_token: 'synthetic-local-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600, email: fixture.user.email, user_id: fixture.user.id } };
  const nodes = {};
  const c = vm.createContext({
    fetch: localFetch, crypto: webcrypto, CONFIG: { SUPABASE_URL: endpoint.origin, SUPABASE_ANON_KEY: 'synthetic-local-only' },
    chrome: { runtime: {}, storage: { local: {
      get: (_keys, cb) => { cb(structuredClone(storage)); },
      set: (value, cb) => { Object.assign(storage, structuredClone(value)); if (cb) cb(); },
      remove: (keys, cb) => { for (const key of keys) delete storage[key]; if (cb) cb(); },
    } } },
    $: (id) => nodes[id] || null,
    comp: { mode: 'insert', baseline: null, propertyMode: 'auto', propertyId: null, originalPropertyId: null,
      requestId: null, costarId: null, siteFieldsEdited: {}, yardEdited: false },
  });
  vm.runInContext(read('config.js').match(/^const SUBMARKET_TO_CLUSTER =[^]*?^};/m)[0], c);
  vm.runInContext(read('supabase.js'), c);
  vm.runInContext(read('comp-property-fields.js'), c);
  for (const name of ['parseNum', 'compChecked', 'compNotesValue', 'compStatusShows', 'compPropertyValues', 'compFormRecord', 'compUpdatePatch', 'buildCompSaveRequest']) load(c, read('panel.js'), name);
  load(c, read('background.js'), 'saveCompWithProperty');
  const form = (address, changes = {}) => {
    for (const key of Object.keys(nodes)) delete nodes[key];
    const fields = { comp_address: address, comp_property_name: address, comp_city: 'Phoenix', comp_state: 'AZ',
      comp_zip: '85040', comp_status: 'FOR LEASE', comp_sub_market: 'North Airport', comp_building_sf: '2500',
      comp_land_area: '0.25', comp_suite: '', comp_partial_site_override: '', comp_multi_tenant: '', comp_yard_included: '',
      comp_rent_psf: '1.25', comp_lease_format: 'NNN', comp_sale_price: '1000000', comp_notes: 'Local extension fixture only', ...changes };
    for (const [id, value] of Object.entries(fields)) nodes[id] = { value };
    nodes.comp_ptypes = { querySelectorAll: () => [{ value: 'ISF' }] };
    nodes.comp_sale_types = { querySelectorAll: () => [{ value: 'Owner User' }] };
    Object.assign(c.comp, { mode: 'insert', updateId: null, baseline: null, requestId: null,
      propertyMode: 'auto', propertyId: null, originalPropertyId: null, costarId: null, siteFieldsEdited: {}, yardEdited: false });
    return c.buildCompSaveRequest(c.compFormRecord());
  };
  const records = async (table, query) => c.sbSelect(table, query);
  const unique = 980000 + (Date.now() % 10000);
  for (const status of ['FOR SALE', 'FOR LEASE', 'FOR SALE/LEASE', 'PENDING SALE', 'PENDING LEASE']) {
    const request = form('100 North Example St', { comp_status: status, comp_suite: 'EXT' });
    const result = await c.saveCompWithProperty(request);
    check(result.status, 'saved'); check(result.comp.property_id, fixture.propertyId); check(result.comp.status, status);
  }
  const alias = await c.saveCompWithProperty(form('950 East Other Avenue', { comp_partial_site_override: 'true' }));
  check(alias.comp.property_id, fixture.propertyId, 'Alias with different street number finds the same property');
  check(alias.comp.building_sf, 2500, 'Offered size survives existing-site linking');
  const request = form(`${unique} E Extension Ave Suite A`, { comp_suite: 'A', comp_multi_tenant: 'true', comp_partial_site_override: 'true', comp_yard_included: 'false' });
  c.comp.costarId = String(unique * 100); request.p_property_facts = c.buildCompSaveRequest(c.compFormRecord()).p_property_facts;
  const created = await c.saveCompWithProperty(request);
  check(created.status, 'saved'); check(created.comp.yard_included, false);
  const [property] = await records('properties', `id=eq.${created.comp.property_id}&select=address,building_sf,land_area,latitude,longitude,costar_property_id`);
  check([property.address, property.building_sf, property.land_area, property.latitude, property.longitude], [`${unique} E Extension Ave`, null, null, null, null]);
  check(property.costar_property_id, String(unique * 100));
  const ambRequest = form('450 W Choice Rd');
  const ambiguous = await c.saveCompWithProperty(ambRequest);
  check(ambiguous.status, 'needs_choice'); check(ambiguous.candidates.length, 2);
  const choice = await c.saveCompWithProperty({ ...ambRequest, p_property_mode: 'existing', p_property_id: ambiguous.candidates[0].id });
  check(choice.comp.property_id, ambiguous.candidates[0].id);
  const skipRequest = form(`${unique} E Skip Ave`); skipRequest.p_property_mode = 'skip';
  const skipped = await c.saveCompWithProperty(skipRequest); check(skipped.comp.property_id, null);
  check((await records('properties', `address=eq.${encodeURIComponent(skipRequest.p_comp.address)}&select=id`)).length, 0);
  const failRequest = form(`${unique} E Rollback Ave`, { comp_notes: 'FAIL SAVE' });
  await assert.rejects(c.saveCompWithProperty(failRequest), e => e.saveRejected === true); checks++;
  check((await records('properties', `address=eq.${encodeURIComponent(failRequest.p_comp.address)}&select=id`)).length, 0, 'Failed deal leaves no property');
  const fixed = await c.saveCompWithProperty({ ...failRequest, p_comp: { ...failRequest.p_comp, notes: 'Corrected local fixture' } });
  check(fixed.status, 'saved');
  const preserveRequest = { p_comp: { notes: 'Preserved link test' }, p_request_id: webcrypto.randomUUID(), p_comp_id: created.comp.id,
    p_property_mode: 'preserve', p_property_id: null, p_expected_property_id: created.comp.property_id, p_property_facts: {} };
  const preserved = await c.saveCompWithProperty(preserveRequest); check(preserved.comp.property_id, created.comp.property_id);
  await assert.rejects(c.saveCompWithProperty({ ...preserveRequest, p_request_id: webcrypto.randomUUID(), p_property_mode: 'skip', p_expected_property_id: null }), e => e.saveRejected === true && /another session/.test(e.message)); checks++;
  const lossRequest = form(`${unique} E Lost Response Ave`, { comp_suite: 'B' });
  await localFetch(new URL('/__state', endpoint), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveAfter: true }) });
  await assert.rejects(c.saveCompWithProperty(lossRequest), e => !e.saveRejected); checks++;
  const recovered = await c.saveCompWithProperty(lossRequest);
  check(recovered.status, 'saved');
  check((await records('comps', `address=eq.${encodeURIComponent(lossRequest.p_comp.address)}&select=id`)).length, 1, 'Lost committed response retries one deal');
  const concurrentRequest = form(`${unique} E One Request Ave`, { comp_suite: 'C' });
  const same = await Promise.all(Array.from({ length: 4 }, () => c.saveCompWithProperty(concurrentRequest)));
  check(new Set(same.map(r => r.comp.id)).size, 1); check(new Set(same.map(r => r.comp.property_id)).size, 1);
  const separate = await Promise.all(Array.from({ length: 4 }, (_, i) => c.saveCompWithProperty({ ...concurrentRequest,
    p_request_id: webcrypto.randomUUID(), p_comp: { ...concurrentRequest.p_comp, address: `${unique} E Four Suites Ave`, suite: String(i + 1) } })));
  check(new Set(separate.map(r => r.comp.id)).size, 4); check(new Set(separate.map(r => r.comp.property_id)).size, 1);
  // Force the actual lazy refresh path; only the local auth stub is reachable.
  storage.sb_session.expires_at = 1;
  const refreshed = await c.sbSelect('comps', `id=eq.${created.comp.id}&select=id,property_id`);
  check(refreshed[0].property_id, created.comp.property_id); check(storage.sb_session.user_id, fixture.user.id);
  console.log(`${checks} real extension-to-PostgREST checks passed: five statuses, exact/alias/new/ambiguous/skip, site totals, original-ID guard, rollback, lost response, concurrent saves, and session refresh. Synthetic loopback database only.`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
