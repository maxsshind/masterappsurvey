const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const S = require(path.join(root, 'survey-spaces.js'));
const accountId = 'a0000000-0000-4000-8000-000000000001';
const surveyId = 'b0000000-0000-4000-8000-000000000001';
const id = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n = 1) => ({ id: id(n), survey_id: surveyId, address: '100 Fixture Ave', city: 'Phoenix', state: 'AZ',
  tenancy: 'MT', suite_number: String(n), suite_size: '5000', building_sf: 40000, notes: null, rent_calculation: null });
const makeRequest = (rows = [row()]) => S.createBatchRequest({ accountId, surveyId, rows });
const json = (value) => JSON.parse(JSON.stringify(value));

function harness(shared = {}) {
  const h = { storage: new Map(), rows: new Map(), writes: [], readFailures: 0, ...shared };
  const chrome = { runtime: { onInstalled: { addListener() {} }, onMessage: { addListener(listener) { h.listener = listener; } } },
    sidePanel: { setPanelBehavior: async () => {} }, storage: { local: {} } };
  function callback(action, cb, result) {
    if (h.storageFailure === action) chrome.runtime.lastError = { message: 'Storage unavailable' };
    cb(result); delete chrome.runtime.lastError;
  }
  chrome.storage.local.get = (keys, cb) => callback('get', cb, Object.fromEntries(keys.map(key => [key, h.storage.get(key)])));
  chrome.storage.local.set = (values, cb) => { if (h.storageFailure !== 'set') for (const [k, v] of Object.entries(values)) h.storage.set(k, json(v)); callback('set', cb); };
  chrome.storage.local.remove = (keys, cb) => { if (h.storageFailure !== 'remove') for (const key of keys) h.storage.delete(key); callback('remove', cb); };
  const c = vm.createContext({ chrome, console, crypto: globalThis.crypto, URL, URLSearchParams, setTimeout, clearTimeout });
  c.importScripts = (...files) => { for (const file of files) if (file !== 'config.js') vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file }); };
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), c, { filename: 'background.js' });
  c.sbGetSession = async () => {
    if (h.authFailure) throw c.authError('Session expired');
    return { user_id: h.accountId || accountId, access_token: 'fixture-not-a-token' };
  };
  c.sbReadSurveyIds = async (survey, ids) => {
    if (h.readFailures > 0) { h.readFailures--; throw new Error('Readback unavailable'); }
    return [...h.rows.values()].filter(r => r.survey_id === survey && ids.includes(r.id)).map(json);
  };
  c.sbListAllSurveyProperties = async (survey) => {
    if (h.lookupFailure) throw new Error('Lookup unavailable');
    return [...h.rows.values()].filter(r => r.survey_id === survey).map(json);
  };
  c.sbInsertSurveyBatch = async (rows) => {
    h.writes.push({ kind: 'insert', rows: json(rows) });
    if (h.beforeWrite) await h.beforeWrite(rows);
    if (!h.skipCommit) for (const r of rows) if (!h.rows.has(r.id)) h.rows.set(r.id, { ...json(r), updated_at: '2026-09-18T13:00:00Z' });
    if (h.afterCommit) await h.afterCommit(rows);
    if (h.lostResponse) throw new Error('Response lost');
  };
  c.sbUpdateSurveyScoped = async (survey, rowId, updatedAt, patch) => {
    h.writes.push({ kind: 'update', survey, rowId, updatedAt, patch: json(patch) });
    if (h.beforeWrite) await h.beforeWrite(patch);
    const current = h.rows.get(rowId);
    if (current?.survey_id === survey && current.updated_at === updatedAt) h.rows.set(rowId, { ...current, ...json(patch), updated_at: '2026-09-18T13:00:00Z' });
    if (h.afterCommit) await h.afterCommit(patch);
    if (h.lostResponse) throw new Error('Response lost');
    return [];
  };
  h.c = c; h.pending = () => [...h.storage.values()][0];
  return h;
}

function restoreRealTransport(h, name) {
  const source = fs.readFileSync(path.join(root, 'supabase.js'), 'utf8');
  const fn = source.match(new RegExp(`^async function ${name}\\([^]*?^}`, 'm'));
  assert.ok(fn); vm.runInContext(fn[0], h.c);
}

