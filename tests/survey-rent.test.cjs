const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const Fields = require(path.join(root, 'survey-fields.js'));
const Rent = require(path.join(root, 'survey-rent.js'));
const building = { tenancy: 'ST', building_sf: 10000 };
const suite = { tenancy: 'MT', building_sf: 40000, suite_size: '5,000 SF' };
const quote = (basis = 'sf', amount = 1.25, expenses = { basis: 'total', amount: 2500, treatment: 'additional' }, offered_acres = 2) => ({
  version: 1, rent: { basis, amount }, expenses, offered_acres,
});
const linkedRow = (metadata = quote('sf', 1.4, { basis: 'sf', amount: 0.25, treatment: 'additional' })) => ({
  id: 'disposable-row-id', survey_id: 'disposable-survey-id', address: '100 Test Street', ...suite,
  suite_number: '101', office_sf: 500, land_area_ac: 10, notes: 'Existing client note', notes_2: 'Second client note',
  internal_notes: 'Private only', availability: 'Confirmed', yard_area: null,
  is_featured: true, client_killed: false, client_feedback: 'Preserve feedback',
  ...Rent.getSurveyRentWrite(Rent.createSurveyRentDraft(metadata), suite),
});

test('runtime scripts expose usable browser globals in deterministic order without CommonJS', () => {
  const context = vm.createContext({});
  for (const file of ['survey-fields.js', 'survey-rent.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  assert.equal(vm.runInContext('SurveyRent.calculateSurveyRent({version:1,rent:{basis:"sf",amount:1.4},expenses:null,offered_acres:null},{tenancy:"MT",suite_size:"5000",building_sf:40000}).monthly_base_rent', context), 7000);
  assert.equal(vm.runInContext('SurveyFields.serializeDraft(SurveyFields.hydrateDraft({address:"Test",rent_calculation:null,notes:"x"})).valid', context), true);
});

for (const [basis, amount] of [['sf', 1.25], ['total', 12500], ['acre', 6250]]) {
  test(`ST exact equivalents from ${basis}`, () => {
    assert.deepEqual(Rent.calculateSurveyRent(quote(basis, amount), building), {
      monthly_base_rent: 12500, lease_rate_psf: 1.25, lease_rate_per_acre: 6250,
      monthly_opex_psf: 0.25, total_monthly_opex: 2500, total_lease_rate: 15000, areaSf: 10000,
    });
  });
}
for (const value of ['5K', '5k sf', '5,000 sq. ft.', '5000 square feet']) {
  test(`MT full-text suite parser accepts ${value}`, () => assert.equal(Rent.resolveSurveyRentArea({ ...suite, suite_size: value }), 5000));
}
for (const value of [null, '', '5,000–10,000 SF', '5000-10000', 'about 5000 SF', '5000 + 2500 SF', '1,00 SF', '1,2 SF', '0 SF', '-5000 SF', '1.00000000000000001 SF']) {
  test(`MT unresolved suite ${JSON.stringify(value)} never falls back to building area`, () => {
    assert.equal(Rent.resolveSurveyRentArea({ ...suite, suite_size: value }), null);
    const output = Rent.calculateSurveyRent(quote('sf', 1.4), { ...suite, suite_size: value });
    assert.equal(output.monthly_base_rent, null);
    assert.equal(output.lease_rate_psf, 1.4);
  });
}
test('unknown tenancy uses only confirmed suite area; ST uses only building area', () => {
  assert.equal(Rent.resolveSurveyRentArea({ building_sf: 40000, suite_size: '5K' }), 5000);
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: '', building_sf: 40000 }), null);
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: 'Other', building_sf: 40000, suite_size: '5K' }), null);
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: 'ST', suite_size: '5K' }), null);
});
test('suite shorthand decimal denominator avoids floating point multiplication artifacts', () => {
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: 'MT', suite_size: '12.34567k SF' }), 12345.67);
  assert.equal(Rent.calculateSurveyRent(quote('sf', 0.3), { tenancy: 'MT', suite_size: '12.34567k SF' }).monthly_base_rent, 3703.7);
});
test('tiny representable areas survive; decimal underflow is unresolved', () => {
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: 'MT', suite_size: `0.${'0'.repeat(323)}5 SF` }), Number.MIN_VALUE);
  assert.equal(Rent.resolveSurveyRentArea({ tenancy: 'MT', suite_size: `0.${'0'.repeat(323)}1 SF` }), null);
});
test('MT and Lease & Sale math uses suite area; editing total changes the controlling quote', () => {
  let draft = Rent.createSurveyRentDraft(quote('sf', 1.4));
  assert.equal(Rent.preview(draft, { ...suite, for_sale_or_lease: ['Lease', 'Sale'] }).monthly_base_rent, 7000);
  draft = Rent.editRent(draft, 'total', '7,500');
  assert.equal(Rent.preview(draft, suite).lease_rate_psf, 1.5);
  assert.equal(Rent.preview(draft, { ...suite, suite_size: '6000' }).lease_rate_psf, 1.25);
  assert.equal(Rent.preview(draft, { ...suite, suite_size: '6000' }).monthly_base_rent, 7500);
  draft = Rent.editRent(draft, 'sf', '1.4');
  assert.equal(Rent.preview(draft, { ...suite, suite_size: '6000' }).monthly_base_rent, 8400);
});
test('pure yard has acre equivalents without fabricating building PSF', () => {
  const result = Rent.calculateSurveyRent(quote('acre', 3000), { land_area_ac: 99 });
  assert.equal(result.monthly_base_rent, 6000);
  assert.equal(result.lease_rate_psf, null);
  assert.equal(result.lease_rate_per_acre, 3000);
  assert.equal(Rent.calculateSurveyRent(quote('acre', 3000, null, null), { land_area_ac: 10 }).monthly_base_rent, null);
});
test('explicit zero differs from empty and missing denominator never becomes zero total', () => {
  assert.equal(Rent.calculateSurveyRent(quote('sf', 0), building).monthly_base_rent, 0);
  assert.equal(Rent.calculateSurveyRent(quote('sf', null), building, { monthly_base_rent: 999 }).monthly_base_rent, null);
  assert.equal(Rent.calculateSurveyRent(quote('sf', 0), {}).monthly_base_rent, null);
  assert.equal(Rent.calculateSurveyRent(quote('acre', 0, null, 0), {}).monthly_base_rent, null);
});
test('exact cents and PSF ties match PostgreSQL numeric half-up rounding', () => {
  const result = Rent.calculateSurveyRent(quote('total', 1.005, { basis: 'total', amount: 2.005, treatment: 'additional' }), building);
  assert.equal(result.monthly_base_rent, 1.01);
  assert.equal(result.total_monthly_opex, 2.01);
  assert.equal(result.total_lease_rate, 3.02);
  assert.equal(Rent.calculateSurveyRent(quote('total', 0.201), { tenancy: 'MT', suite_size: '20 SF' }).lease_rate_psf, 0.0101);
  assert.equal(Rent.calculateSurveyRent(quote('total', 1, null, 6), { tenancy: 'MT', suite_size: '6 SF' }).lease_rate_per_acre, 0.1667);
});
for (const [basis, amount, area, acres, expected] of [
  ['sf', 1.005, { tenancy: 'MT', suite_size: '3 SF' }, 2, 3.02],
  ['sf', 3, { tenancy: 'MT', suite_size: '1.005 SF' }, 2, 3.02],
  ['acre', 1.005, {}, 3, 3.02], ['acre', 3, {}, 1.005, 3.02],
]) {
  test(`exact product ${basis}/${amount}/${JSON.stringify(area)}/${acres}`, () => assert.equal(Rent.calculateSurveyRent(quote(basis, amount, null, acres), area).monthly_base_rent, expected));
}
test('overflow produces unresolved values rather than Infinity or unsafe numbers', () => {
  const result = Rent.calculateSurveyRent(quote('sf', Number.MAX_SAFE_INTEGER), building);
  assert.equal(result.monthly_base_rent, null);
  assert.equal(result.total_lease_rate, null);
  assert.ok(Object.values(result).every(value => value === null || Number.isFinite(value)));
});
test('separate/included/unknown/separate restores reviewed expense amount without changing rent', () => {
  let draft = Rent.createSurveyRentDraft(quote('total', 7000, { basis: 'sf', amount: 0.25, treatment: 'additional' }));
  assert.equal(Rent.preview(draft, suite).total_lease_rate, 8250);
  draft = Rent.changeExpenseTreatment(draft, 'included');
  assert.equal(Rent.preview(draft, suite).total_lease_rate, 7000);
  assert.equal(draft.expenses.amount, '0.25');
  draft = Rent.changeExpenseTreatment(draft, 'unknown');
  assert.equal(Rent.preview(draft, suite).total_lease_rate, null);
  draft = Rent.changeExpenseTreatment(draft, 'additional');
  assert.equal(Rent.preview(draft, suite).total_lease_rate, 8250);
});
test('hidden invalid expense input is cleared, while visible invalid draft blocks save', () => {
  let draft = Rent.editExpenses(null, 'total', '1k');
  assert.throws(() => Rent.getSurveyRentWrite(draft, suite), /one number/);
  draft = Rent.changeExpenseTreatment(draft, 'included');
  assert.equal(draft.expenses.amount, '');
  assert.equal(Rent.getSurveyRentWrite(draft, suite).total_monthly_opex, 0);
});
test('adopting only rent preserves unreviewed expense figures and makes total incomplete', () => {
  const old = { monthly_base_rent: 7000, lease_rate_psf: 2, total_monthly_opex: 1000, monthly_opex_psf: 0.5, total_lease_rate: 8500 };
  const write = Rent.getSurveyRentWrite(Rent.editRent(null, 'sf', '1.4'), suite, old);
  assert.equal(write.monthly_base_rent, 7000);
  assert.equal(write.lease_rate_psf, 1.4);
  assert.equal(write.total_monthly_opex, 1000);
  assert.equal(write.monthly_opex_psf, 0.5);
  assert.equal(write.total_lease_rate, null);
  assert.equal(write.rent_calculation.expenses, null);
});
test('rent source precision survives reopened area changes and is never replaced by displayed rate', () => {
  const meta = quote('sf', 1.23456789);
  const draft = Rent.createSurveyRentDraft(JSON.parse(JSON.stringify(meta)));
  assert.equal(Rent.preview(draft, suite).lease_rate_psf, 1.2346);
  assert.equal(Rent.getSurveyRentWrite(draft, building).monthly_base_rent, 12345.68);
  assert.equal(Rent.getSurveyRentWrite(draft, building).rent_calculation.rent.amount, 1.23456789);
  assert.throws(() => Rent.getSurveyRentWrite(Rent.editRent(draft, 'sf', '1.23456789'), building), /decimal places/);
});
test('historical offered acres retain precision when unchanged, while new entry follows four places', () => {
  const draft = Rent.createSurveyRentDraft(quote('acre', 1000, null, 1.123456));
  assert.equal(Rent.getSurveyRentWrite(draft, building).rent_calculation.offered_acres, 1.123456);
  draft.offered_acres = '1.123457';
  assert.throws(() => Rent.getSurveyRentWrite(draft, building), /decimal places/);
});
test('small saved source numbers displayed without exponents preserve exact metadata on reopen', () => {
  const metadata = quote('sf', 1e-7, { basis: 'total', amount: 1e-8, treatment: 'additional' }, 1e-7);
  const draft = Rent.createSurveyRentDraft(metadata);
  assert.equal(draft.rent.amount, '0.0000001');
  assert.equal(draft.expenses.amount, '0.00000001');
  assert.deepEqual(Rent.getSurveyRentWrite(draft, suite).rent_calculation, metadata);
  assert.equal(Fields.parseNumericInput(Rent.decimalInputString(Number.MIN_VALUE)).value, Number.MIN_VALUE);
});
test('unreviewed legacy display keeps saved all-in and independent conflicting amounts', () => {
  const legacy = { monthly_base_rent: 7000, lease_rate_psf: 2, total_monthly_opex: 1000, monthly_opex_psf: 0.5, total_lease_rate: 8500 };
  const values = Rent.preview(null, suite, legacy);
  assert.equal(values.total_lease_rate, 8500);
  assert.equal(values.lease_rate_psf, 2);
  assert.equal(Rent.getSurveyRentWrite(null, suite, legacy).rent_calculation, null);
});

