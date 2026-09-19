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

async function selectedSpaceFixture(section, separator = '\n') {
  const h = harness();
  h.c.document = { body: { innerText: [
    '6825 W Buckeye Rd', 'Phoenix, AZ 85043', '380,569 SF RBA',
    '$0.99 /NNN Asking Industrial Rent', '$0.62 - 0.75 CoStar Est. Industrial Rent',
    'Other spaces Rent/Mo $90,000 Available 100,000 SF', '1 of 2 Spaces',
    section, 'Documents', 'Another brochure Rent/Mo $999,000',
  ].join(separator) } };
  h.c.chrome.tabs = { query: async () => [{ id: 1, url: 'https://product.costar.com/detail/all-properties/5025345/lease' }] };
  h.c.chrome.scripting = { executeScript: async ({ func }) => [{ result: func() }] };
  return h.c.readCoStar();
}
const spaceDetailsFixture = 'Space Details\nLast updated on September 18, 2026\nReport an error\nAvailable\n40,000 SF Industrial\nFloor\nPartial 1st\nOffice\n3,200 SF\nFloor Contig\n40,000 SF\nBldg Contig\n40,000 SF\nOccupancy\n30 Days\nLease Status\nAvailable\nRent\n$0.65\nRent/Mo\n$26,000\nServices\nTriple Net\nType\nSublet\nTerm\nThru Jan 2027\nTime on Market\n11 Months 23 Days\nDocks\n2 ext\nDrive Ins\n1 tot.';
for (const inline of [false, true]) {
  test(`selected Space Details takes exact monthly rent and size, preserves Comp header (${inline ? 'inline' : 'lines'})`, async () => {
    const data = await selectedSpaceFixture(inline ? spaceDetailsFixture.replaceAll('\n', ' ') : spaceDetailsFixture);
    assert.equal(data.selectedSpace.canPrefill, true);
    for (const [key, expected] of Object.entries({ availableSf: '40000', monthlyRent: '26000', rentPsf: '0.65', officeSf: '3200', floor: 'Partial 1st', serviceType: 'Triple Net', suite: null })) assert.equal(data.selectedSpace[key], expected, key);
    assert.equal(data.leaseRate, '0.99', 'Comp retains original header rate');
    assert.equal(data.leaseQuote.amountText, '26000'); assert.equal(data.leaseQuote.period, 'monthly'); assert.equal(data.leaseQuote.basis, 'total');
    assert.equal(data.leaseQuote.reviewed, false); assert.equal(data.leaseQuote.gross, false);
    assert.ok(!data.selectedSpace.rawText.includes('999,000')); assert.ok(!data.selectedSpace.rawText.includes('0.99'));
  });
}
for (const [label, change] of [
  ['range', s => s.replace('$26,000', '$26,000 - $30,000')],
  ['withheld', s => s.replace('$26,000', 'Upon Request')],
  ['malformed grouping', s => s.replace('$26,000', '$26,00')],
  ['annual rate', s => s.replace('$0.65', '$7.80/SF/year')],
  ['annual total', s => s.replace('Rent/Mo', 'Rent/Year')],
  ['conflicting rate', s => s.replace('$0.65', '$0.75')],
  ['ranged rate', s => s.replace('$0.65', '$0.65 - $0.75')],
  ['duplicate monthly field', s => s + '\nRent/Mo\n$20,000'],
  ['conflicting monthly aliases', s => s + '\nRent/Month\n$20,000'],
  ['multiple Space Details', s => s + '\nSpace Details\nAvailable\n10,000 SF\nRent/Mo\n$5,000'],
]) {
  test(`selected Space Details refuses unsafe prefill: ${label}`, async () => {
    const data = await selectedSpaceFixture(change(spaceDetailsFixture));
    assert.equal(data.selectedSpace.canPrefill, false); assert.equal(data.selectedSpace.monthlyRent, null); assert.ok(data.selectedSpace.issue);
    assert.equal(data.leaseQuote.amountText, ''); assert.equal(data.leaseRate, '0.99');
  });
}
test('selected monthly total remains usable without a size but never invents monthly per-SF', async () => {
  const data = await selectedSpaceFixture(spaceDetailsFixture.replace('Available\n40,000 SF Industrial', 'Available\nWithheld'));
  assert.equal(data.selectedSpace.availableSf, null); assert.equal(data.selectedSpace.monthlyRent, '26000');
  assert.equal(data.selectedSpace.rentPsf, null); assert.equal(data.selectedSpace.canPrefill, true);
});
test('selected offering identity retains suite/floor/size while quote changes do not change identity', async () => {
  const a = await selectedSpaceFixture(spaceDetailsFixture.replace('Floor\nPartial', 'Suite\nA\nFloor\nPartial'));
  const b = await selectedSpaceFixture(spaceDetailsFixture.replace('Floor\nPartial', 'Suite\nA\nFloor\nPartial').replace('$0.65', '$0.75').replace('$26,000', '$30,000'));
  assert.equal(a.selectedSpace.suite, 'A'); assert.equal(a.selectedSpace.identity, b.selectedSpace.identity);
});