test('atomic batch persists exact account/survey request before one no-overwrite statement', async () => {
  const h = harness(); const request = makeRequest([row(1), { ...row(2), monthly_base_rent: 9500 }]);
  h.beforeWrite = async () => {
    assert.equal(h.pending().phase, 'dispatched'); assert.deepEqual(h.pending().request, request);
    assert.equal([...h.storage.keys()][0], `survey_pending_v1:${accountId}:${surveyId}`);
  };
  const result = await h.c.saveSurveyRequest(request);
  assert.equal(result.status, 'saved'); assert.equal(result.properties.length, 2);
  assert.equal(h.writes.length, 1); assert.equal(h.storage.size, 0);
});

test('double click joins one in-flight request and cannot mint IDs or duplicate rows', async () => {
  const h = harness(); const request = makeRequest();
  const results = await Promise.all([h.c.saveSurveyRequest(request), h.c.saveSurveyRequest(json(request))]);
  assert.deepEqual(results.map(r => r.status), ['saved', 'saved']); assert.equal(h.writes.length, 1); assert.equal(h.rows.size, 1);
});

test('committed but lost response recovers without overwrite, including after worker restart and client feedback', async () => {
  const h = harness(); const request = makeRequest([row(1), row(2)]);
  h.lostResponse = true; h.afterCommit = () => { h.readFailures = 1; };
  await assert.rejects(h.c.saveSurveyRequest(request), /Readback unavailable/);
  assert.equal(h.pending().phase, 'dispatched');
  h.rows.set(id(1), { ...h.rows.get(id(1)), monthly_base_rent: 1111, client_feedback: 'Updated after save' });
  const restart = harness({ storage: h.storage, rows: h.rows });
  const result = await restart.c.saveSurveyRequest(request);
  assert.equal(result.status, 'saved'); assert.equal(restart.writes.length, 0);
  assert.equal(result.properties[0].monthly_base_rent, 1111); assert.equal(result.properties[0].client_feedback, 'Updated after save');
  assert.equal(restart.storage.size, 0);
});

test('partial readback stays locked; zero readback retries exact stable IDs', async () => {
  const request = makeRequest([row(1), row(2)]); const partial = harness();
  partial.rows.set(id(1), row(1));
  assert.equal((await partial.c.saveSurveyRequest(request)).status, 'partial');
  assert.equal(partial.writes.length, 0); assert.ok(partial.pending());
  await assert.rejects(partial.c.abandonSurveyPending(surveyId), /Some spaces/);
  const none = harness(); none.skipCommit = true;
  assert.equal((await none.c.saveSurveyRequest(request)).status, 'none');
  assert.ok(none.pending());
  await assert.rejects(none.c.abandonSurveyPending(surveyId), /may still finish/);
  assert.ok(none.pending()); none.skipCommit = false;
  assert.equal((await none.c.saveSurveyRequest(request)).status, 'saved');
  assert.deepEqual(none.writes[0].rows, none.writes[1].rows); assert.equal(none.rows.size, 2);
});

test('failed preflight is not empty, and storage/auth failures cause no speculative write', async () => {
  const h = harness(); h.lookupFailure = true;
  await assert.rejects(h.c.saveSurveyRequest(makeRequest()), /Lookup unavailable/);
  assert.equal(h.writes.length, 0); assert.equal(h.storage.size, 0);
  for (const failure of ['get', 'set']) {
    const storage = harness(); storage.storageFailure = failure;
    await assert.rejects(storage.c.saveSurveyRequest(makeRequest()), /Storage unavailable/);
    assert.equal(storage.writes.length, 0);
  }
  const auth = harness(); auth.authFailure = true;
  await assert.rejects(auth.c.saveSurveyRequest(makeRequest()), /Session expired/); assert.equal(auth.writes.length, 0);
  const other = harness({ accountId: id(9) });
  await assert.rejects(other.c.saveSurveyRequest(makeRequest()), /same account/); assert.equal(other.writes.length, 0);
});

test('a changed request cannot bypass a pending uncertain outcome', async () => {
  const h = harness(); const request = makeRequest(); h.skipCommit = true;
  await h.c.saveSurveyRequest(request);
  await assert.rejects(h.c.saveSurveyRequest(makeRequest([row(2)])), /pending/);
  assert.deepEqual(h.pending().request, request); assert.equal(h.writes.length, 1);
});

