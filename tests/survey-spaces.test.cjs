const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const S = require(path.join(process.env.EXTENSION_ROOT || path.resolve(__dirname, '..'), 'survey-spaces.js'));
const accountId = 'a0000000-0000-4000-8000-000000000001';
const surveyId = 'b0000000-0000-4000-8000-000000000001';
const row = (label, suffix = 1) => ({ id: `c0000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`, survey_id: surveyId,
  address: '100 Test Ave', city: 'Phoenix', state: 'AZ', tenancy: 'MT', suite_number: label,
  building_sf: 40000, land_area_ac: 10, for_sale_or_lease: ['lease'], updated_at: '2026-09-18T12:00:00Z' });

test('canonical building identity includes city/state and only normalizes whitespace/case', () => {
  assert.equal(S.surveyBuildingKey(row('101')), S.surveyBuildingKey({ ...row('102'), address: ' 100  TEST AVE ', city: 'phoenix ' }));
  for (const change of [{ city: 'Tempe' }, { state: 'CA' }, { address: '100 Test Avenue' }])
    assert.notEqual(S.surveyBuildingKey(row('101')), S.surveyBuildingKey({ ...row('101'), ...change }));
});

test('only explicit MT rows group; empty, ST and unknown identity remain independent', () => {
  const rows = [row('101'), row('102', 2), { ...row('103', 3), tenancy: 'ST' }, { ...row('104', 4), tenancy: null },
    { ...row('105', 5), address: '' }, { ...row('106', 6), address: '' }];
  const groups = S.groupSurveySpaces(rows);
  assert.equal(groups.length, 5); assert.equal(groups[0].spaces.length, 2);
  assert.deepEqual(groups.flatMap((group) => group.spaces), rows);
});

test('available-space seed is independent and never copies sibling offering terms or feedback', () => {
  const sibling = { ...row('101'), monthly_base_rent: 7000, rent_calculation: { offered_acres: 2 }, office_sf: 100,
    notes: 'Client text', notes_2: 'Second note', internal_notes: 'Private', client_feedback: 'Yes', client_killed: true,
    flyer_url: 'https://example.test/suite.pdf', availability: 'Confirmed', date_available: 'Now', lease_type: 'NNN', photo_url: 'https://example.test/building.jpg' };
  const seed = S.availableSpaceSeed(sibling);
  assert.equal(seed.building_sf, 40000); assert.equal(seed.land_area_ac, 10); assert.equal(seed.photo_url, sibling.photo_url);
  for (const key of ['id', 'survey_id', 'updated_at', 'suite_number', 'suite_size', 'office_sf', 'monthly_base_rent', 'rent_calculation', 'notes', 'notes_2', 'internal_notes', 'client_feedback', 'client_killed', 'flyer_url', 'availability', 'date_available', 'lease_type']) assert.equal(Object.hasOwn(seed, key), false, key);
  seed.for_sale_or_lease.push('sale'); assert.deepEqual(sibling.for_sale_or_lease, ['lease']);
});

test('duplicate labels compare canonical building and Suite prefix while combined alternatives stay separate', () => {
  assert.throws(() => S.assertUniqueSpaces([row('101'), row('Suite 101', 2)]), /already exists/);
  assert.throws(() => S.assertUniqueSpaces([row('101', 3)], [row(' suite 101 ', 2)]), /already exists/);
  assert.doesNotThrow(() => S.assertUniqueSpaces([row('101'), row('Suites 101 + 102 (combined)', 2)]));
  assert.doesNotThrow(() => S.assertUniqueSpaces([row('101')], [{ ...row('101', 3), city: 'Tempe' }]));
  assert.equal(S.getSpaceLabel(row('101')), 'Suite 101');
  assert.equal(S.getSpaceLabel(row('Suites 101 + 102')), 'Suites 101 + 102');
});

test('reviewed requests deep-copy independent row terms and preserve stable IDs', () => {
  const a = row('101'); delete a.updated_at;
  const b = { ...row('102', 2), monthly_base_rent: 9500 }; delete b.updated_at;
  const request = S.createBatchRequest({ accountId, surveyId, rows: [a, b] });
  a.suite_number = 'Wrong'; b.monthly_base_rent = 0;
  assert.equal(request.rows[0].suite_number, '101'); assert.equal(request.rows[1].monthly_base_rent, 9500);
  assert.equal(request.rows[0].id, a.id); assert.notEqual(request.rows[0].id, request.rows[1].id);
  assert.throws(() => S.createBatchRequest({ accountId, surveyId, rows: [a, { ...a }] }), /own identifier/);
});

test('readback is scoped and distinguishes all, some and zero; later feedback always survives recovery', () => {
  const rows = [row('101'), row('102', 2)].map(({ updated_at, ...rest }) => rest);
  const request = S.createBatchRequest({ accountId, surveyId, rows });
  assert.equal(S.classifyReadback(request, []).status, 'none');
  assert.equal(S.classifyReadback(request, [rows[0]]).status, 'partial');
  assert.equal(S.classifyReadback(request, rows.map(r => ({ ...r, survey_id: accountId }))).status, 'none');
  const saved = rows.map(r => ({ ...r, client_feedback: 'Added later', monthly_base_rent: 9999 }));
  assert.deepEqual(S.classifyReadback(request, saved).properties, saved);
});

test('update requests cannot replace identity/client feedback; recovery never replays a changed baseline', () => {
  const baseline = row('101');
  const request = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed note' } });
  assert.equal(S.classifyReadback(request, [baseline]).status, 'none');
  assert.equal(S.classifyReadback(request, [{ ...baseline, updated_at: 'later', monthly_base_rent: 9999 }]).status, 'changed');
  assert.equal(S.classifyReadback(request, [{ ...baseline, notes: 'Reviewed note', client_feedback: 'New feedback' }]).status, 'saved');
  for (const patch of [{ survey_id: accountId }, { client_feedback: 'Do not overwrite' }, { updated_at: 'spoof' }])
    assert.throws(() => S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch }), /identity|ownership|feedback/);
});

test('Survey-only column allowlist rejects unknown/Comp columns and protected fields on inserts and updates', () => {
  const baseline = { ...row('101'), is_featured: true, client_feedback: 'Keep', client_killed: true };
  const { updated_at, ...insert } = row('101');
  for (const [key, value] of Object.entries({ property_name: 'Comp only', invented_column: 'unknown',
    client_feedback: 'Replace', client_killed: false, is_featured: false,
    created_at: '2026-01-01', updated_at: '2026-01-02', created_by: accountId, user_id: accountId })) {
    assert.throws(() => S.createBatchRequest({ accountId, surveyId, rows: [{ ...insert, [key]: value }] }), error => error.saveRejected === true && error.message.includes(key));
    assert.throws(() => S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { [key]: value } }), error => error.saveRejected === true && error.message.includes(key));
  }
  const safe = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed', notes_2: 'Client note two', internal_notes: 'Private', availability: 'Confirmed' } });
  assert.equal(safe.baseline.is_featured, true); assert.equal(safe.baseline.client_feedback, 'Keep'); assert.equal(safe.baseline.client_killed, true);
  assert.equal(Object.hasOwn(safe.patch, 'is_featured'), false);
  const allowedInsert = S.createBatchRequest({ accountId, surveyId, rows: [insert] });
  assert.equal(allowedInsert.rows[0].id, insert.id); assert.equal(allowedInsert.rows[0].survey_id, surveyId);
});
