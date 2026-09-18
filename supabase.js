/**
 * supabase.js — minimal raw-fetch Supabase client for an MV3 service worker.
 *
 * No supabase-js: its timer-based auto-refresh assumes a long-lived page, but MV3
 * workers suspend after ~30s idle. Instead the session lives in chrome.storage.local
 * and is refreshed LAZILY — checked before every request — which survives suspension.
 *
 * Auth is Supabase email OTP: sendOtp() emails a 6-digit code, verifyOtp() trades it
 * for an access/refresh token pair.
 */

const SB_SESSION_KEY = "sb_session";

function sbGetStored() {
  return sbStorageGet(SB_SESSION_KEY);
}
function sbStore(session) {
  return sbStorageSet(SB_SESSION_KEY, session);
}
function sbClear() {
  return sbStorageRemove(SB_SESSION_KEY);
}

// Callback APIs otherwise swallow storage failures, which is unsafe for pending
// writes. Authentication and Survey persistence both use checked completion.
function sbStorageGet(key) {
  return new Promise((resolve, reject) => chrome.storage.local.get([key], (r) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve(r?.[key] ?? null);
  }));
}
function sbStorageSet(key, value) {
  return new Promise((resolve, reject) => chrome.storage.local.set({ [key]: value }, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}
function sbStorageRemove(key) {
  return new Promise((resolve, reject) => chrome.storage.local.remove([key], () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

function authError(msg) {
  const e = new Error(msg || "Please sign in.");
  e.code = "AUTH_REQUIRED";
  return e;
}

// ─── OTP auth ──────────────────────────────────────────────────────────────────

async function sbSendOtp(email) {
  const resp = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
    // create_user:false — a typo'd email must not create a stray auth user
    // (the app's allowlist lives in middleware, not RLS).
    body: JSON.stringify({ email, create_user: false }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err.msg || err.message || err.error_description || `Could not send code (${resp.status})`;
    throw new Error(/signups not allowed|user not found|otp_disabled/i.test(msg)
      ? "That email isn't a master-app user. Use the email you log into sshteam.app with."
      : msg);
  }
}

function sessionFromTokenResponse(data, email) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    // refresh 2 min early
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: (data.user && data.user.email) || email,
    user_id: data.user ? data.user.id : undefined,
  };
}

async function sbVerifyOtp(email, token) {
  // Try the emailed-OTP type first, then 'recovery' (matches the token_type GoTrue
  // stores for existing-user magic-link/OTP sign-ins).
  let data = null;
  for (const type of ["email", "recovery"]) {
    const resp = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ type, email, token }),
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok && body.access_token) { data = body; break; }
    data = body;
  }
  if (!data || !data.access_token) {
    throw new Error(data.msg || data.message || data.error_description || "Invalid or expired code.");
  }
  const session = sessionFromTokenResponse(data, email);
  await sbStore(session);
  return session;
}

// Fallback when the email rate limit blocks fresh sends: the magic-link URL in the
// email contains a token_hash that /verify accepts directly — no new email needed.
async function sbVerifyLink(link) {
  let tokenHash = "", type = "magiclink";
  try {
    let u = new URL(link.trim());
    // Outlook rewrites links via safelinks.protection.outlook.com?url=<real link>
    if (u.hostname.includes("safelinks.protection.outlook.com")) {
      const inner = u.searchParams.get("url");
      if (inner) u = new URL(inner);
    }
    tokenHash = u.searchParams.get("token") || u.searchParams.get("token_hash") || "";
    type = u.searchParams.get("type") || "magiclink";
  } catch { /* fall through to error below */ }
  if (!tokenHash) throw new Error("That doesn't look like the Log In link from the email — copy the full link address.");
  const resp = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify({ type, token_hash: tokenHash }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    throw new Error(data.msg || data.message || data.error_description ||
      "Link invalid or expired — links die after ~1 hour or once clicked.");
  }
  const session = sessionFromTokenResponse(data, null);
  await sbStore(session);
  return session;
}

// ─── Lazy refresh ──────────────────────────────────────────────────────────────

// Serialize concurrent refreshes: parallel messages must not each burn the
// (single-use) refresh token.
let sbRefreshInFlight = null;

async function sbRefresh(session) {
  if (sbRefreshInFlight) return sbRefreshInFlight;
  sbRefreshInFlight = (async () => {
    const resp = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      await sbClear();
      throw authError("Session expired — please sign in again.");
    }
    const fresh = sessionFromTokenResponse(data, session.email);
    if (!fresh.user_id) fresh.user_id = session.user_id;
    await sbStore(fresh);
    return fresh;
  })();
  try {
    return await sbRefreshInFlight;
  } finally {
    sbRefreshInFlight = null;
  }
}

// Valid session or AUTH_REQUIRED error. forceRefresh is the 401-retry path.
async function sbGetSession(forceRefresh = false) {
  const session = await sbGetStored();
  if (!session || !session.refresh_token) throw authError();
  const now = Math.floor(Date.now() / 1000);
  if (forceRefresh || !session.access_token || session.expires_at - now < 120) {
    return sbRefresh(session);
  }
  return session;
}