test('duplicate labels and one invalid draft reject entire batch before writes', async () => {
  const h = harness(); h.rows.set(id(3), { ...row(3), suite_number: 'Suite 1' });
  await assert.rejects(h.c.saveSurveyRequest(makeRequest()), /already exists/);
  assert.equal(h.writes.length, 0); assert.equal(h.storage.size, 0);
  const bad = makeRequest([row(1), { ...row(2), building_sf: '1.2M' }]);
  await assert.rejects(h.c.saveSurveyRequest(bad), /number/); assert.equal(h.writes.length, 0);
});

test('worker rejects arbitrary Survey columns and vote writes even when request helpers are bypassed', async () => {
  const h = harness(); const baseline = { ...row(), updated_at: '2026-09-18T12:00:00Z', is_featured: true, client_feedback: 'Keep', client_killed: true };
  h.rows.set(baseline.id, json(baseline));
  for (const field of ['property_name', 'unknown_column', 'client_feedback', 'client_killed', 'is_featured']) {
    const insert = makeRequest([row(2)]); insert.rows[0][field] = null;
    await assert.rejects(h.c.saveSurveyRequest(insert), error => error.saveRejected === true && error.message.includes(field));
    const update = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
    update.patch[field] = null;
    await assert.rejects(h.c.saveSurveyRequest(update), error => error.saveRejected === true && error.message.includes(field));
  }
  assert.equal(h.writes.length, 0); assert.equal(h.storage.size, 0); assert.deepEqual(h.rows.get(baseline.id), baseline);
});

test('update preserves exact target, rejects stale baseline and guards a race during dispatch', async () => {
  const baseline = { ...row(1), updated_at: '2026-09-18T12:00:00Z', client_feedback: 'Keep' };
  const request = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
  const stale = harness(); stale.rows.set(id(1), { ...baseline, monthly_base_rent: 9999, updated_at: 'newer' });
  const staleResult = await stale.c.saveSurveyRequest(request);
  assert.equal(staleResult.status, 'changed'); assert.equal(stale.writes.length, 0); assert.equal(staleResult.current.monthly_base_rent, 9999);
  const race = harness(); race.rows.set(id(1), baseline);
  race.beforeWrite = () => race.rows.set(id(1), { ...baseline, updated_at: 'concurrent-web-edit', monthly_base_rent: 9999 });
  assert.equal((await race.c.saveSurveyRequest(request)).status, 'changed');
  assert.equal(race.rows.get(id(1)).notes, null); assert.equal(race.rows.get(id(1)).monthly_base_rent, 9999);
  const ok = harness(); ok.rows.set(id(1), baseline); ok.rows.set(id(2), row(2));
  assert.equal((await ok.c.saveSurveyRequest(request)).status, 'saved');
  assert.equal(ok.rows.get(id(1)).client_feedback, 'Keep'); assert.equal(ok.rows.get(id(2)).notes, null);
});

test('lost update response verifies current values; changed values never replay old patch', async () => {
  const baseline = { ...row(1), updated_at: '2026-09-18T12:00:00Z' };
  const request = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
  const h = harness(); h.rows.set(id(1), baseline); h.lostResponse = true;
  h.afterCommit = () => { h.readFailures = 1; };
  await assert.rejects(h.c.saveSurveyRequest(request), /Readback/);
  h.rows.set(id(1), { ...h.rows.get(id(1)), notes: 'Changed in web later' });
  const restarted = harness({ storage: h.storage, rows: h.rows });
  assert.equal((await restarted.c.saveSurveyRequest(request)).status, 'changed'); assert.equal(restarted.writes.length, 0);
  assert.equal(restarted.rows.get(id(1)).notes, 'Changed in web later');
});

test('a dispatched empty readback cannot abandon an older request that may still commit', async () => {
  const h = harness(); const request = makeRequest(); h.skipCommit = true; h.lostResponse = true;
  await assert.rejects(h.c.saveSurveyRequest(request), /Response lost/);
  const restart = harness({ storage: h.storage, rows: h.rows });
  const recovered = await restart.c.recoverSurveySave(surveyId);
  assert.equal(recovered.status, 'none'); assert.equal(recovered.pending.phase, 'dispatched');
  await assert.rejects(restart.c.abandonSurveyPending(surveyId), error => error.pending?.phase === 'dispatched');
  h.rows.set(id(1), { ...request.rows[0], updated_at: 'late-commit', client_feedback: 'Preserve later feedback' });
  const saved = await restart.c.recoverSurveySave(surveyId);
  assert.equal(saved.status, 'saved'); assert.equal(saved.properties[0].client_feedback, 'Preserve later feedback');
  assert.equal(restart.writes.length, 0); assert.equal(restart.storage.size, 0);
});