for (const value of [undefined, null, {}, [], { version: 2 }, { version: 1, rent: null, expenses: null }]) {
  test(`metadata validates complete supported shape ${JSON.stringify(value)}`, () => assert.equal(typeof Rent.validateRentCalculation(value), 'string'));
}
for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '12', undefined]) {
  test(`metadata rejects invalid source ${String(value)}`, () => {
    const meta = quote('sf', value);
    if (value === undefined) meta.rent.amount = undefined;
    assert.match(Rent.validateRentCalculation(meta), /Base rent/);
    assert.throws(() => Rent.calculateSurveyRent(meta, suite), /Base rent/);
  });
}
test('metadata rejects annual units, unknown treatments and invalid retained included expense', () => {
  assert.ok(Rent.validateRentCalculation(quote('annual', 18)));
  assert.ok(Rent.validateRentCalculation(quote('sf', 1, { basis: 'acre', amount: 1, treatment: 'additional' })));
  assert.ok(Rent.validateRentCalculation(quote('sf', 1, { basis: 'total', amount: 1, treatment: 'gross' })));
  assert.ok(Rent.validateRentCalculation(quote('sf', 1, { basis: 'total', amount: NaN, treatment: 'included' })));
});

for (const value of ['6,500 - 15,000', '1.2M', '125 sqft', '1,00', '1,2', '12,345,67', '1e3', 'Infinity', 'NaN', '1.00000000000000001', '9007199254740992']) {
  test(`strict numeric entry rejects ${value}`, () => assert.equal(Fields.parseNumericInput(value).valid, false));
}
test('strict numeric input preserves blank and zero and accepts intentional formatting', () => {
  assert.deepEqual(Fields.parseNumericInput(''), { valid: true, value: null, error: null });
  assert.equal(Fields.parseNumericInput('0').value, 0);
  assert.equal(Fields.parseNumericInput('$ 7,500.00', { allowCurrency: true, maxDecimals: 2 }).value, 7500);
  assert.equal(Fields.parseNumericInput('7.25%', { allowPercent: true }).value, 7.25);
  assert.equal(Fields.parseNumericInput('1.2000', { maxDecimals: 2 }).valid, true);
  assert.equal(Fields.numericDraft('1,00'), '1,00');
});
test('field entry precision, bounds, latitude signs, count and office checks', () => {
  const invalid = Fields.parseSurveyNumericFields({ building_sf: '10.1', office_sf: '500', sale_price: '1.001', lease_rate_psf: '1.00001', cap_rate: '101', latitude: '-91', num_private_offices: '2147483648' });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.issues.length, 6);
  assert.equal(Fields.parseSurveyNumericFields({ longitude: '-111.98', latitude: '33.44' }).valid, true);
  assert.match(Fields.parseSurveyNumericFields({ building_sf: '100', office_sf: '101' }).issues[0].message, /cannot exceed/);
});
test('typed high precision is blocked but unchanged stored precision is preserved', () => {
  const previous = { building_sf: 10000.125, land_area_ac: 1.123456, sale_price: 123.456 };
  const input = Object.fromEntries(Object.entries(previous).map(([key, value]) => [key, String(value)]));
  assert.equal(Fields.parseSurveyNumericFields(input, { previous }).valid, true);
  assert.equal(Fields.parseSurveyNumericFields(input).valid, false);
  assert.equal(Fields.normalizeSurveyNumericWrite(previous).building_sf, 10000.125);
});

