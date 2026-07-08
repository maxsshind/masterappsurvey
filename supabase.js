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
  return new Promise((resolve) =>
    chrome.storage.local.get([SB_SESSION_KEY], (r) => resolve(r[SB_SESSION_KEY] || null))
  );
}
function sbStore(session) {
  return new Promise((resolve) => chrome.storage.local.set({ [SB_SESSION_KEY]: session }, resolve));
}
function sbClear() {
  return new Promise((resolve) => chrome.storage.local.remove([SB_SESSION_KEY], resolve));
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