test('Curry Road Yard 3 and Suite 7 screenshots parse as separate offerings at one property', async () => {
  const yard = await selectedSpaceFixture('Space Details\nAvailable\n1,310 SF Flex\nSuite\nYard 3\nFloor\nPartial 1st\nFloor Contig\n1,310 SF\nBldg Contig\n1,310 SF\nRent\n$2.79\nRent/Mo\n$3,652\nServices\nModified Gross\nSpace Notes\nThis is yard space consisting of a chain link fence and one gate for access. It is 1,310SF and renting for $470 monthly.');
  const suite = await selectedSpaceFixture('Space Details\nAvailable\n1,200 SF Industrial\nSuite\n7\nFloor\nPartial 1st\nOffice\n100 SF\nFloor Contig\n1,200 SF\nBldg Contig\n1,200 SF\nRent\n$1.40\nRent/Mo\n$1,680\nServices\nModified Gross\nSpace Notes\nUnit has a new BREEZ evaporative cooler for the warehouse.');
  assert.equal(yard.selectedSpace.suite,'Yard 3');assert.equal(yard.selectedSpace.availableSf,'1310');
  assert.equal(suite.selectedSpace.suite,'7');assert.equal(suite.selectedSpace.availableSf,'1200');assert.equal(suite.selectedSpace.officeSf,'100');
  assert.equal(suite.selectedSpace.monthlyRent,'1680');assert.equal(suite.selectedSpace.canPrefill,true);
  assert.notEqual(suite.selectedSpace.identity,yard.selectedSpace.identity);
});

for (const monthly of ['26000', '0']) {
  test(`actual selected-space scrape -> panel draft -> writable Survey row keeps correct area and monthly total (${monthly})`, async () => {
    const body = monthly === '0' ? spaceDetailsFixture.replace('$26,000', '$0').replace('$0.65', '$0') : spaceDetailsFixture;
    const scraped = await selectedSpaceFixture(body);
    const h = harness();
    h.c.state = { survey: { id: surveyId, survey_type: 'lease' } };
    const panel = fs.readFileSync(path.join(root, 'panel.js'), 'utf8');
    for (const name of ['surveyReviewSource', 'surveySpaceLeaseType', 'scrapeInternalNotes', 'recordFromScrape', 'applyNnnExpenseDefault', 'makeSurveyDraft']) {
      const fn = panel.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
      assert.ok(fn, `actual packaged panel function ${name} exists`);
      vm.runInContext(fn[0], h.c, { filename: `panel.js:${name}` });
    }
    const record = h.c.recordFromScrape(scraped);
    const draft = h.c.makeSurveyDraft(record, true, scraped);
    assert.equal(draft.model.values.tenancy, null, 'scrape does not invent tenancy');
    assert.equal(Number(draft.model.values.building_sf), 380569, 'whole building stays separate');
    assert.equal(Number(draft.model.values.suite_size), 40000);
    assert.equal(Number(draft.model.values.office_sf), 3200);
    assert.equal(draft.prefilledMonthlyRent, monthly);
    assert.equal(h.c.SurveyFields.serializeDraft(draft.model).values.monthly_base_rent, Number(monthly));
    draft.model.values.tenancy = 'MT';
    draft.model.values.suite_number = 'Reviewed space 1';
    const result = h.c.SurveyFields.serializeDraft(draft.model);
    assert.equal(result.valid, true, JSON.stringify(result.issues));
    assert.equal(result.values.monthly_base_rent, Number(monthly));
    assert.equal(result.values.lease_rate_psf, monthly === '0' ? 0 : 0.65);
    assert.equal(result.values.total_monthly_opex, null);
    assert.equal(result.values.monthly_opex_psf, null);
    assert.equal(result.values.rent_calculation.expenses.treatment, 'additional');
    assert.equal(result.values.total_lease_rate, null);
    assert.ok(scraped.selectedSpace.rawText.length <= 500);
  });
}

