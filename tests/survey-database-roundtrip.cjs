// Real native PostgreSQL trigger + canonical web calculator + extension parity.
// Synthetic local fixtures only. No environment files or production connections.
// Usage: node tests/survey-database-roundtrip.cjs /absolute/master-app \
//   /absolute/embedded-postgres/dist/index.js
// Optional EXTENSION_ROOT tests the extracted review ZIP with this same harness.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const [masterApp, embeddedPath] = process.argv.slice(2);
assert.ok(masterApp && path.isAbsolute(masterApp), 'Pass the read-only Master App checkout by absolute path');
assert.ok(embeddedPath && path.isAbsolute(embeddedPath), 'Pass the locally installed embedded-postgres module by absolute path');
const pg = require(path.join(masterApp, 'node_modules/pg'));
const ts = require(path.join(masterApp, 'node_modules/typescript'));
const Rent = require(path.join(root, 'survey-rent.js'));
const Fields = require(path.join(root, 'survey-fields.js'));
const plain = value => JSON.parse(JSON.stringify(value));
const hash = text => createHash('sha256').update(text).digest('hex');
const modules = new Map();
const upstreamHashes = {};
// Load actual TypeScript functions without modifying or building the main app.
function upstreamModule(relative) {
  if (modules.has(relative)) return modules.get(relative).exports;
  const source = fs.readFileSync(path.join(masterApp, 'src', relative + '.ts'), 'utf8');
  upstreamHashes[relative + '.ts'] = hash(source);
  const module = { exports: {} };
  modules.set(relative, module);
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const context = vm.createContext({ module, exports: module.exports, require: name => {
    assert.ok(name.startsWith('@/lib/'), 'Only local canonical library imports are allowed: ' + name);
    return upstreamModule(name.slice(2));
  } });
  vm.runInContext(compiled, context, { filename: relative + '.ts' });
  return module.exports;
}
const webRent = upstreamModule('lib/survey-rent');
const moneyKeys = ['monthly_base_rent', 'lease_rate_psf', 'total_monthly_opex', 'monthly_opex_psf', 'total_lease_rate'];
const pick = (row, keys = moneyKeys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
const metadata = (basis = 'sf', amount = 1.4, expenses = { basis: 'sf', amount: .25, treatment: 'additional' }, acres = null) => ({
  version: 1, rent: { basis, amount }, expenses, offered_acres: acres,
});
const baselineArea = { tenancy: 'MT', building_sf: 40000, suite_size: '5,000 SF' };
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(plain(actual), plain(expected), label); checks++; };