test('prepared requests may be abandoned; dispatched updates require a superseded CAS timestamp', async () => {
  const baseline = { ...row(), updated_at: '2026-09-18T12:00:00Z' };
  const request = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
  const key = `survey_pending_v1:${accountId}:${surveyId}`;
  const prepared = harness(); prepared.rows.set(id(1), baseline); prepared.storage.set(key, { request, phase: 'prepared' });
  assert.equal((await prepared.c.abandonSurveyPending(surveyId)).pending, null);
  const uncertain = harness(); uncertain.rows.set(id(1), { ...baseline, notes: 'Changed without timestamp' }); uncertain.storage.set(key, { request, phase: 'dispatched' });
  assert.equal((await uncertain.c.recoverSurveySave(surveyId)).canReviewCurrent, false);
  await assert.rejects(uncertain.c.abandonSurveyPending(surveyId), /may still finish/);
  uncertain.rows.set(id(1), { ...baseline, notes: 'Newer web edit', updated_at: '2026-09-18T14:00:00Z' });
  assert.equal((await uncertain.c.recoverSurveySave(surveyId)).canReviewCurrent, true);
  assert.equal((await uncertain.c.abandonSurveyPending(surveyId)).pending, null);
  assert.equal(uncertain.rows.get(id(1)).notes, 'Newer web edit'); assert.equal(uncertain.writes.length, 0);
});

for (const kind of ['insert', 'update']) {
  test(`actual first-dispatch database rejection unlocks ${kind} without relying on later readback`, async () => {
    const h = harness(); const baseline = { ...row(), updated_at: '2026-09-18T12:00:00Z' };
    const request = kind === 'insert' ? makeRequest() : S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
    if (kind === 'update') h.rows.set(id(1), baseline);
    restoreRealTransport(h, kind === 'insert' ? 'sbInsertSurveyBatch' : 'sbUpdateSurveyScoped');
    h.c.sbFetch = async () => {
      h.readFailures = 1; // This later lookup must not replace proof of rejection.
      return { ok: false, status: 400, json: async () => ({ code: '23514', message: 'Fixture constraint rejection' }) };
    };
    await assert.rejects(h.c.saveSurveyRequest(request), error => error.saveRejected === true && error.pending === null && /constraint/.test(error.message));
    assert.equal(h.storage.size, 0); assert.equal(h.readFailures, 1);
    if (kind === 'update') assert.deepEqual(h.rows.get(id(1)), baseline);
  });
}

test('a rejection on a retry cannot unlock an earlier ambiguous dispatch', async () => {
  const h = harness(); h.skipCommit = true; const request = makeRequest();
  await h.c.saveSurveyRequest(request);
  restoreRealTransport(h, 'sbInsertSurveyBatch');
  h.c.sbFetch = async () => ({ ok: false, status: 409, json: async () => ({ code: '23505', message: 'Fixture retry rejection' }) });
  await assert.rejects(h.c.saveSurveyRequest(request), error => error.saveRejected === false && error.pending?.phase === 'dispatched');
  await assert.rejects(h.c.abandonSurveyPending(surveyId), /may still finish/); assert.ok(h.pending());
});

test('readback authentication failure never becomes evidence that the dispatched write was rejected', async () => {
  const h = harness(); const request = makeRequest();
  h.afterCommit = () => { h.c.sbReadSurveyIds = async () => { throw h.c.authError('Session expired after dispatch'); }; };
  await assert.rejects(h.c.saveSurveyRequest(request), error => error.code === 'AUTH_REQUIRED' && error.saveRejected === false && error.pending?.phase === 'dispatched');
  assert.equal(h.rows.size, 1); assert.ok(h.pending());
  h.authFailure = true;
  const response = await new Promise(resolve => h.listener({ type: 'SAVE_SURVEY_BATCH', request }, {}, resolve));
  assert.equal(response.authRequired, true); assert.equal(response.saveRejected, false); assert.ok(h.pending());
});