test('unchanged nested metadata compares structurally even when object keys are reordered', () => {
  const row = linkedRow();
  const draft = Fields.hydrateDraft(row);
  draft.rentDraft.metadata = { expenses: row.rent_calculation.expenses, rent: row.rent_calculation.rent, offered_acres: 2, version: 1 };
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.patch, {});
  assert.equal(result.pricingChanged, false);
});
test('legacy notes-only patch preserves conflicting values, notes2, private notes, null yard, custom choices and feedback', () => {
  const row = { ...linkedRow(), rent_calculation: null, monthly_base_rent: 7000, lease_rate_psf: 2, total_lease_rate: 8500, lease_type: 'Custom Lease', availability: 'Custom Status' };
  const draft = Fields.hydrateDraft(row);
  draft.values.notes = 'Reviewed client note';
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.patch, { notes: 'Reviewed client note' });
  assert.equal(result.values.rent_calculation, null);
  assert.equal(result.values.total_lease_rate, 8500);
  assert.equal(result.values.yard_area, null);
  assert.equal(result.values.notes_2, 'Second client note');
  assert.equal(result.values.internal_notes, 'Private only');
  assert.equal(result.values.client_feedback, 'Preserve feedback');
});
test('serializer can never emit client feedback/votes/comments even if draft values are modified', () => {
  const draft = Fields.hydrateDraft(linkedRow());
  Object.assign(draft.values, { is_featured: false, client_killed: true, client_feedback: '', survey_comments: [] });
  assert.deepEqual(Fields.serializeDraft(draft).patch, {});
});
test('new row serialization strips cloned identity, client state, timestamps and unknown database columns', () => {
  const old = {
    ...linkedRow(), property_name: 'Not a Survey column', created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z', created_by: 'different-account', unknown_server_field: 'keep out',
    offered_acres: 20, lease_rate_per_acre: 1234, survey_comments: [{ body: 'Client conversation' }],
  };
  const draft = Fields.hydrateDraft(old, { isNew: true });
  draft.values.property_name = 'Still not a Survey column';
  draft.values.new_unknown_field = 'Do not submit';
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, result.patch);
  for (const field of ['id', 'survey_id', 'property_name', 'is_featured', 'client_killed', 'client_feedback', 'survey_comments', 'created_at', 'updated_at', 'created_by', 'unknown_server_field', 'new_unknown_field', 'offered_acres', 'lease_rate_per_acre']) {
    assert.equal(Object.hasOwn(result.values, field), false, `${field} must not leak into the new-row payload`);
  }
  assert.equal(result.values.monthly_base_rent, 7000);
  assert.deepEqual(result.values.rent_calculation, old.rent_calculation);
  assert.equal(result.values.notes_2, 'Second client note');
  assert.equal(result.values.internal_notes, 'Private only');
});
test('unsupported property name is omitted from existing update patches without rewriting the baseline', () => {
  const draft = Fields.hydrateDraft({ ...linkedRow(), property_name: 'Historic unsupported field' });
  draft.values.property_name = 'Changed unsupported field';
  draft.values.notes = 'Reviewed note';
  const result = Fields.serializeDraft(draft);
  assert.deepEqual(result.patch, { notes: 'Reviewed note' });
  assert.equal(result.values.property_name, 'Historic unsupported field');
});