(async () => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(embeddedPath).href);
  const taskDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'extension-survey-rent-db-'));
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const password = randomBytes(24).toString('hex');
  const native = new EmbeddedPostgres({ databaseDir: path.join(taskDir, 'db'), user: 'postgres', password,
    port, persistent: false, createPostgresUser: false, authMethod: 'scram-sha-256',
    postgresFlags: ['-h', '127.0.0.1', '-k', taskDir], onLog: () => {}, onError: () => {} });
  let client, started = false;
  try {
    await native.initialise(); await native.start(); started = true;
    await native.createDatabase('extension_survey_test');
    client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'extension_survey_test' });
    await client.connect();
    // Minimal schema faithful to the canonical numeric columns. This proves the
    // real calculation trigger, not production RLS or the entire hosted schema.
    await client.query(`create role anon; create role authenticated;
      create table public.survey_properties (
        id uuid primary key, survey_id uuid, address text, city text, state text,
        notes text, notes_2 text, internal_notes text, availability text, lease_type text,
        internal_status text, yard_area boolean, tenancy text, suite_number text,
        building_sf numeric, suite_size text, office_sf numeric, land_area_ac numeric,
        monthly_base_rent numeric, lease_rate_psf numeric, total_monthly_opex numeric,
        monthly_opex_psf numeric, total_lease_rate numeric, client_feedback text,
        client_killed boolean, is_featured boolean
      )`);
    const insert = async record => {
      const data = { id: randomUUID(), survey_id: randomUUID(), address: '100 Synthetic Example Road', city: 'Phoenix', state: 'AZ', ...record };
      const columns = Object.keys(data);
      for (const key of columns) assert.match(key, /^[a-z_][a-z_0-9]*$/);
      return (await client.query(`insert into survey_properties (${columns.join(',')}) values (${columns.map((_, i) => '$' + (i + 1)).join(',')}) returning to_jsonb(survey_properties) row`, Object.values(data))).rows[0].row;
    };
    const get = async id => (await client.query('select to_jsonb(s) row from survey_properties s where id=$1', [id])).rows[0].row;
    const update = async (id, patch) => {
      const keys = Object.keys(patch);
      for (const key of keys) assert.match(key, /^[a-z_][a-z_0-9]*$/);
      assert.ok(keys.length, 'An update must contain a reviewed change');
      return (await client.query(`update survey_properties set ${keys.map((key, i) => key + '=$' + (i + 2)).join(',')} where id=$1 returning to_jsonb(survey_properties) row`, [id, ...Object.values(patch)])).rows[0].row;
    };
    const legacy = await insert({ ...baselineArea, notes: 'Synthetic legacy', notes_2: 'Client visible second note',
      internal_notes: 'Private fixture provenance', lease_type: 'Historic custom type', internal_status: 'Imported custom status',
      yard_area: null, monthly_base_rent: 5000.005, lease_rate_psf: 1.234567, total_monthly_opex: 300,
      monthly_opex_psf: .0123456, total_lease_rate: 9999.99, client_feedback: 'Preserve my client comment', client_killed: false, is_featured: true });
    for (const filename of ['20260918194610_survey_rent_calculation.sql', '20260918195445_survey_rent_suite_precision.sql']) {
      const source = fs.readFileSync(path.join(masterApp, 'supabase/migrations', filename), 'utf8');
      upstreamHashes[filename] = hash(source);
      await client.query(source);
    }
    const migrated = await get(legacy.id);
    const { rent_calculation: migratedMetadata, ...migratedWithoutMetadata } = migrated;
    check(migratedMetadata, null, 'Migration leaves legacy metadata null');
    check(migratedWithoutMetadata, legacy, 'Actual migrations do not backfill or round legacy amounts');

    async function parity(label, calculation, area = baselineArea, legacyValues = {}) {
      const extension = Rent.calculateSurveyRent(calculation, area, legacyValues);
      const web = webRent.calculateSurveyRent(calculation, area, legacyValues);
      check(extension, web, label + ': full extension/web result (including displayed acres)');
      const saved = await insert({ ...area, ...legacyValues, rent_calculation: calculation });
      check(pick(saved), pick(extension), label + ': actual PostgreSQL trigger output');
      check(saved.rent_calculation, calculation, label + ': source precision retained');
      const reopened = Rent.calculateSurveyRent(saved.rent_calculation, saved, saved);
      check(pick(reopened), pick(saved), label + ': extension reopens database result without drift');
      check(webRent.resolveSurveyRentArea(area), Rent.resolveSurveyRentArea(area), label + ': offered denominator parity');
      return saved;
    }
    await parity('ST 10,000 SF at 1.25 with two offered acres', metadata('sf', 1.25, null, 2), { tenancy: 'ST', building_sf: 10000 });
    const mt = await parity('MT suite in larger building', metadata());
    check(pick(mt), { monthly_base_rent: 7000, lease_rate_psf: 1.4, total_monthly_opex: 1250, monthly_opex_psf: .25, total_lease_rate: 8250 }, 'Worked 5,000 SF payload');
    await parity('Pure yard acre quote with no building', metadata('acre', 3000, { basis: 'total', amount: null, treatment: 'unknown' }, 2), { tenancy: 'ST', building_sf: null });
    await parity('Parcel acreage is not offered acreage', metadata('acre', 3000), { tenancy: 'ST', building_sf: null, land_area_ac: 10 });
    for (const suite_size of [null, '', '0', '6,500 - 15,000 SF', 'about 5,000 SF', '5,000 + 2,000', '1,2 SF', '1.00000000000000001 SF', '0.' + '0'.repeat(330) + '1 SF']) {
      await parity('Unresolved suite ' + JSON.stringify(suite_size), metadata(), { ...baselineArea, suite_size });
    }
    for (const tenancy of [null, '', 'Historic unknown']) {
      await parity('Unknown tenancy ' + JSON.stringify(tenancy), metadata(), { ...baselineArea, tenancy });
    }
    for (const suite_size of ['5k SF', '1.001k sq. ft.', '0.1001 k', '12.3456789 SF', '9,007,199,254,740,991 SF']) {
      await parity('Supported exact suite ' + suite_size, metadata('sf', .1234567), { ...baselineArea, suite_size });
    }
    const edgeQuotes = [0, null, .005, 1.005, 2.675, .33335, .1001, .0000001, 1e-20, 9007199254740991];
    for (const basis of ['sf', 'total', 'acre']) for (const amount of edgeQuotes) {
      await parity(`Decimal ${basis} ${amount}`, metadata(basis, amount, { basis: 'total', amount: .005, treatment: 'additional' }, .3), { tenancy: 'ST', building_sf: 3 });
    }
    for (const treatment of ['included', 'unknown', 'additional']) {
      await parity('Expense treatment ' + treatment, metadata('total', 7000, { basis: 'sf', amount: .25, treatment }));
    }
    await parity('Blank adopted rent', metadata('total', null), baselineArea, pick(legacy));
    await parity('Rent only preserves unreviewed expenses', metadata('total', 9000, null), baselineArea, pick(legacy));
    await parity('Expenses only preserves unreviewed rent', { ...metadata(), rent: null }, baselineArea, pick(legacy));
    await parity('Both groups unreviewed', { ...metadata(), rent: null, expenses: null }, baselineArea, pick(legacy));
    await parity('Explicit zero sources', metadata('total', 0, { basis: 'sf', amount: 0, treatment: 'additional' }));

    // Deterministic decimal combinations exercise half-cent/PSF boundaries and
    // magnitudes without a test that simply repeats the implementation formula.
    let seed = 18194610;
    const next = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
    for (let i = 0; i < 120; i++) {
      const basis = ['total', 'sf', 'acre'][i % 3];
      const amount = next(999999) / 10000;
      const acres = (1 + next(99999)) / 10000;
      const area = { tenancy: i % 2 ? 'ST' : 'MT', building_sf: 1 + next(50000), suite_size: ((1 + next(999999)) / 100).toFixed(2) + ' SF' };
      await parity('Deterministic decimal fixture ' + i, metadata(basis, amount,
        { basis: i % 2 ? 'sf' : 'total', amount: next(99999) / 10000, treatment: 'additional' }, acres), area);
    }

    // Real extension serializer -> actual UPDATE trigger, with complete saved
    // baselines. Unrelated fields and client feedback are intentionally present.
    function serialize(row, changes) {
      const draft = Fields.hydrateDraft(row, { isNew: false });
      return Fields.serializeDraft({ ...draft, baseline: row, values: { ...draft.values, ...changes }, isNew: false });
    }
    const notesOnly = serialize(migrated, { notes: 'Edited synthetic client note' });
    check(notesOnly.valid, true, 'Legacy notes-only change validates');
    check(notesOnly.patch, { notes: 'Edited synthetic client note' }, 'Legacy patch omits rents, metadata, choices, null yard and feedback');
    const legacySaved = await update(legacy.id, notesOnly.patch);
    check({ ...legacySaved, notes: migrated.notes }, migrated, 'Legacy notes-only roundtrip preserves all other fields byte-for-value');

    let linked = await insert({ ...baselineArea, notes: 'Linked fixture', notes_2: 'Visible second note', internal_notes: 'Private',
      yard_area: null, client_feedback: 'Still here', client_killed: false, is_featured: true, rent_calculation: metadata() });
    const linkedNotes = serialize(linked, { notes: 'Only linked notes' });
    check(linkedNotes.patch, { notes: 'Only linked notes' }, 'Linked unrelated update sends no pricing fields');
    const linkedNotesSaved = await update(linked.id, linkedNotes.patch);
    check({ ...linkedNotesSaved, notes: linked.notes }, linked, 'Linked unrelated update preserves metadata and feedback');
    linked = linkedNotesSaved;
    for (const suite_size of ['6000', '3,333 SF', '1.001k SF', '6,500 - 15,000 SF', '5000']) {
      const serialized = serialize(linked, { suite_size });
      check(serialized.valid, true, 'Coordinated area change validates: ' + suite_size);
      check(serialized.patch.rent_calculation, linked.rent_calculation, 'Coordinated area PATCH includes metadata');
      const expected = Rent.calculateSurveyRent(linked.rent_calculation, { ...linked, suite_size }, linked);
      check(pick(serialized.patch), pick(expected), 'Coordinated area PATCH includes all five compatible amounts');
      const saved = await update(linked.id, serialized.patch);
      check(saved.rent_calculation, linked.rent_calculation, 'Area change keeps source linked in actual trigger');
      check(pick(saved), pick(expected), 'Area change is canonical after DB write');
      check(saved.client_feedback, linked.client_feedback, 'Area change preserves client feedback');
      linked = saved;
    }
    async function saveAdopted(label, mutate, expected) {
      const draft = Fields.hydrateDraft(linked, { isNew: false });
      mutate(draft);
      const serialized = Fields.serializeDraft(draft);
      check(serialized.valid, true, label + ': serializer validates');
      const saved = await update(linked.id, serialized.patch);
      check(saved.rent_calculation, serialized.patch.rent_calculation, label + ': adopted source survives trigger');
      check(pick(saved), pick(serialized.patch), label + ': coordinated output survives trigger');
      for (const [key, value] of Object.entries(expected)) check(saved[key], value, label + ': ' + key);
      linked = saved;
    }
    await saveAdopted('Edit calculated total to 7500', draft => {
      draft.rentDraft = Rent.editRent(draft.rentDraft, 'total', '7500');
    }, { monthly_base_rent: 7500, lease_rate_psf: 1.5 });
    await saveAdopted('Change area with total as source', draft => {
      draft.values.suite_size = '6000';
    }, { monthly_base_rent: 7500, lease_rate_psf: 1.25 });
    await saveAdopted('Adopt PSF as source', draft => {
      draft.rentDraft = Rent.editRent(draft.rentDraft, 'sf', '1.40');
    }, { monthly_base_rent: 8400, lease_rate_psf: 1.4 });
    for (const [treatment, total_monthly_opex, total_lease_rate] of [['included', 0, 8400], ['unknown', null, null], ['additional', 1500, 9900]]) {
      await saveAdopted('Expense treatment through saved reopen: ' + treatment, draft => {
        draft.rentDraft = Rent.changeExpenseTreatment(draft.rentDraft, treatment);
      }, { total_monthly_opex, total_lease_rate });
      check(linked.rent_calculation.expenses.amount, .25, 'Previous separate quote remains available through ' + treatment);
    }
    await saveAdopted('Explicit blank clears adopted rent', draft => {
      draft.rentDraft = Rent.editRent(draft.rentDraft, 'sf', '');
    }, { monthly_base_rent: null, lease_rate_psf: null, total_lease_rate: null });
    await saveAdopted('Explicit zero is retained', draft => {
      draft.rentDraft = Rent.editRent(draft.rentDraft, 'sf', '0');
    }, { monthly_base_rent: 0, lease_rate_psf: 0, total_lease_rate: 1500 });
    const futureCompatible = { ...metadata(), private_future_hint: 'Unrecognized optional version-1 detail',
      rent: { ...metadata().rent, external_hint: { preserve: true } } };
    const compatibleRow = await insert({ ...baselineArea, rent_calculation: futureCompatible });
    const compatibleDraft = Fields.hydrateDraft(compatibleRow, { isNew: false });
    compatibleDraft.values.suite_size = '6000';
    const compatiblePatch = Fields.serializeDraft(compatibleDraft);
    check(compatiblePatch.valid, true, 'Known version-1 metadata may contain unrecognized optional keys');
    check((await update(compatibleRow.id, compatiblePatch.patch)).rent_calculation, futureCompatible,
      'Unrecognized optional version-1 metadata remains lossless on coordinated area change');
    const detach = await update(linked.id, { monthly_base_rent: 12345 });
    check(detach.rent_calculation, null, 'Control case: incompatible legacy amount really detaches source');
    check(detach.monthly_base_rent, 12345, 'Control case: trigger keeps older client explicit value');

    // Actual one-statement insert/no-overwrite semantics used by the batch
    // transport. This intentionally does not substitute for its REST tests.
    const batchInsert = async rows => (await client.query(`insert into survey_properties
      select x.* from jsonb_populate_recordset(null::survey_properties,$1::jsonb) x
      on conflict (id) do nothing returning to_jsonb(survey_properties) row`, [JSON.stringify(rows)])).rows.map(item => item.row);
    const batchSurvey = randomUUID();
    const batch = [
      { id: randomUUID(), survey_id: batchSurvey, address: '200 Batch Fixture Road', city: 'Phoenix', state: 'AZ',
        ...baselineArea, suite_number: '101', availability: 'Available', rent_calculation: metadata('sf', 1.4) },
      { id: randomUUID(), survey_id: batchSurvey, address: '200 Batch Fixture Road', city: 'Phoenix', state: 'AZ',
        ...baselineArea, suite_number: '102', suite_size: '2000', availability: 'Confirmed', rent_calculation: metadata('total', 2500) },
    ];
    const savedBatch = await batchInsert(batch);
    check(savedBatch.length, 2, 'Two independent spaces save in one statement');
    check(savedBatch.map(row => [row.suite_number, row.monthly_base_rent, row.availability]),
      [['101', 7000, 'Available'], ['102', 2500, 'Confirmed']], 'Suite-specific rent and status stay independent');
    const changedAfterSave = await update(batch[0].id, { client_feedback: 'Comment after committed response was lost', notes: 'Subsequent broker edit' });
    check(await batchInsert(batch), [], 'Same stable IDs ignore completed inserts on retry');
    check(await get(batch[0].id), changedAfterSave, 'Retry never overwrites later client or broker edits');
    const partialIds = [batch[0].id, randomUUID()];
    check(Number((await client.query('select count(*) from survey_properties where survey_id=$1 and id=any($2::uuid[])', [batchSurvey, partialIds])).rows[0].count), 1,
      'Readback detects partial existing IDs');
    check(Number((await client.query('select count(*) from survey_properties where survey_id=$1 and id=any($2::uuid[])', [randomUUID(), batch.map(row => row.id)])).rows[0].count), 0,
      'Readback scoped to another survey never recovers these IDs');
    const rejectedBatch = batch.map(row => ({ ...row, id: randomUUID() }));
    rejectedBatch[1].rent_calculation = metadata('sf', -1);
    await assert.rejects(batchInsert(rejectedBatch), error => error.code === '23514'); checks++;
    check(Number((await client.query('select count(*) from survey_properties where id=any($1::uuid[])', [rejectedBatch.map(row => row.id)])).rows[0].count), 0,
      'One invalid suite rolls back the entire attempted batch');
    rejectedBatch[1].rent_calculation = metadata('sf', 1.1);
    check((await batchInsert(rejectedBatch)).length, 2, 'Same reviewed IDs can save after definitely rejected validation is corrected');

    // This is deliberately not a promise of server-level suite-label uniqueness.
    // Different clients with different stable IDs can pass a simultaneous label
    // preflight. That acknowledged schema boundary remains outside this patch.
    const sameLabel = batch.map(() => ({ ...batch[0], id: randomUUID() }));
    check((await batchInsert(sameLabel)).length, 2, 'Different IDs have no database suite-label uniqueness constraint');

    // Future-version metadata cannot currently be written through this version-1
    // trigger. Seed a hypothetical future saved row with the trigger disabled
    // only in this disposable cluster, then prove notes-only rejection is safe.
    await client.query('alter table survey_properties disable trigger survey_rent_calculation_before_write');
    const future = await insert({ ...baselineArea, ...pick(legacy), rent_calculation: { version: 2, opaque: { quote: 'Future data' } }, notes: 'Future original' });
    await client.query('alter table survey_properties enable trigger survey_rent_calculation_before_write');
    const futureNotes = serialize(future, { notes: 'Future unrelated edit' });
    check(futureNotes.valid, true, 'Unknown metadata does not prevent forming a safe unrelated patch');
    check(futureNotes.patch, { notes: 'Future unrelated edit' }, 'Unknown metadata is omitted and never coerced or erased');
    await assert.rejects(update(future.id, futureNotes.patch), error => error.code === '23514' && /Invalid survey rent calculation/.test(error.message)); checks++;
    check(await get(future.id), future, 'Actual trigger rejects unsupported-version update without losing saved data');

    for (const invalid of [{}, { ...metadata(), version: 2 }, { ...metadata(), offered_acres: '2' },
      metadata('sf', -1), metadata('sf', 9007199254740992), metadata('sf', 1, { basis: 'acre', amount: 1, treatment: 'additional' }),
      metadata('sf', 1, { basis: 'sf', amount: 1, treatment: 'guess' })]) {
      await assert.rejects(insert({ ...baselineArea, rent_calculation: invalid }), error => error.code === '23514'); checks++;
    }
    console.log(JSON.stringify({ result: 'passed', assertions: checks,
      database: (await client.query('select version() version')).rows[0].version,
      scope: 'Extension serializer + canonical web calculator + actual unmodified PostgreSQL rent trigger; synthetic loopback fixtures only.',
      limit: 'Unknown rent metadata versions preserve local and saved data, but current version-1 database trigger rejects even unrelated updates. RLS, REST transport and production rendering are outside this harness.',
      upstreamHashes }, null, 2));
  } finally {
    if (client) await client.end();
    if (started) await native.stop();
    await fsp.rm(taskDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