test('durable rejection survives cleanup failure and cannot leak its proof into another ambiguous dispatch', async () => {
  const h = harness(); const request = makeRequest(); restoreRealTransport(h, 'sbInsertSurveyBatch');
  h.storageFailure = 'remove';
  h.c.sbFetch = async () => ({ ok: false, status: 400, json: async () => ({ code: '23514', message: 'Fixture rejection' }) });
  await assert.rejects(h.c.saveSurveyRequest(request), error => error.saveRejected === true && error.pending?.phase === 'rejected');
  assert.equal(h.pending().saveRejected, true);
  h.storageFailure = null;
  h.c.sbInsertSurveyBatch = async () => { throw new Error('Lost response'); };
  await assert.rejects(h.c.saveSurveyRequest(request), error => error.saveRejected === false && error.pending?.phase === 'dispatched');
  assert.equal(h.pending().saveRejected, undefined);
  await assert.rejects(h.c.abandonSurveyPending(surveyId), /may still finish/);
});

test('only actual database rejection responses are classified definitive; gateway/network failures stay ambiguous', async () => {
  const h = harness(); restoreRealTransport(h, 'sbInsertSurveyBatch');
  for (const response of [
    { ok: false, status: 503, json: async () => ({ code: 'PGRST001', message: 'Gateway unavailable' }) },
    { ok: false, status: 408, json: async () => ({ code: 'PGRST001', message: 'Timeout' }) },
    { ok: false, status: 403, json: async () => ({ message: 'Proxy refused' }) },
  ]) {
    h.c.sbFetch = async () => response;
    await assert.rejects(h.c.sbInsertSurveyBatch([row()]), error => error.saveRejected !== true && error.surveyWriteRejected !== true);
  }
  h.c.sbFetch = async () => { throw new Error('Network lost'); };
  await assert.rejects(h.c.sbInsertSurveyBatch([row()]), error => error.saveRejected !== true);
});

test('real REST transport uses atomic ignore duplicates and survey/updated_at scoped predicates', async () => {
  const calls = []; const c = vm.createContext({ encodeURIComponent });
  vm.runInContext(fs.readFileSync(path.join(root, 'supabase.js'), 'utf8'), c);
  c.sbFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: init?.method === 'POST' ? 204 : 200, json: async () => [] }; };
  await c.sbInsertSurveyBatch([row(1), { ...row(2), notes_2: 'Client note two' }]);
  const insertQuery = new URLSearchParams(calls[0].url.split('?')[1]);
  assert.equal(insertQuery.get('on_conflict'), 'id'); assert.ok(insertQuery.get('columns').includes('"notes_2"'));
  assert.equal(calls[0].init.headers.Prefer, 'resolution=ignore-duplicates,missing=default,return=minimal');
  assert.equal(Object.hasOwn(JSON.parse(calls[0].init.body)[0], 'notes_2'), false, 'missing fields remain missing, not null');
  assert.equal(JSON.parse(calls[0].init.body).length, 2);
  await c.sbReadSurveyIds(surveyId, [id(1), id(2)]);
  const readQuery = new URLSearchParams(calls[1].url.split('?')[1]);
  assert.equal(readQuery.get('survey_id'), `eq.${surveyId}`); assert.equal(readQuery.get('id'), `in.(${id(1)},${id(2)})`);
  await c.sbUpdateSurveyScoped(surveyId, id(1), '2026-09-18T12:00:00Z', { notes: 'Reviewed' });
  const patchQuery = new URLSearchParams(calls[2].url.split('?')[1]);
  assert.equal(patchQuery.get('survey_id'), `eq.${surveyId}`); assert.equal(patchQuery.get('id'), `eq.${id(1)}`);
  assert.equal(patchQuery.get('updated_at'), 'eq.2026-09-18T12:00:00Z'); assert.equal(calls[2].init.method, 'PATCH');
});

test('only reviewed request routes can write Survey rows; Comp save RPC stays intact', () => {
  const src = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  assert.equal(/case "(?:INSERT_PROPERTY|UPDATE_PROPERTY)":/.test(src), false);
  assert.equal(/sb(?:Insert|Update)\("survey_properties"/.test(src), false);
  assert.ok(src.includes('case "SAVE_COMP":')); assert.ok(src.includes('sbRpc("save_comp_with_property", request)'));
});

test('complete preflight pagination honors server row caps and refuses unverified totals', async () => {
  const calls = []; const c = vm.createContext({ encodeURIComponent });
  vm.runInContext(fs.readFileSync(path.join(root, 'supabase.js'), 'utf8'), c);
  c.sbFetch = async (url, init) => {
    calls.push({ url, init }); const offset = Number(new URLSearchParams(url.split('?')[1]).get('offset'));
    return { ok: true, status: 200, headers: { get: () => `${offset}-${offset}/3` }, json: async () => [row(offset + 1)] };
  };
  const rows = await c.sbListAllSurveyProperties(surveyId);
  assert.equal(rows.length, 3); assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => Number(new URLSearchParams(call.url.split('?')[1]).get('offset'))), [0, 1, 2]);
  assert.equal(calls[0].init.headers.Prefer, 'count=exact');
  c.sbFetch = async () => ({ ok: true, status: 200, headers: { get: () => '0-0/*' }, json: async () => [row()] });
  await assert.rejects(c.sbListAllSurveyProperties(surveyId), /complete survey list/);
});