// ─── PostgREST ─────────────────────────────────────────────────────────────────

// Authenticated fetch against /rest/v1. On 401, refresh once and retry.
async function sbFetch(path, init = {}) {
  let session = await sbGetSession();
  const doFetch = (tok) =>
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${tok}`,
        ...(init.headers || {}),
      },
    });
  let resp = await doFetch(session.access_token);
  if (resp.status === 401) {
    session = await sbGetSession(true);
    resp = await doFetch(session.access_token);
  }
  return resp;
}

async function sbJson(resp, what) {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`${what} failed: ${err.message || err.hint || resp.statusText}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

async function sbSelect(table, query) {
  return sbJson(await sbFetch(`/${table}?${query}`), `Load ${table}`);
}

// Database functions execute the property decision and deal write in one transaction.
// Validation/authorization errors confirm a rejection. Gateway/server errors and
// lost responses stay retryable with the same ID: the write may have committed.
async function sbRpc(name, args) {
  const resp = await sbFetch(`/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  try {
    return await sbJson(resp, "Save comp");
  } catch (error) {
    if ([400, 401, 403, 404, 405, 409, 422].includes(resp.status)) error.saveRejected = true;
    throw error;
  }
}

async function sbInsert(table, record) {
  const rows = await sbJson(
    await sbFetch(`/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(record),
    }),
    `Insert into ${table}`
  );
  return rows[0];
}

async function sbUpdate(table, id, patch) {
  const rows = await sbJson(
    await sbFetch(`/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    }),
    `Update ${table}`
  );
  return rows && rows[0];
}

// Survey batches intentionally do not use sbInsert's single-row result contract.
// ON CONFLICT DO NOTHING is essential: recovery must preserve later client edits.
async function sbInsertSurveyBatch(rows) {
  // Like postgrest-js bulk upsert, specify the union of columns explicitly so
  // independently drafted rows may omit different fields. Missing is distinct
  // from explicit null and should retain database defaults on new rows.
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].map((column) => `"${column}"`).join(",");
  const response = await sbFetch(`/survey_properties?on_conflict=id&columns=${encodeURIComponent(columns)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,missing=default,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) return sbSurveyWriteJson(response, "Save survey spaces");
  return null; // return=minimal may be an empty 201, not only 204.
}

// Only an actual PostgREST/Postgres rejection response proves this statement did
// not commit. A later GET/auth failure, gateway timeout or lost response does not.
async function sbSurveyWriteJson(response, what) {
  if (response.ok) return sbJson(response, what);
  const detail = await response.json().catch(() => ({}));
  const error = new Error(`${what} failed: ${detail.message || detail.hint || response.statusText}`);
  if ([400, 401, 403, 404, 405, 409, 422].includes(response.status) && /^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(detail.code || "")) {
    error.saveRejected = true;
    error.surveyWriteRejected = true;
  }
  throw error;
}

async function sbReadSurveyIds(surveyId, ids) {
  const query = `select=*&survey_id=eq.${encodeURIComponent(surveyId)}&id=in.(${ids.map(encodeURIComponent).join(",")})`;
  const rows = await sbSelect("survey_properties", query);
  if (!Array.isArray(rows)) throw new Error("Could not verify saved spaces. Keep this pending request and retry verification.");
  return rows;
}

async function sbListAllSurveyProperties(surveyId) {
  const all = [], pageSize = 1000;
  for (let offset = 0; ;) {
    const response = await sbFetch(`/survey_properties?select=*&survey_id=eq.${encodeURIComponent(surveyId)}&order=id.asc&limit=${pageSize}&offset=${offset}`, {
      headers: { Prefer: "count=exact" },
    });
    const rows = await sbJson(response, "Load survey properties");
    if (!Array.isArray(rows)) throw new Error("Could not load this survey. No save was attempted.");
    const count = response.headers?.get("Content-Range")?.match(/\/(\d+)$/);
    if (!count) throw new Error("Could not verify the complete survey list. No save was attempted.");
    const total = Number(count[1]);
    all.push(...rows);
    offset += rows.length; // honor the server's actual row cap, not a presumed one
    if (offset >= total) {
      if (new Set(all.map((row) => row.id)).size !== total) throw new Error("The survey changed while loading. Reload before saving.");
      return all.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    }
    if (!rows.length) throw new Error("The survey changed while loading. Reload before saving.");
  }
}

// updated_at is maintained by the existing database trigger. Check it in the
// PATCH itself so a web edit between preflight and dispatch cannot be overwritten.
async function sbUpdateSurveyScoped(surveyId, id, expectedUpdatedAt, patch) {
  const query = `id=eq.${encodeURIComponent(id)}&survey_id=eq.${encodeURIComponent(surveyId)}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`;
  const rows = await sbSurveyWriteJson(await sbFetch(`/survey_properties?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  }), "Update survey space");
  if (!Array.isArray(rows)) throw new Error("Could not confirm the updated space. Keep this request and verify again.");
  return rows;
}
