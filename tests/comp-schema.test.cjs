const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run against source or an extracted release ZIP, without writing live comp data.
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const panel = read('panel.js');
const background = read('background.js');
const supabase = read('supabase.js');
const liveColumns = process.env.COMP_COLUMNS_JSON ? new Set(JSON.parse(process.env.COMP_COLUMNS_JSON)) : null;
function loadFunction(context, source, name) {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert.ok(match, `Missing function ${name}`);
  vm.runInContext(match[0], context);
}

function form(status) {
  const values = {
    comp_status: status, comp_address: '3439 S 40th St', comp_city: 'Phoenix',
    comp_state: 'AZ', comp_zip: '85040', comp_sub_market: 'North Airport',
    comp_building_sf: '20,238', comp_land_area: '1.83', comp_sale_price: '6,000,000',
    comp_rent_psf: '1.25', comp_lease_format: 'NNN', comp_cap_rate: '6',
    comp_notes: 'Fixture only', comp_yard_included: '',
  };
  const nodes = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }]));
  nodes.comp_ptypes = { querySelectorAll: () => [{ value: 'ISF' }] };
  nodes.comp_sale_types = { querySelectorAll: () => [{ value: 'Owner User' }] };
  const context = vm.createContext({
    $: (id) => nodes[id] || null,
    comp: { baseline: {}, flyerUrl: null },
  });
  vm.runInContext(read('config.js'), context);
  vm.runInContext(read('comp-property-fields.js'), context);
  for (const name of ['parseNum', 'compChecked', 'compNotesValue', 'compStatusShows', 'compPropertyValues', 'compFormRecord', 'compUpdatePatch']) {
    loadFunction(context, panel, name);
  }
  return context;
}

const cases = [
  ['FOR SALE', true, false], ['FOR LEASE', false, true],
  ['FOR SALE/LEASE', true, true], ['PENDING SALE', true, false],
  ['PENDING LEASE', false, true],
];
for (const [status, sale, lease] of cases) {
  test(`${status}: insert and update omit retired type and retain correct economics`, async () => {
    const context = form(status);
    const rec = context.compFormRecord();
    assert.equal(rec.status, status);
    assert.equal(rec.sale_price, sale ? 6000000 : null);
    assert.equal(rec.rent_psf, lease ? 1.25 : null);
    assert.equal(rec.sale_type, sale ? 'Owner User' : null);
    assert.equal(rec.lease_format, lease ? 'NNN' : null);
    assert.equal(rec.submarket_cluster, 'Airport/South Central');
    assert.equal(Object.hasOwn(rec, 'type'), false);
    assert.equal(Object.hasOwn(rec, 'deal_type'), false);
    if (liveColumns) for (const key of Object.keys(rec)) assert.ok(liveColumns.has(key), `Unknown live column: ${key}`);

    context.comp.baseline = { ...rec, status: 'SOLD', internal_deal: true, source: 'manual' };
    const patch = context.compUpdatePatch(rec);
    assert.equal(patch.status, status);
    for (const key of ['type', 'deal_type', 'internal_deal', 'source']) assert.equal(Object.hasOwn(patch, key), false);

    // Exercise the actual PostgREST serialization with a fake transport.
    const requests = [];
    context.sbFetch = async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, json: async () => [{ id: 'fixture-id', ...JSON.parse(options.body) }] };
    };
    for (const name of ['sbJson', 'sbInsert', 'sbUpdate']) loadFunction(context, supabase, name);
    await context.sbInsert('comps', rec);
    await context.sbUpdate('comps', 'fixture-id', patch);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[1].method, 'PATCH');
    for (const request of requests) {
      const body = JSON.parse(request.body);
      assert.equal(body.status, status);
      assert.equal(Object.hasOwn(body, 'type'), false);
    }
  });
}

test('duplicate lookup queries valid columns on both lookup paths', async () => {
  const queries = [];
  const context = vm.createContext({
    sbSelect: async (table, query) => {
      assert.equal(table, 'comps');
      queries.push(new URLSearchParams(query));
      return [{ id: 'same-id', address: '3439 S 40th St' }];
    },
  });
  const columns = background.match(/^const COMP_COLS =[^]*?;/m);
  assert.ok(columns);
  vm.runInContext(columns[0], context);
  loadFunction(context, background, 'searchComps');
  const rows = await context.searchComps({ streetNumber: '3439', costarId: 'fixture' });
  assert.equal(queries.length, 2);
  assert.equal(rows.length, 1);
  for (const query of queries) {
    const cols = query.get('select').split(',');
    assert.equal(cols.includes('type'), false);
    assert.equal(cols.includes('status'), true);
    assert.equal(cols.includes('yard_included'), true);
    if (liveColumns) for (const key of cols) assert.ok(liveColumns.has(key), `Unknown live column: ${key}`);
  }
});

test('status dropdown exposes the five current on-market choices', () => {
  const select = read('panel.html').match(/<select id="comp_status">([^]*?)<\/select>/)[1];
  const values = [...select.matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, cases.map(([status]) => status));
});

test('yard inserts serialize Yes, No, and Unknown as true, false, and null', async () => {
  const context = form('FOR SALE');
  const requests = [];
  context.sbFetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => [] };
  };
  for (const name of ['sbJson', 'sbInsert']) loadFunction(context, supabase, name);
  for (const [choice, expected] of [['true', true], ['false', false], ['', null]]) {
    context.$('comp_yard_included').value = choice;
    const record = context.compFormRecord();
    await context.sbInsert('comps', record);
    assert.equal(requests.at(-1).yard_included, expected);
  }
});

test('missing state remains unknown instead of silently defaulting to Arizona', () => {
  const context = form('FOR SALE');
  context.$('comp_state').value = '';
  assert.equal(context.compFormRecord().state, null);
});

test('yard updates require an intentional edit and preserve every tri-state transition', async () => {
  const context = form('FOR LEASE');
  context.comp.yardEdited = true;
  const requests = [];
  context.sbFetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => [] };
  };
  for (const name of ['sbJson', 'sbUpdate']) loadFunction(context, supabase, name);
  for (const baseline of [true, false, null]) {
    for (const value of [true, false, null]) {
      context.comp.baseline = { yard_included: baseline };
      const patch = context.compUpdatePatch({ yard_included: value });
      await context.sbUpdate('comps', 'fixture', patch);
      const body = requests.at(-1);
      assert.equal(Object.hasOwn(body, 'yard_included'), baseline !== value);
      if (baseline !== value) assert.equal(body.yard_included, value);
    }
  }
  context.comp.yardEdited = false;
  for (const value of [true, false, null, undefined]) {
    assert.equal(Object.hasOwn(context.compUpdatePatch({ yard_included: value }), 'yard_included'), false);
  }
  context.comp.yardEdited = true;
  assert.equal(Object.hasOwn(context.compUpdatePatch({}), 'yard_included'), false);
  assert.equal(Object.hasOwn(context.compUpdatePatch({ yard_included: 'false' }), 'yard_included'), false);
});
