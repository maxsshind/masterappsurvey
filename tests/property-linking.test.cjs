const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
function load(context, source, name) {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert.ok(match, `Missing ${name}`);
  vm.runInContext(match[0], context);
}
function requestContext(overrides = {}) {
  const context = vm.createContext({
    crypto: { randomUUID: () => 'a0000000-0000-4000-8000-000000000001' },
    comp: { mode: 'insert', propertyMode: 'auto', originalPropertyId: null, propertyId: null,
      baseline: null, requestId: null, costarId: '123456', siteFieldsEdited: {}, ...overrides },
  });
  vm.runInContext(read('comp-property-fields.js'), context);
  load(context, read('panel.js'), 'compUpdatePatch');
  load(context, read('panel.js'), 'buildCompSaveRequest');
  return context;
}
const deal = { address: '100 Test Ave Suite 4', city: 'Phoenix', state: 'AZ',
  suite: '4', building_sf: 7500, land_area: 0.5, multi_tenant: true, partial_site_override: true, yard_included: false, status: 'FOR LEASE' };

test('new deal uses automatic atomic save; suite/portion sizes remain deal-only facts', () => {
  const c = requestContext();
  const r = c.buildCompSaveRequest(deal);
  assert.equal(r.p_property_mode, 'auto');
  assert.equal(r.p_comp_id, null);
  assert.equal(r.p_comp.suite, '4');
  assert.equal(r.p_comp.partial_site_override, true);
  assert.equal(r.p_comp.building_sf, 7500);
  assert.equal(r.p_comp.yard_included, false);
  assert.deepEqual(JSON.parse(JSON.stringify(r.p_property_facts)), { costar_property_id: '123456' });
  assert.equal(Object.hasOwn(r.p_comp, 'property_id'), false);
});
test('the request ID stays stable through an ambiguous result and chosen property', () => {
  const c = requestContext();
  const r = c.buildCompSaveRequest(deal);
  c.comp.propertyMode = 'existing'; c.comp.propertyId = 'property-a';
  const chosen = c.buildCompSaveRequest(deal);
  assert.equal(chosen.p_request_id, r.p_request_id);
  assert.equal(chosen.p_property_mode, 'existing');
  assert.equal(chosen.p_property_id, 'property-a');
});
for (const internal_deal of [true, false]) {
  test(`existing ${internal_deal ? 'R&G' : 'external'} deal preserves original property identity and ownership fields`, () => {
    const c = requestContext({ mode: 'update', updateId: 'deal-a', propertyMode: 'preserve',
      originalPropertyId: 'property-a', propertyId: null, baseline: { ...deal, property_id: 'property-a', internal_deal, source: 'manual' } });
    const r = c.buildCompSaveRequest({ ...deal, internal_deal: false, source: 'costar', notes: 'Updated' });
    assert.equal(r.p_expected_property_id, 'property-a');
    assert.equal(r.p_property_mode, 'preserve');
    assert.equal(r.p_comp_id, 'deal-a');
    for (const field of ['internal_deal', 'source', 'property_id', 'suite', 'partial_site_override', 'multi_tenant']) assert.equal(Object.hasOwn(r.p_comp, field), false);
  });
}
test('unavailable original identity blocks an update rather than treating it as an unlink', () => {
  const c = requestContext({ mode: 'update', updateId: 'deal-a', originalPropertyId: undefined });
  assert.throws(() => c.buildCompSaveRequest(deal), /could not be loaded/);
});
test('intentional skip is distinct from preserved link and carries original ID guard', () => {
  const c = requestContext({ mode: 'update', updateId: 'deal-a', originalPropertyId: 'property-a', propertyMode: 'skip' });
  const r = c.buildCompSaveRequest(deal);
  assert.equal(r.p_property_mode, 'skip');
  assert.equal(r.p_expected_property_id, 'property-a');
  assert.equal(r.p_property_id, null);
});
test('unverified or malformed CoStar identity is not promoted to a property fact', () => {
  const c = requestContext({ costarId: '123 fixture' });
  assert.deepEqual(Object.keys(c.buildCompSaveRequest(deal).p_property_facts), []);
});
test('intentional suite and site flags can clear to unknown; untouched values never overwrite saved facts', () => {
  const c = requestContext({ baseline: { suite: 'A', multi_tenant: true, partial_site_override: true },
    siteFieldsEdited: { suite: true, multi_tenant: true, partial_site_override: true } });
  const r = c.compUpdatePatch({ suite: null, multi_tenant: null, partial_site_override: null });
  for (const field of ['suite', 'multi_tenant', 'partial_site_override']) assert.equal(r[field], null);
});
test('RPC transport uses existing authentication path and exact request payload', async () => {
  const requests = [];
  const c = requestContext();
  c.sbFetch = async (url, init) => { requests.push({ url, ...init }); return { ok: true, json: async () => ({ status: 'saved', comp: { id: 'deal-a', property_id: 'property-a' } }) }; };
  for (const f of ['sbJson', 'sbRpc']) load(c, read('supabase.js'), f);
  load(c, read('background.js'), 'saveCompWithProperty');
  const request = c.buildCompSaveRequest(deal);
  const result = await c.saveCompWithProperty(request);
  assert.equal(result.status, 'saved');
  assert.equal(requests[0].url, '/rpc/save_comp_with_property');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].body), JSON.parse(JSON.stringify(request)));
  assert.equal(Object.hasOwn(requests[0].headers, 'Authorization'), false, 'Session auth stays inside existing sbFetch');
});
test('confirmed rejection differs from lost response so recovery cannot silently opt out', async () => {
  const c = requestContext();
  for (const f of ['sbJson', 'sbRpc']) load(c, read('supabase.js'), f);
  c.sbFetch = async () => ({ ok: false, status: 409, json: async () => ({ message: 'Conflict: reload original link' }) });
  await assert.rejects(c.sbRpc('save_comp_with_property', {}), e => e.saveRejected === true && /Conflict/.test(e.message));
  c.sbFetch = async () => ({ ok: false, status: 503, json: async () => ({ message: 'Gateway unavailable' }) });
  await assert.rejects(c.sbRpc('save_comp_with_property', {}), e => !e.saveRejected);
  c.sbFetch = async () => { throw new Error('Network lost after dispatch'); };
  await assert.rejects(c.sbRpc('save_comp_with_property', {}), e => !e.saveRejected);
});
test('background comp messages cannot bypass the atomic save function', () => {
  const src = read('background.js');
  assert.ok(src.includes('case "SAVE_COMP":'));
  assert.equal(/sb(?:Insert|Update)\("comps"/.test(src), false);
  assert.equal(/case "(?:INSERT_COMP|UPDATE_COMP)":/.test(src), false);
});
test('existing-deal lookup scopes by city and state and reads property identity and offered-space flags', async () => {
  const queries = [];
  const c = vm.createContext({ sbSelect: async (table, query) => { queries.push(new URLSearchParams(query)); return []; } });
  vm.runInContext(read('background.js').match(/^const COMP_COLS =[^]*?;/m)[0], c);
  load(c, read('background.js'), 'searchComps');
  await c.searchComps({ streetNumber: '100', city: 'Phoenix', state: 'AZ', costarId: '12345' });
  for (const q of queries) {
    assert.equal(q.get('city'), 'ilike.Phoenix'); assert.equal(q.get('state'), 'ilike.AZ');
    for (const field of ['property_id', 'suite', 'partial_site_override', 'multi_tenant']) assert.ok(q.get('select').split(',').includes(field));
  }
});