test('linked pricing rejects stale independently supplied amounts before dispatch', async () => {
  const h = harness();
  const calculation = { version: 1, rent: { basis: 'sf', amount: 1.4 }, expenses: { basis: 'sf', amount: .25, treatment: 'additional' }, offered_acres: null };
  const priced = { ...row(), rent_calculation: calculation, monthly_base_rent: 7000, lease_rate_psf: 1.4,
    total_monthly_opex: 1250, monthly_opex_psf: .25, total_lease_rate: 8250 };
  const bad = makeRequest([{ ...priced, monthly_base_rent: 56000 }]);
  await assert.rejects(h.c.saveSurveyRequest(bad), /Linked pricing and area/); assert.equal(h.writes.length, 0);
  assert.equal((await h.c.saveSurveyRequest(makeRequest([priced]))).status, 'saved');
});

test('labels appearing during preflight cannot turn partial recovery into a new insert', async () => {
  const h = harness();
  h.c.sbListAllSurveyProperties = async () => [row(1)];
  const result = await h.c.saveSurveyRequest(makeRequest([row(1), row(2)]));
  assert.equal(result.status, 'partial'); assert.equal(h.writes.length, 0); assert.ok(h.pending());
});

test('historical duplicate labels do not block unrelated notes-only updates', async () => {
  const h = harness(); const baseline = { ...row(), updated_at: '2026-09-18T12:00:00Z' };
  h.rows.set(id(1), baseline); h.rows.set(id(2), { ...row(2), suite_number: 'Suite 1' });
  const request = S.createUpdateRequest({ accountId, surveyId, id: baseline.id, baseline, patch: { notes: 'Reviewed' } });
  assert.equal((await h.c.saveSurveyRequest(request)).status, 'saved');
});

for (const fixture of [
  { body: 'Rent\n$18/SF/year NNN', period: 'annual', basis: 'sf', amount: '18', ranged: false, gross: false },
  { body: 'Rent\n$1.50/SF/month Gross', period: 'monthly', basis: 'sf', amount: '1.50', ranged: false, gross: true },
  { body: 'Rent\n$3,000/acre/month', period: 'monthly', basis: 'acre', amount: '3,000', ranged: false, gross: false },
  { body: 'Rent\n$1.25 - $1.75/SF/year', period: 'annual', basis: 'sf', amount: '1.25 - $1.75', ranged: true, gross: false },
  { body: '$0.80 /NNN Asking Industrial Rent', period: 'unknown', basis: 'unknown', amount: '0.80', ranged: false, gross: false },
]) {
  test(`CoStar evidence retains source units without adopting or converting: ${fixture.body.replace(/\n/g, ' ')}`, async () => {
    const h = harness();
    h.c.document = { body: { innerText: `100 Fixture Ave\nPhoenix, AZ 85040\n${fixture.body}\nService Type\nNNN\n${'Other rendered information\n'.repeat(50)}` } };
    h.c.chrome.tabs = { query: async () => [{ id: 1, url: 'https://product.costar.com/detail/property/12345', lastAccessed: 1 }] };
    h.c.chrome.scripting = { executeScript: async ({ func }) => [{ result: func() }] };
    const data = await h.c.readCoStar();
    for (const key of ['period', 'basis', 'ranged', 'gross']) assert.equal(data.leaseQuote[key], fixture[key], key);
    assert.equal(data.leaseQuote.amountText, fixture.amount); assert.equal(data.leaseQuote.reviewed, false);
    assert.ok(data.leaseQuote.rawText.includes(fixture.body)); assert.ok(data.leaseQuote.rawText.length < 500);
    assert.equal(data.leaseQuote.sourceUrl, 'https://product.costar.com/detail/property/12345');
    if (fixture.amount === '0.80') assert.equal(data.leaseRate, '0.80', 'existing Comp field remains compatible');
  });
}