for (const inline of [false, true]) {
  test(`explicit selected-space range transfers to metadata, retains advertising and leaves allocation/pricing blank (${inline ? 'inline' : 'lines'})`, async () => {
    let text = spaceDetailsFixture.replace('Available\n40,000 SF Industrial', 'Available\n62,784 - 174,769 SF Industrial (Will Divide)').replace('Floor\nPartial', 'Suite\n1\nFloor\nPartial');
    if (inline) text=text.replaceAll('\n',' ');
    const scraped=await selectedSpaceFixture(text);
    assert.deepEqual(json(scraped.selectedSpace.availableRange),{min:'62784',max:'174769'});
    assert.equal(scraped.selectedSpace.canPrefill,false);assert.equal(scraped.selectedSpace.availableSf,null);
    const h=harness();h.c.state={survey:{id:surveyId,survey_type:'lease'}};
    const panel=fs.readFileSync(path.join(root,'panel.js'),'utf8');
    for(const name of ['surveyReviewSource','surveySpaceLeaseType','scrapeInternalNotes','recordFromScrape','applyNnnExpenseDefault','makeSurveyDraft']) vm.runInContext(panel.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'))[0],h.c);
    const record=h.c.recordFromScrape(scraped),draft=h.c.makeSurveyDraft(record,true,scraped);
    assert.equal(record.suite_size,'62,784–174,769 SF');assert.equal(record.suite_number,'1');
    assert.equal(record.space_option.proposed,'');assert.equal(record.office_sf,null);
    assert.equal(draft.model.rentDraft.rent.amount,'');assert.equal(record.loading,undefined);
    assert.ok(record.internal_notes.includes('3,200 SF'),'source allocation is retained only as private source evidence');
    const result=h.c.SurveyFields.serializeDraft(draft.model);assert.equal(result.valid,true,JSON.stringify(result.issues));
    const req=S.createBatchRequest({accountId,surveyId,rows:[json(result.values)]});
    const saved=await h.c.saveSurveyRequest(req);assert.equal(saved.status,'saved');
    assert.equal(h.writes[0].rows[0].space_option.min,'62784');assert.equal(h.writes[0].rows[0].space_option.proposed,'');
  });
}
test('property summary smallest-to-total availability cannot become a divisible suite', async () => {
  const data=await selectedSpaceFixture('Available SF\n21,600 - 64,800\nMax Contig SF\n43,200');
  assert.equal(data.selectedSpace,null);
});
test('each discrete suite keeps exact size without inferred member links from contiguous SF', async () => {
  for(const suite of ['1','3','4']) {
    const text=spaceDetailsFixture.replace('Available\n40,000 SF Industrial','Available\n21,600 SF Industrial').replace('Floor\nPartial',`Suite\n${suite}\nFloor\nPartial`).replaceAll('40,000 SF','43,200 SF');
    const data=await selectedSpaceFixture(text);assert.equal(data.selectedSpace.availableSf,'21600');assert.equal(data.selectedSpace.availableRange,null);assert.equal(data.selectedSpace.suite,suite);
  }
});

for (const kind of ['active','pinned','ambiguous','closed']) {
  test(`Survey source tab selection is explicit and safe: ${kind}`,async()=>{
    const h=harness(); let selected;
    const a={id:10,url:'https://product.costar.com/detail/all-properties/231512/summary'};
    const b={id:11,url:'https://product.costar.com/detail/all-properties/333333/summary'};
    h.c.chrome.tabs={query:async q=>q.url?[a,b]:kind==='active'?[b]:[{id:12,url:'chrome-extension://fixture/panel.html'}],get:async id=>{if(kind==='closed')throw new Error('Closed');return a;}};
    h.c.chrome.scripting={executeScript:async options=>{selected=options.target.tabId;return[{result:{street:'Fixture'}}];}};
    if(kind==='ambiguous')await assert.rejects(h.c.readCoStar({survey:true}),/More than one CoStar tab/);
    else if(kind==='closed')await assert.rejects(h.c.readCoStar({survey:true,tabId:10}),/source CoStar tab is closed/);
    else {const data=await h.c.readCoStar({survey:true,tabId:10});assert.equal(selected,kind==='active'?11:10);assert.equal(data.sourceTabId,selected);}
  });
}
test('Comp intake retains legacy most-recent-tab fallback independently of Survey source rules',async()=>{
  const h=harness();let selected;
  h.c.chrome.tabs={query:async q=>q.url?[{id:10,url:'https://product.costar.com/detail/all-properties/11111/summary',lastAccessed:1},{id:11,url:'https://product.costar.com/detail/all-properties/22222/summary',lastAccessed:2}]:[]};
  h.c.chrome.scripting={executeScript:async options=>{selected=options.target.tabId;return[{result:{}}];}};
  await h.c.readCoStar();assert.equal(selected,11);
});

async function salesListingFixture(text, section='summary') {
 const h=harness();h.c.document={body:{innerText:text}};
 h.c.chrome.tabs={query:async()=>[{id:1,url:`https://product.costar.com/listings/for-sale/detail/zqev8pz/${section}`}]};
 h.c.chrome.scripting={executeScript:async({func,args})=>[{result:func(...args)}]};
 return h.c.readCoStar();
}
const salesHeader='2405 W Geneva Dr\n17,236 SF\n•\nFor Sale\n•\nIndustrial Property\n•\nTempe Southwest Submarket\n•\nTempe, AZ 85282\n';
for(const [view,body] of [
 ['summary','Listing Details\nAvailable Size\n17,236 SF\nAsking Price\n$4,309,000\nPrice/SF\n$250.00\nSale Type\nOwner User\nStatus\nActive\nBuilding Details\nBuilding Size\n17,236 SF'],
 ['property','Property\nBuilding\nRBA\n17,236 SF\nLand Acres\n1.20 AC\nLocation\nSubmarket\nTempe Southwest\nSubmarket Cluster\nSoutheast\nAvailabilities\nFor Sale\nPrice\nIndividual Property ･ $4,309,000 ($250.00/SF)\nSale Type\nOwner User\nStatus\nActive\nTransaction History\nSold Price\n$575,000 ($33.36/SF)']
]) for(const inline of [false,true])test(`Sales ${view} ${inline?'inline':'lines'} captures asking and submarket, never historical sale`,async()=>{
 const data=await salesListingFixture(salesHeader+(inline?body.replaceAll('\n',' '):body),view);
 assert.equal(data.salePrice,'4309000');assert.equal(data.submarket,'Tempe Southwest');assert.equal(data.rba,'17236');assert.equal(data.listingId,'for-sale:zqev8pz');assert.equal(data.costarId,'');
});
for(const raw of ['Upon Request','$4,309,000 - $5,000,000','$250/SF','$4,30,900','Portfolio ･ $4,309,000'])test(`Sales asking value ${raw} stays unresolved`,async()=>{
 const data=await salesListingFixture(salesHeader+`Listing Details\nAsking Price\n${raw}\nPrice/SF\n$250.00\nSale Notes\nSold Price\n$575,000`);assert.equal(data.salePrice,'');
});
test('Sales Location-label submarket fallback ignores Submarket Cluster and old prices',async()=>{
 const data=await salesListingFixture('2405 W Geneva Dr\nTempe, AZ 85282\nLocation\nSubmarket\nTempe Southwest\nSubmarket Cluster\nSoutheast\nTransaction History\nSold Price\n$575,000','property');assert.equal(data.submarket,'Tempe Southwest');assert.equal(data.salePrice,'');
});

test('Building fact capture reads labeled measurements/loading without inferring power or rail',async()=>{
 const d=await salesListingFixture('2405 W Geneva Dr\nTempe, AZ 85282\nBuilding\nClear Height\n24\'6"\nOffice SF\n6,600 SF\nClass\nA\nDocks\n10 ext\nTruck Wells\nNone\nDrive Ins\n2 tot.\nPower\n200 amps\nRail Line\nUnion Pacific\nLocation\nSubmarket\nTempe Southwest','property');
 assert.equal(d.propertyFacts.clearHeight,'24\'6"');assert.equal(d.propertyFacts.officeSf,'6,600 SF');assert.equal(d.propertyFacts.classA,'Yes');assert.equal(d.propertyFacts.heavyPower,'');assert.equal(d.propertyFacts.hasRail,'');assert.match(d.propertyFacts.loading,/Docks: 10 ext/);
});
test('Selected suite fact capture never borrows building office or loading totals',async()=>{
 const d=await salesListingFixture('2405 W Geneva Dr\nTempe, AZ 85282\nBuilding\nClear Height\n30 ft\nOffice SF\n6,600 SF\nDocks\n10 ext\nSpace Details\nAvailable\n1,200 SF Industrial\nSuite\n7\nFloor\nPartial 1st\nDocks\nNone\nDrive Ins\n1 tot.\nSpace Notes\nOffice 400 SF historical');
 assert.equal(d.propertyFacts.scope,'selected-space');assert.equal(d.propertyFacts.officeSf,'');assert.equal(d.propertyFacts.clearHeight,'');assert.equal(d.propertyFacts.docks,'None');assert.doesNotMatch(d.propertyFacts.loading,/10 ext/);
});

const universityFacts = `1840 E University Dr
Tempe, AZ 85281
Tempe Southwest Submarket
Building
Type	3 Star Industrial Warehouse
Location	Urban
RBA	31,426 SF
Stories	1
Typical Floor	31,426 SF
Class	B
Year Built	1985
Tenancy	Single
Owner Occupier	Yes
Docks	None
Drive Ins	6 tot.
Elevators	None
Clear Height	17'
Truck Wells	None
Elevators	None
Sprinklers	Wet
Rail Spots	None
CoStar Estimate	$1.14 - 1.39/IG (Industrial)
Property Mix	Industrial ･ 25,141 SF ･ 80.0%Office ･ 6,285 SF ･ 20.0%
Power	600a/277 - 480v 3p
Opportunity Zone	Yes
Availabilities
For Sale
Price	Individual Property ･ $8,000,000 ($254.57/SF)
Sale Type	Investment
Status	Active
Sale Highlights
• ±31,426 SF total: ±21,426 SF warehouse and ±10,000 SF office space.
• 600AMP 277/480V 3-Phase power, 6 drive-ins, sprinklers, up to 17' clear height.
External Links
Offering Memorandum
Transaction History
Sold Price	$5,000,000`;
for(const tabular of [false,true])test(`Sales Property ${tabular?'tabular':'lines'} ignores Property Mix and captures advertised office/height/power`,async()=>{
 const data=await salesListingFixture(tabular?universityFacts:universityFacts.replaceAll('\t','\n'),'property');
 assert.equal(data.propertyFacts.officeSf,'10000');assert.equal(data.propertyFacts.officeSource,'Sale highlights');
 assert.equal(data.propertyFacts.clearHeight,"17'");assert.equal(data.propertyFacts.power,'600AMP 277/480V 3-Phase power');
 assert.equal(data.propertyFacts.loading,'Docks: None; Truck wells: None; Drive-ins: 6 tot.');
 assert.equal(data.propertyFacts.heavyPower,'');assert.equal(data.propertyFacts.officeReview,undefined);
});
test('Property Mix alone never fills office; fields following the excluded section still capture',async()=>{
 const d=await salesListingFixture(universityFacts.replace('±10,000 SF office space.','renovated offices.'),'property');
 assert.equal(d.propertyFacts.officeSf,'');assert.equal(d.propertyFacts.power,'600AMP 277/480V 3-Phase power');
});
test('Selected suite cannot borrow advertised whole-building office or power',async()=>{
 const d=await salesListingFixture(universityFacts+'\n2 of 2 Spaces\nSpace Details\nAvailable\n1,200 SF Industrial\nSuite\n7\nFloor\nPartial 1st\nFloor Contig\n1,200 SF\nRent\nWithheld\nDocuments','property');
 assert.equal(d.propertyFacts.officeSf,'');assert.equal(d.propertyFacts.power,'');assert.equal(d.propertyFacts.clearHeight,'');
});
for(const office of ['5,000-10,000 SF office space.','5,000 to 10,000 SF office space.','-10,000 SF office space.','4,50 SF office space.'])test(`Ambiguous/invalid advertised office ${office} stays blank`,async()=>{const d=await salesListingFixture(universityFacts.replace('±10,000 SF office space.',office),'property');assert.equal(d.propertyFacts.officeSf,'');});

for (const section of ['Sale Highlights', 'Sale Notes']) {
 for (const boundary of ['Transaction History', 'Tenants', 'Market Conditions', 'Demographics',
   'Loan & Financials', 'Area', 'Traffic', 'Public Transportation', 'Help with Features',
   'External Links', 'Property Mix', 'Sale Contacts', 'Documents', 'Building Details']) {
  test(`${section} stops before ${boundary} without losing a Building highlight`, async () => {
   const d = await salesListingFixture(salesHeader + `${section}\nBuilding 100% air-conditioned\n${boundary}\nSale\n3\nPrior Sales\nSold Price\n$1,825,000 ($104.08/SF)\nOffice 6,285 SF\nTerms of Use`);
   assert.equal(d[section === 'Sale Highlights' ? 'saleHighlights' : 'saleNotes'],
     `${section === 'Sale Highlights' ? '• ' : ''}Building 100% air-conditioned`);
  });
 }
}
test('marketing sections remain separate and recognize colon and chevron headings', async () => {
 const d = await salesListingFixture(salesHeader + 'Sale Highlights:\nBuilding 100% air-conditioned\nSale Notes >\nRenovated offices with private entrances.\nTransaction History >>\nSale\n3\nPrior Sales');
 assert.equal(d.saleHighlights, '• Building 100% air-conditioned');
 assert.equal(d.saleNotes, 'Renovated offices with private entrances.');
});

const airportFacts = `2330 S Airport Blvd
Chandler, AZ 85286
Building
RBA
13,472 SF
Docks
None
Drive Ins
7 tot.
Levelators
None
Construction
Masonry
Clear Height
14'
Elevators
None
Rail Spots
None
CoStar Estimate
$1.39 - 1.70/IG (Industrial)
Power
800a/120 - 208v 3p Heavy
Utilities
Lighting, Sewer, Water
Pedestrian Friendly
30 - Somewhat friendly
Cycling Friendly
60 - Moderately friendly
Car Friendly
100 - Exceptionally friendly
Transit Friendly
0 - Not friendly
Parking Spaces
Surface · Available
Amenities
Air Conditioning
`;
for(const inline of [false,true])test(`Airport power fallback excludes neighboring facts; Loading omits levelators (${inline?'inline':'lines'})`,async()=>{
 const d=await salesListingFixture(inline?airportFacts.replace(/\n(?!Building|Amenities)/g,'\t').replace('Building\t','Building\n'):airportFacts,'property');
 // Building headings use tab/line delimiters; the same field boundaries work in both.
 assert.equal(d.propertyFacts.power,'');
 assert.equal(d.propertyFacts.powerFallback,'800a/120 - 208v 3p Heavy');
 assert.equal(d.propertyFacts.loading,'Docks: None; Drive-ins: 7 tot.');
});
for(const [heading,text,expected] of [
 ['Sale Highlights','600AMP 277/480V 3-Phase power, 6 drive-ins, sprinklers, up to 17\' clear height.','600AMP 277/480V 3-Phase power'],
 ['Sale Notes','3,400 amps, 277/480V, 3-phase. Six loading doors.','3,400 amps, 277/480V, 3-phase'],
 ['Description','Up to 4,000 - 6,000 amps available; 20 parking spaces.','Up to 4,000 - 6,000 amps available'],
 ['Property Description','Heavy power, 800 amps and 2 drive-ins.','Heavy power, 800 amps'],
 ['Listing Description','Power to be verified. Excellent freeway access.','Power to be verified'],
 ['Sale Highlights','600 amps, 277/480 volts, three-phase power and sprinklers.','600 amps, 277/480 volts, three-phase power'],
])test(`Marketing power from ${heading}: ${text}`,async()=>{
 const d=await salesListingFixture(airportFacts+`${heading}\n${text}\nTransaction History\nPower\n9,000 amps`);
 assert.equal(d.propertyFacts.power,expected);assert.equal(d.propertyFacts.powerSource,heading==='Sale Highlights'?'Sale highlights':heading==='Sale Notes'?'Sale notes':heading);
});
test('Highlights take precedence over description and unreliable property power',async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Highlights\n1,000 amps\nDescription\n2,000 amps\nDocuments');
 assert.equal(d.propertyFacts.power,'1,000 amps');assert.equal(d.propertyFacts.powerFallback,'800a/120 - 208v 3p Heavy');
});
test('Unrelated marketing and historical power do not suppress the explicit property choice',async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Highlights\nPowerful location\nSale Notes\nNew offices\nTransaction History\nPower\n9000 amps');
 assert.equal(d.propertyFacts.power,'');assert.equal(d.propertyFacts.powerFallback,'800a/120 - 208v 3p Heavy');
});
test('Selected-space marketing wins and property fallback is limited to the selected suite',async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Highlights\n800 amps\n2 of 2 Spaces\nSpace Details\nAvailable\n1,200 SF Industrial\nSuite\n7\nFloor\nPartial 1st\nPower\n100 amps\nUtilities\nWater\nDocuments\nSpace Notes\n200 amps, 120/208V, three-phase power.\nHighlights\nNew offices\nLeasing Contacts\nPower 500 amps');
 assert.equal(d.propertyFacts.power,'200 amps, 120/208V, three-phase power');assert.equal(d.propertyFacts.powerFallback,'100 amps');assert.equal(d.propertyFacts.powerSource,'Space notes');
});
test('Ambiguous visible suites never receive whole-building power or a fallback',async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Highlights\n800 amps\nSpace Details\nSuite\n1\nSpace Notes\n200 amps\nSpace Details\nSuite\n2\nSpace Notes\n400 amps');
 assert.equal(d.propertyFacts.power,'');assert.equal(d.propertyFacts.powerFallback,'');
});

