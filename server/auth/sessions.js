// Server-side sessions.
//
// • The cookie holds a random 256-bit token and nothing else — no username, no user id, no
//   password material. The database stores only a SHA-256 hash of that token, so a copy of the
//   database can't be used to sign in as anyone.
// • A session belongs to an internal user id. The browser never supplies "who it is"; the server
//   looks it up from the token on every request.
// • A new session (and so a new token) is created at every login — an id planted before login
//   can never become an authenticated one (session fixation).
// • Sessions end after SESSION_IDLE_DAYS without use, and after SESSION_MAX_DAYS no matter what.
//   Using a session pushes back only the idle limit, never the absolute one.
// • The token is rotated once a day. The old one keeps working for a short grace period so a
//   request already in flight from another tab isn't signed out by the rotation.
// • Each session has its own CSRF token for state-changing requests (see guards.js).
const crypto = require("crypto");

const DAY = 24 * 60 * 60 * 1000;

function config(env = process.env) {
  const idleDays = Number(env.SESSION_IDLE_DAYS) > 0 ? Number(env.SESSION_IDLE_DAYS) : 7;
  const maxDays = Number(env.SESSION_MAX_DAYS) > 0 ? Number(env.SESSION_MAX_DAYS) : 30;
  const secure = env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : env.NODE_ENV === "production" || Boolean(env.RENDER);
  return {
    idleMs: idleDays * DAY,
    maxMs: Math.max(maxDays, idleDays) * DAY,
    rotateMs: DAY,
    touchMs: 5 * 60 * 1000,
    graceMs: 60 * 1000,
    secure,
    // "__Host-" makes the browser enforce Secure, Path=/ and no Domain (host-only). It needs
    // HTTPS, so plain-HTTP local development uses the bare name.
    cookieName: secure ? "__Host-h1a" : "h1a",
  };
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readToken(req, cfg) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() !== cfg.cookieName) continue;
    const value = part.slice(i + 1).trim();
    // A real token is 43 base64url characters; anything else can't be one of ours.
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }
  return null;
}

function setCookie(res, token, cfg) {
  const attrs = [`${cfg.cookieName}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(cfg.maxMs / 1000)}`];
  if (cfg.secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

function clearCookie(res, cfg) {
  const attrs = [`${cfg.cookieName}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (cfg.secure) attrs.push("Secure");
  res.append("Set-Cookie", attrs.join("; "));
}

async function createSession(db, userId, req, cfg) {
  const token = newToken();
  const csrf = crypto.randomBytes(24).toString("base64url");
  const now = Date.now();
  await db.query(
    `INSERT INTO h1_sessions (token_hash, user_id, csrf_token, created_at, last_seen_at, idle_expires_at, absolute_expires_at, rotated_at, user_agent)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $4, $7)`,
    [hashToken(token), userId, csrf, now, now + cfg.idleMs, now + cfg.maxMs, String(req.headers["user-agent"] || "").slice(0, 200)]
  );
  return { token, csrf };
}

// Looks up the session for this request. Returns { session, user } or null. An expired session
// is deleted, and `expired` is reported so the client can say "your session expired" rather
// than a generic signed-out state.
async function loadSession(db, req, cfg) {
  const token = readToken(req, cfg);
  if (!token) return { session: null, user: null, expired: false, token: null };
  const tokenHash = hashToken(token);
  const r = await db.query(
    `SELECT s.token_hash, s.user_id, s.csrf_token, s.created_at, s.last_seen_at, s.idle_expires_at, s.absolute_expires_at, s.rotated_at,
            u.username, u.account_type, u.client_ns, u.created_at AS user_created_at, u.data_revision
       FROM h1_sessions s JOIN h1_users u ON u.id = s.user_id
      WHERE s.token_hash = $1`,
    [tokenHash]
  );
  const row = r.rows[0];
  const now = Date.now();
  if (!row) return { session: null, user: null, expired: true, token };
  if (now >= row.idle_expires_at || now >= row.absolute_expires_at) {
    await db.query("DELETE FROM h1_sessions WHERE token_hash = $1", [tokenHash]);
    return { session: null, user: null, expired: true, token };
  }
  if (now - row.last_seen_at > cfg.touchMs) {
    const idle = Math.min(now + cfg.idleMs, row.absolute_expires_at);
    await db.query("UPDATE h1_sessions SET last_seen_at = $2, idle_expires_at = GREATEST(idle_expires_at, $3) WHERE token_hash = $1", [tokenHash, now, idle]);
  }
  return {
    token,
    expired: false,
    session: { tokenHash, csrf: row.csrf_token, createdAt: row.created_at, rotatedAt: row.rotated_at, absoluteExpiresAt: row.absolute_expires_at },
    user: { id: row.user_id, username: row.username, accountType: row.account_type, clientNs: row.client_ns, createdAt: row.user_created_at, revision: row.data_revision },
  };
}

// Swap the token for a fresh one (same user, same absolute expiry). The old token stays valid
// for a short grace period only. The CSRF token carries over unless `newCsrf` is set, so other
// open H1 tabs — which share the cookie but hold the CSRF token in memory — keep working.
async function rotateSession(db, current, req, res, cfg, { newCsrf = false } = {}) {
  const token = newToken();
  const csrf = newCsrf ? crypto.randomBytes(24).toString("base64url") : current.csrf;
  const now = Date.now();
  await db.transaction(async (tx) => {
    const old = await tx.query("SELECT user_id, created_at, absolute_expires_at FROM h1_sessions WHERE token_hash = $1", [current.tokenHash]);
    if (!old.rows[0]) throw Object.assign(new Error("session vanished during rotation"), { status: 401 });
    const o = old.rows[0];
    await tx.query(
      `INSERT INTO h1_sessions (token_hash, user_id, csrf_token, created_at, last_seen_at, idle_expires_at, absolute_expires_at, rotated_at, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $5, $8)`,
      [hashToken(token), o.user_id, csrf, o.created_at, now, Math.min(now + cfg.idleMs, o.absolute_expires_at), o.absolute_expires_at, String(req.headers["user-agent"] || "").slice(0, 200)]
    );
    await tx.query("UPDATE h1_sessions SET idle_expires_at = LEAST(idle_expires_at, $2) WHERE token_hash = $1", [current.tokenHash, now + cfg.graceMs]);
  });
  setCookie(res, token, cfg);
  return { csrf };
}

async function destroySession(db, tokenHash) {
  await db.query("DELETE FROM h1_sessions WHERE token_hash = $1", [tokenHash]);
}

async function destroyUserSessions(db, userId, exceptTokenHash = null) {
  if (exceptTokenHash) await db.query("DELETE FROM h1_sessions WHERE user_id = $1 AND token_hash <> $2", [userId, exceptTokenHash]);
  else await db.query("DELETE FROM h1_sessions WHERE user_id = $1", [userId]);
}

async function purgeExpired(db) {
  const now = Date.now();
  await db.query("DELETE FROM h1_sessions WHERE idle_expires_at <= $1 OR absolute_expires_at <= $1", [now]);
}

module.exports = {
  config,
  hashToken,
  readToken,
  setCookie,
  clearCookie,
  createSession,
  loadSession,
  rotateSession,
  destroySession,
  destroyUserSessions,
  purgeExpired,
};
