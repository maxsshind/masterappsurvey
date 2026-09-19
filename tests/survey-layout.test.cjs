const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const { migratePreferences, normalizeSurvey, fldKey, layoutUnit, BACKUP_KEY, SURVEY_VERSION } = require(path.join(root, 'layout.js'));
const source = fs.readFileSync(path.join(root, 'layout.js'), 'utf8');

function legacy() {
  return {
    v: 1, density: 'compact', unrelatedSetting: { keep: true },
    survey: {
      order: ['c1', 'more', 'notes', 'lease', 'status', 'tenancy', 'address', 'size', 'retired'],
      hiddenSecs: ['address', 'tenancy', 'status', 'size', 'lease', 'building', 'c1'],
      collapsedSecs: ['address', 'status', 'size', 'lease', 'notes', 'c1'],
      openDetails: ['more', 'retired'],
      hiddenFields: ['fAddress', 'fTenancy', 'fNotes', 'fDateAvailable', 'fLeaseRate', 'fMonthlyBase', 'fInternalStatus'],
      fieldMoves: { fNotes: 'more', fAvailability: 'c1', fMonthlyBase: 'c1', fLeaseRate: 'notes', fLeaseType: 'more', fInternalStatus: 'c1', fCity: 'address', fPhotoUrl: 'retired' },
      customSecs: [{ key: 'c1', title: 'My review', preserve: 'extra metadata' }],
      customSurveySetting: { keep: true },
    },
    comp: { order: ['notes', 'yard', 'deal'], hiddenSecs: ['sizing'], collapsedSecs: ['deal'], hiddenFields: ['comp_notes'],
      fieldMoves: { comp_yard: 'c7' }, customSecs: [{ key: 'c7', title: 'My Comp section' }], opaque: { a: [2, 1] } },
  };
}

test('migration pins the required Survey flow, reconciles old sections, and keeps compatible customization', () => {
  const original = legacy();
  const originalJSON = JSON.stringify(original);
  const { preferences: p, migrated } = migratePreferences(original);
  assert.equal(migrated, true);
  assert.equal(p.surveyLayoutVersion, SURVEY_VERSION);
  assert.equal(p.surveyMigrationNoticePending, true);
  assert.deepEqual(p.survey.order, ['setup', 'size', 'lease', 'offering', 'c1', 'more', 'notes']);
  assert.deepEqual(p.survey.hiddenSecs, ['building', 'c1']);
  assert.deepEqual(p.survey.collapsedSecs, ['notes', 'c1']);
  assert.deepEqual(p.survey.openDetails, ['more']);
  assert.deepEqual(p.survey.hiddenFields, ['fInternalStatus']);
  assert.deepEqual(p.survey.fieldMoves, { fLeaseType: 'more', fInternalStatus: 'c1', fCity: 'setup' });
  assert.deepEqual(p.survey.customSecs, original.survey.customSecs);
  assert.deepEqual(p.survey.customSurveySetting, { keep: true });
  assert.equal(p.density, 'compact');
  assert.equal(JSON.stringify(original), originalJSON, 'The source preference object is never mutated');
});

test('Comp preference object is retained exactly, including absent and unknown properties', () => {
  const original = legacy();
  const compJSON = JSON.stringify(original.comp);
  const { preferences } = migratePreferences(original);
  assert.equal(preferences.comp, original.comp, 'Migration does not replace the Comp object');
  assert.equal(JSON.stringify(preferences.comp), compJSON);
  assert.equal(Object.hasOwn(preferences.comp, 'openDetails'), false, 'Do not add Comp default properties');
  assert.deepEqual(preferences.unrelatedSetting, { keep: true });
});

test('a second migration is identical and does not rearm a dismissed notice', () => {
  const once = migratePreferences(legacy()).preferences;
  const twice = migratePreferences(once);
  assert.equal(twice.migrated, false);
  assert.deepEqual(twice.preferences, once);
  once.surveyMigrationNoticePending = false;
  assert.equal(migratePreferences(once).preferences.surveyMigrationNoticePending, false);
});

test('even current-version preferences cannot hide, collapse, or relocate required Survey controls', () => {
  const value = legacy();
  value.surveyLayoutVersion = SURVEY_VERSION;
  value.survey.order = ['more', 'lease', 'setup', 'offering', 'size'];
  value.survey.hiddenFields.push('surveyPricing');
  value.survey.fieldMoves.surveyPricing = 'more';
  value.survey.hiddenSecs.push('setup', 'offering');
  const p = migratePreferences(value).preferences.survey;
  assert.deepEqual(p.order.slice(0, 4), ['setup', 'size', 'lease', 'offering']);
  assert.equal(p.hiddenFields.includes('surveyPricing'), false);
  assert.equal(Object.hasOwn(p.fieldMoves, 'surveyPricing'), false);
  for (const key of ['setup', 'size', 'lease', 'offering']) {
    assert.equal(p.hiddenSecs.includes(key), false);
    assert.equal(p.collapsedSecs.includes(key), false);
  }
});