for(const text of ['Power: 800 amps, not verified.','Power available, subject to utility approval.','120/208V, 400 amps, per suite','480V, 3-phase, 4-wire','Unverified, 800 amps','800 amps; shared between suites'])test(`Power retains scope and qualifications: ${text}`,async()=>{
 const d=await salesListingFixture(airportFacts+'Description\n'+text+'\nDocuments');assert.equal(d.propertyFacts.power,text.replace(/[.]$/,'').replace('; ', ', '));
});

for(const text of ['Power Road frontage with convenient freeway access','Located near Power Road and the Loop 202.','Suite 100A has a private office.'])test(`Location and suite labels are not electrical evidence: ${text}`,async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Highlights\n'+text+'\nDocuments');assert.equal(d.propertyFacts.power,'');assert.equal(d.propertyFacts.powerFallback,'800a/120 - 208v 3p Heavy');
});
for(const tail of ['Includes 4 offices and 20 parking spaces.','Currently occupied by an auto shop.','Shared truck court.'])test(`Unrelated sentences cannot attach themselves to Power: ${tail}`,async()=>{
 const d=await salesListingFixture(airportFacts+'Description\n600 amps. '+tail+'\nDocuments');assert.equal(d.propertyFacts.power,'600 amps');
});

for(const text of ['600 amps, subject to verification by tenant','800 amps, shared with other tenants','Power: 800 amps, not verified by tenant','200 amps, per office','800 amps, shared between offices'])test(`Power qualifiers retain who they apply to: ${text}`,async()=>{
 const d=await salesListingFixture(airportFacts+'Description\n'+text+'. Includes new offices.\nDocuments');assert.equal(d.propertyFacts.power,text);
});