const masterAppSource = process.env.MASTER_APP_SOURCE || '/Users/maxschumacher/.codex/worktrees/survey-rent-calculator-20260918/master-app';
const surveyTypeFile = path.join(masterAppSource, 'src/lib/supabase/types.ts');
test('complete insert payload matches the actual canonical SurveyProperty writable column contract', { skip: !fs.existsSync(surveyTypeFile) && 'Set MASTER_APP_SOURCE to the read-only canonical Master App checkout.' }, () => {
  const source = fs.readFileSync(surveyTypeFile, 'utf8');
  const definition = source.match(/export interface SurveyProperty \{([\s\S]*?)^\}/m);
  assert.ok(definition, 'Canonical SurveyProperty interface must exist');
  const columns = [...definition[1].matchAll(/^\s{2}([a-z_][a-z_0-9]*)\??:/gm)].map(match => match[1]);
  assert.ok(columns.includes('rent_calculation'), 'Canonical type must contain linked rent metadata');
  assert.equal(columns.includes('property_name'), false, 'Verified Survey contract has no property_name column');
  const protectedFields = new Set(['id', 'survey_id', 'is_featured', 'client_feedback', 'client_killed', 'created_at', 'updated_at']);
  const writable = columns.filter(field => !protectedFields.has(field));
  const populated = {
    id: 'old-row', survey_id: 'old-survey', address: '100 Complete Fixture St', city: 'Phoenix', state: 'AZ', zip: '85001',
    latitude: 33.4, longitude: -112.1, building_sf: 40000, land_area_ac: 10, suite_size: '5000', suite_number: '101', office_sf: 500,
    sale_price: 1000000, cap_rate: 7.25, zoning: 'I-1', tenancy: 'MT',
    lease_rate_psf: 1.4, lease_type: 'NNN', total_lease_rate: 8250, num_private_offices: 2, monthly_base_rent: 7000,
    monthly_opex_psf: 0.25, total_monthly_opex: 1250, rent_calculation: quote('sf', 1.4, { basis: 'sf', amount: 0.25, treatment: 'additional' }),
    power: 'Confirmed power', loading: 'Confirmed loading', clear_height: '24 ft', date_available: 'Now',
    for_sale_or_lease: ['sale', 'lease'], availability: 'Confirmed', yard_area: null, flyer_url: 'https://example.invalid/flyer.pdf',
    photo_url: 'https://example.invalid/photo.jpg', notes: 'Client note', notes_2: 'Second client note', internal_notes: 'Private note', internal_status: 'Confirmed with broker',
    is_featured: true, client_feedback: 'Keep on old offering', client_killed: true, created_at: 'old-created', updated_at: 'old-updated',
    property_name: 'Unsupported field', additional_unknown: 'Not a column',
  };
  const result = Fields.serializeDraft(Fields.hydrateDraft(populated, { isNew: true }));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(Object.keys(result.values).sort(), writable.sort());
  assert.deepEqual(result.patch, result.values);
});
test('unsupported metadata is opaque: unrelated patch preserves it; pricing/area edit is blocked', () => {
  const row = { ...linkedRow(), rent_calculation: { version: 99, future: { quote: 123 } } };
  const draft = Fields.hydrateDraft(row);
  assert.equal(draft.rentSupported, false);
  draft.values.notes = 'New note';
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.patch, { notes: 'New note' });
  assert.deepEqual(result.values.rent_calculation, row.rent_calculation);
  draft.values.suite_size = '6000';
  assert.equal(Fields.serializeDraft(draft).valid, false);
});
test('version-1 unknown metadata keys survive adoption and coordinated area updates', () => {
  const meta = { ...quote('sf', 1.4), future: { source: 'retained' } };
  meta.rent.provenance = { raw: 'Unchanged' };
  meta.rent.preservePrecision = 'opaque future field';
  const draft = Fields.hydrateDraft(linkedRow(meta));
  draft.values.suite_size = '6000';
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.equal(result.patch.monthly_base_rent, 8400);
  assert.deepEqual(result.patch.rent_calculation.future, meta.future);
  assert.deepEqual(result.patch.rent_calculation.rent.provenance, meta.rent.provenance);
});
test('area-only edit emits all five matching compatibility fields and unchanged linked metadata', () => {
  const row = linkedRow();
  const draft = Fields.hydrateDraft(row);
  draft.values.suite_size = '6000';
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.patch, { suite_size: '6000', rent_calculation: row.rent_calculation, monthly_base_rent: 8400, lease_rate_psf: 1.4, total_monthly_opex: 1500, monthly_opex_psf: 0.25, total_lease_rate: 9900 });
  assert.equal(Object.hasOwn(result.patch, 'lease_rate_per_acre'), false);
});
test('area-only legacy edit does not manufacture source metadata or rewrite independent rents', () => {
  const draft = Fields.hydrateDraft({ ...linkedRow(), rent_calculation: null });
  draft.values.suite_size = '6000';
  assert.deepEqual(Fields.serializeDraft(draft).patch, { suite_size: '6000' });
});
test('typing invalid rent preserves raw input, gives null preview and blocks save with source field', () => {
  const draft = Fields.hydrateDraft(linkedRow());
  draft.rentDraft = Rent.editRent(draft.rentDraft, 'total', '7,000-8,000');
  assert.equal(draft.rentDraft.rent.amount, '7,000-8,000');
  assert.equal(Rent.preview(draft.rentDraft, suite).monthly_base_rent, null);
  const result = Fields.serializeDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].field, 'rent_total');
});
test('formatting an existing source quote does not create a pricing patch', () => {
  const draft = Fields.hydrateDraft(linkedRow());
  draft.rentDraft.rent.amount = '1.4000';
  draft.values.building_sf = '40,000';
  assert.deepEqual(Fields.serializeDraft(draft).patch, {});
});
test('new typed values enforce precision and MT office area before any write', () => {
  const draft = Fields.hydrateDraft({ address: 'Test', ...suite, office_sf: '5001' }, { isNew: true });
  assert.match(Fields.serializeDraft(draft).issues[0].message, /Suite Size/);
  draft.values.office_sf = '500.5';
  assert.match(Fields.serializeDraft(draft).issues[0].message, /whole number/);
  draft.values.office_sf = 500.5;
  assert.match(Fields.serializeDraft(draft).issues[0].message, /whole number/);
  const imported = Fields.hydrateDraft({ address: 'Test', building_sf: 1000.5 }, { isNew: true });
  assert.match(Fields.serializeDraft(imported).issues[0].message, /whole number/);
});
test('unrelated historical office inconsistency remains unchanged, but edits revalidate it', () => {
  const draft = Fields.hydrateDraft({ ...linkedRow(), office_sf: 5001 });
  draft.values.notes = 'Unrelated';
  assert.equal(Fields.serializeDraft(draft).valid, true);
  draft.values.suite_size = '4999';
  assert.equal(Fields.serializeDraft(draft).valid, false);
});
test('independent draft mutations and reset hydration cannot change a sibling or baseline', () => {
  const row = linkedRow();
  const first = Fields.hydrateDraft(row);
  const second = Fields.hydrateDraft(row);
  first.values.suite_size = '6000';
  first.rentDraft = Rent.editRent(first.rentDraft, 'total', '7500');
  assert.equal(second.rentDraft.rent.basis, 'sf');
  assert.equal(second.values.suite_size, '5,000 SF');
  assert.deepEqual(first.baseline, row);
  assert.deepEqual(Fields.serializeDraft(Fields.hydrateDraft(first.baseline)).patch, {});
});
test('worker write validation accepts exact numeric historical precision but rejects malformed data', () => {
  assert.equal(Fields.validateSurveyWrite({ address: 'Test', building_sf: 10000.25 }).valid, true);
  assert.equal(Fields.validateSurveyWrite({ address: 'Test', building_sf: '1.2M' }).valid, false);
  assert.equal(Fields.validateSurveyWrite({ address: 'Test', yard_area: 'unknown' }).valid, false);
  assert.equal(Fields.validateSurveyWrite({ address: 'Test', rent_calculation: { version: 99 } }).valid, false);
});