test('malformed Survey lists do not discard compatible custom definitions or modify Comp', () => {
  const p = normalizeSurvey({ order: null, hiddenFields: {}, fieldMoves: null, collapsedSecs: 1,
    customSecs: [null, { key: 'setup', title: 'Collision' }, { key: 'c1', title: '<b>Kept as text</b>' },
      { key: 'c1', title: 'Duplicate' }, { key: 'bad"selector', title: 'Invalid' }] });
  assert.deepEqual(p.order, ['setup', 'size', 'lease', 'offering']);
  assert.deepEqual(p.customSecs, [{ key: 'c1', title: '<b>Kept as text</b>' }]);
  assert.deepEqual(p.fieldMoves, {});
});

test('explicit group identities do not depend on whichever per-space radio is first', () => {
  const group = { dataset: { layoutKey: 'fTenancy' }, id: 'tenancy-container', querySelector: () => ({ id: 'space-a-ST' }) };
  assert.equal(fldKey(group), 'fTenancy');
  group.querySelector = () => ({ id: 'space-b-MT' });
  assert.equal(fldKey(group), 'fTenancy');
  assert.equal(fldKey({ dataset: {}, id: 'old-unit', querySelector: () => ({ id: 'comp_address' }) }), 'comp_address');
});

test('a nested field or radio resolves to the entire linked pricing layout unit', () => {
  const outer = { dataset: { layoutKey: 'surveyPricing' }, parentElement: { closest: () => null } };
  const inner = { parentElement: { closest: () => outer } };
  const input = { closest: () => inner };
  assert.equal(layoutUnit(input), outer);
  assert.equal(layoutUnit(null), undefined);
});

async function boot(store, failKey) {
  const writes = [], warnings = [];
  const context = vm.createContext({
    window: {}, document: { getElementById: () => null, addEventListener: () => {}, body: { classList: { toggle: () => {} } } },
    console: { warn: (...args) => warnings.push(args) },
    chrome: { storage: { local: {
      get: async () => structuredClone(store),
      set: async (value) => {
        const copy = JSON.parse(JSON.stringify(value));
        writes.push(copy);
        if (Object.hasOwn(value, failKey)) throw new Error('Fixture storage failure');
        Object.assign(store, copy);
      },
    } } },
  });
  vm.runInContext(source, context, { filename: 'layout.js' });
  await context.window.Layout.apply('survey');
  return { writes, warnings, context };
}

test('runtime persists an exact backup before migration and never overwrites it on reopen', async () => {
  const original = legacy();
  original.surveyLayoutVersion = 2;
  const oldBackup = { v: 1, marker: 'Original layout backup' };
  const store = { layout_prefs: structuredClone(original), layout_prefs_survey_v1_backup: oldBackup };
  const first = await boot(store);
  assert.deepEqual(store.layout_prefs_survey_v1_backup, oldBackup);
  assert.deepEqual(Object.keys(first.writes[0]), [BACKUP_KEY]);
  assert.deepEqual(store[BACKUP_KEY], original);
  assert.equal(store.layout_prefs.surveyLayoutVersion, SURVEY_VERSION);
  assert.equal(JSON.stringify(store.layout_prefs.comp), JSON.stringify(original.comp));
  const second = await boot(store);
  assert.equal(second.writes.length, 0);
  assert.deepEqual(store[BACKUP_KEY], original);
});

test('an existing backup is preserved when a migration needs to run again', async () => {
  const previous = { v: 1, marker: 'first backup' };
  const store = { layout_prefs: legacy(), [BACKUP_KEY]: structuredClone(previous) };
  const { writes } = await boot(store);
  assert.equal(writes.length, 1);
  assert.deepEqual(store[BACKUP_KEY], previous);
});

test('backup failure leaves original stored preferences intact and never dispatches replacement', async () => {
  const store = { layout_prefs: legacy() };
  const before = structuredClone(store);
  const { writes, warnings } = await boot(store, BACKUP_KEY);
  assert.deepEqual(store, before);
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0]), [BACKUP_KEY]);
  assert.equal(warnings.length, 1);
});

test('migration-save failure retains the exact original plus backup for safe retry', async () => {
  const original = legacy();
  const store = { layout_prefs: structuredClone(original) };
  const { warnings } = await boot(store, 'layout_prefs');
  assert.deepEqual(store.layout_prefs, original);
  assert.deepEqual(store[BACKUP_KEY], original);
  assert.equal(warnings.length, 1);
  await boot(store);
  assert.equal(store.layout_prefs.surveyLayoutVersion, SURVEY_VERSION);
  assert.deepEqual(store[BACKUP_KEY], original);
});