test('Listing analysis receives full sale narratives and exact offered SF from Summary',async()=>{
 const d=await salesListingFixture('Listing Details\nAvailable Size\n26,282 SF\nSale Notes\n26,282 SF Light Distribution Facility\n60% office / 40% warehouse\nOne grade level roll up door (12x14)\nSale Highlights\nFlex building\nMarketing Brochure\nUnrelated text');
 assert.equal(d.offeredSf,'26282');assert.match(d.listingAnalysisText.sale_notes,/60% office/);assert.match(d.listingAnalysisText.sale_highlights,/Flex building/);assert.doesNotMatch(d.listingAnalysisText.sale_notes,/Unrelated/);
});
test('Selected suite analysis excludes underlying sale notes and ranged denominators',async()=>{
 const d=await salesListingFixture(airportFacts+'Sale Notes\n60% office\n2 of 2 Spaces\nSpace Details\nAvailable\n1,200 SF Industrial\nSuite\n7\nFloor\nPartial 1st\nDocuments\nSpace Notes\n100 SF office\nHighlights\nSuite has one dock\nLeasing Contacts');
 assert.equal(d.offeredSf,'1200');assert.match(d.listingAnalysisText.sale_notes,/100 SF office/);assert.doesNotMatch(d.listingAnalysisText.sale_notes,/60%/);assert.match(d.listingAnalysisText.sale_highlights,/one dock/);
 const r=await salesListingFixture('Listing Details\nAvailable Size\n10,000-20,000 SF\nSale Notes\n60% office\nMarketing Brochure');assert.equal(r.offeredSf,null);
});
