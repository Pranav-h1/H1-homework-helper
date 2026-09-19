// H1 accounts: sign-up, sign-in, sessions, and each account's own stored data and files.
//
// The rule every route here follows: WHO the request is from comes only from the session (the
// HttpOnly cookie → server-side session → internal user id). Nothing the browser sends — a
// username, an id, a field in the body, a query parameter — is ever used to decide whose data
// to read or write. Every data query is scoped with `WHERE user_id = <id from the session>`.
const express = require("express");
const crypto = require("crypto");
const { hashPassword, verifyPassword, isValidHash, getDummyHash } = require("./auth/passwords");
const V = require("./auth/validation");
const S = require("./auth/sessions");
const { requireSameSite, checkCsrf } = require("./auth/guards");
const { createLimiter, clientIp } = require("./auth/rateLimit");
const aiUsage = require("./aiUsage");
const modelRegistry = require("./models");
const { PROVIDER_NAMES, isProviderConfigured } = require("./providers");

const DATA_KEY_PATTERN = /^h1-[a-z0-9-]{1,64}$/;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function limits(env = process.env) {
  const mb = (v, d) => (Number(v) > 0 ? Number(v) : d) * 1024 * 1024;
  return {
    dataQuota: mb(env.ACCOUNT_DATA_QUOTA_MB, 50),
    valueMax: 6 * 1024 * 1024,
    maxKeys: 400,
    filesQuota: mb(env.ACCOUNT_FILES_QUOTA_MB, 150),
    fileMax: 10 * 1024 * 1024,
  };
}

const GENERIC_LOGIN_ERROR = "Incorrect username or password.";

function publicUser(u) {
  return { username: u.username, accountType: u.accountType || u.account_type, createdAt: Number(u.createdAt || u.created_at) };
}

// Wraps a handler so an unexpected error becomes a plain message — never a stack trace, SQL or
// driver detail.
function route(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      if (err && err.status && err.expose) {
        return res.status(err.status).json({ error: err.message, code: err.code, field: err.field });
      }
      console.error(`[accounts] ${req.method} ${req.path} failed:`, err && (err.code || err.message));
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong on H1's side. Please try again.", code: "SERVER_ERROR" });
    });
  };
}

function httpError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...extra });
}

function createAccounts({ getDb, env = process.env }) {
  const cfg = S.config(env);
  const lim = limits(env);
  const loginByIp = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
  const loginByUser = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const signupByIp = createLimiter({ windowMs: 60 * 60 * 1000, max: 12 });
  const passwordChecks = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

  // Every account route waits for the database. If there isn't one, it says so plainly.
  async function withDb(req, res, next) {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Accounts aren't available on this H1 server right now.", code: "ACCOUNTS_UNAVAILABLE" });
    req.db = db;
    next();
  }

  function noStore(req, res, next) {
    res.set("Cache-Control", "no-store");
    next();
  }

  // Resolves the signed-in user from the session cookie, or answers 401. This is the only place
  // a request's identity comes from.
  function authed(req, res, next) {
    S.loadSession(req.db, req, cfg).then(
      (found) => {
        if (!found.user) {
          if (found.token) S.clearCookie(res, cfg);
          return res.status(401).json({
            error: found.expired ? "Your session has expired. Please sign in again." : "Please sign in to continue.",
            code: found.expired ? "SESSION_EXPIRED" : "NOT_SIGNED_IN",
          });
        }
        req.auth = found;
        next();
      },
      (err) => {
        console.error("[accounts] session lookup failed:", err && (err.code || err.message));
        res.status(500).json({ error: "Something went wrong on H1's side. Please try again.", code: "SERVER_ERROR" });
      }
    );
  }

  // Applies a guard to everything except plain reads.
  function writesOnly(guard) {
    return (req, res, next) => (req.method === "GET" || req.method === "HEAD" ? next() : guard(req, res, next));
  }

  function csrf(req, res, next) {
    if (!checkCsrf(req, req.auth.session)) {
      return res.status(403).json({ error: "This request couldn't be verified. Reload H1 and try again.", code: "CSRF" });
    }
    next();
  }

  async function startSession(req, res, userRow) {
    // Whatever session this browser had before (another account, or a planted id) ends here.
    const previous = S.readToken(req, cfg);
    if (previous) await S.destroySession(req.db, S.hashToken(previous));
    const { token, csrf: csrfToken } = await S.createSession(req.db, userRow.id, req, cfg);
    S.setCookie(res, token, cfg);
    return csrfToken;
  }

  // ---------------------------------------------------------------------------------------
  // /api/auth
  // ---------------------------------------------------------------------------------------
  const auth = express.Router();
  auth.use(noStore);
  auth.use(express.json({ limit: "16kb" }));

  auth.get(
    "/session",
    route(async (req, res) => {
      const db = await getDb();
      if (!db) return res.json({ accountsAvailable: false, authenticated: false });
      req.db = db;
      const found = await S.loadSession(db, req, cfg);
      if (!found.user) {
        if (found.token) S.clearCookie(res, cfg);
        return res.json({ accountsAvailable: true, authenticated: false, expired: found.expired });
      }
      if (Date.now() - found.session.rotatedAt > cfg.rotateMs) {
        // If another tab rotated this same session a moment ago, keep using it as is.
        await S.rotateSession(db, found.session, req, res, cfg).catch(() => {});
      }
      const csrfToken = found.session.csrf;
      res.json({
        accountsAvailable: true,
        authenticated: true,
        user: publicUser(found.user),
        clientNs: found.user.clientNs,
        csrfToken,
        revision: Number(found.user.revision),
      });
    })
  );

  auth.post(
    "/signup",
    requireSameSite,
    withDb,
    route(async (req, res) => {
      const ip = clientIp(req);
      const wait = signupByIp.blockedFor(ip);
      if (wait) throw httpError(429, `Too many new accounts from this network. Try again in ${Math.ceil(wait / 60)} minutes.`, { code: "RATE_LIMITED" });
      const { username, password, confirmPassword } = req.body || {};
      const uErr = V.checkUsername(username);
      if (uErr) throw httpError(400, uErr, { field: "username", code: "INVALID" });
      if (V.isReserved(username)) throw httpError(409, "That username is already taken.", { field: "username", code: "USERNAME_TAKEN" });
      const pErr = V.checkNewPassword(password, confirmPassword);
      if (pErr) throw httpError(400, pErr, { field: pErr.includes("match") || pErr.includes("again") ? "confirmPassword" : "password", code: "INVALID" });

      signupByIp.hit(ip);
      const now = Date.now();
      const user = {
        id: crypto.randomUUID(),
        username: V.normalizeUsername(username),
        username_key: V.usernameKey(username),
        password_hash: await hashPassword(password),
        client_ns: crypto.randomBytes(12).toString("base64url"),
      };
      try {
        await req.db.query(
          `INSERT INTO h1_users (id, username, username_key, password_hash, account_type, client_ns, data_revision, created_at, updated_at, password_changed_at)
           VALUES ($1, $2, $3, $4, 'standard', $5, 0, $6, $6, $6)`,
          [user.id, user.username, user.username_key, user.password_hash, user.client_ns, now]
        );
      } catch (err) {
        // Two people choosing the same name at the same moment: the unique index decides.
        if (err && err.code === "23505") throw httpError(409, "That username is already taken.", { field: "username", code: "USERNAME_TAKEN" });
        throw err;
      }
      const csrfToken = await startSession(req, res, user);
      res.status(201).json({ user: { username: user.username, accountType: "standard", createdAt: now }, clientNs: user.client_ns, csrfToken, revision: 0 });
    })
  );

  auth.post(
    "/login",
    requireSameSite,
    withDb,
    route(async (req, res) => {
      const { username, password } = req.body || {};
      if (!username || !password || (typeof username === "string" && !username.trim())) {
        throw httpError(400, "Enter your username and password.", { code: "MISSING" });
      }
      const ip = clientIp(req);
      const key = V.usernameKey(typeof username === "string" ? username : "");
      const wait = Math.max(loginByIp.blockedFor(ip), loginByUser.blockedFor(key));
      if (wait) {
        res.set("Retry-After", String(wait));
        throw httpError(429, `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.`, { code: "RATE_LIMITED" });
      }
      let row = null;
      if (V.plausibleLogin(username, password)) {
        const r = await req.db.query(
          "SELECT id, username, password_hash, account_type, client_ns, created_at, data_revision FROM h1_users WHERE username_key = $1",
          [key]
        );
        row = r.rows[0] || null;
      }
      // Same work, same answer, whether or not the account exists.
      const ok = await verifyPassword(typeof password === "string" ? password : "", row ? row.password_hash : await getDummyHash());
      if (!row || !ok) {
        loginByIp.hit(ip);
        loginByUser.hit(key);
        throw httpError(401, GENERIC_LOGIN_ERROR, { code: "BAD_CREDENTIALS" });
      }
      loginByUser.reset(key);
      const csrfToken = await startSession(req, res, row);
      res.json({
        user: { username: row.username, accountType: row.account_type, createdAt: Number(row.created_at) },
        clientNs: row.client_ns,
        csrfToken,
        revision: Number(row.data_revision),
      });
    })
  );

  auth.post(
    "/logout",
    requireSameSite,
    withDb,
    route(async (req, res) => {
      const token = S.readToken(req, cfg);
      if (token) await S.destroySession(req.db, S.hashToken(token));
      S.clearCookie(res, cfg);
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------------------------------
  // /api/account — settings for the signed-in account
  // ---------------------------------------------------------------------------------------
  const account = express.Router();
  account.use(noStore);
  account.use(express.json({ limit: "16kb" }));
  // Reading your own details changes nothing, so a GET needs neither the origin check nor a
  // CSRF token: browsers don't attach an Origin header to same-origin GETs, and they refuse to
  // let another site read the response at all. Both guards apply to everything that writes.
  account.use(writesOnly(requireSameSite), withDb, authed, writesOnly(csrf));

  async function confirmOwnPassword(req, password, field = "password") {
    const limitKey = `pw:${req.auth.user.id}`;
    const wait = passwordChecks.blockedFor(limitKey);
    if (wait) throw httpError(429, `Too many attempts. Try again in ${Math.ceil(wait / 60)} minutes.`, { code: "RATE_LIMITED" });
    const r = await req.db.query("SELECT password_hash FROM h1_users WHERE id = $1", [req.auth.user.id]);
    const ok = r.rows[0] && typeof password === "string" && password.length <= V.PASSWORD_HARD_LIMIT && (await verifyPassword(password, r.rows[0].password_hash));
    if (!ok) {
      passwordChecks.hit(limitKey);
      throw httpError(401, "That password isn't right.", { field, code: "BAD_PASSWORD" });
    }
    passwordChecks.reset(limitKey);
  }

  account.get(
    "/",
    route(async (req, res) => {
      const u = req.auth.user;
      const [data, files, sessions] = await Promise.all([
        req.db.query("SELECT COALESCE(SUM(size_bytes), 0) AS bytes, COUNT(*) AS n FROM h1_user_data WHERE user_id = $1", [u.id]),
        req.db.query("SELECT COALESCE(SUM(size_bytes), 0) AS bytes, COUNT(*) AS n FROM h1_user_files WHERE user_id = $1", [u.id]),
        req.db.query("SELECT COUNT(*) AS n FROM h1_sessions WHERE user_id = $1", [u.id]),
      ]);
      res.json({
        user: publicUser(u),
        usage: {
          dataBytes: Number(data.rows[0].bytes),
          dataQuota: lim.dataQuota,
          fileBytes: Number(files.rows[0].bytes),
          fileQuota: lim.filesQuota,
          files: Number(files.rows[0].n),
        },
        activeSessions: Number(sessions.rows[0].n),
      });
    })
  );

  account.post(
    "/password",
    route(async (req, res) => {
      if (req.auth.user.accountType === "lab") {
        throw httpError(403, "This account's password is set in the server's configuration, so it can't be changed here.", { code: "MANAGED" });
      }
      const { currentPassword, newPassword, confirmPassword } = req.body || {};
      await confirmOwnPassword(req, currentPassword, "currentPassword");
      const pErr = V.checkNewPassword(newPassword, confirmPassword);
      if (pErr) throw httpError(400, pErr, { field: pErr.includes("match") || pErr.includes("again") ? "confirmPassword" : "newPassword", code: "INVALID" });
      const now = Date.now();
      await req.db.query("UPDATE h1_users SET password_hash = $2, password_changed_at = $3, updated_at = $3 WHERE id = $1", [req.auth.user.id, await hashPassword(newPassword), now]);
      // Every other device is signed out; this one gets a fresh session token.
      await S.destroyUserSessions(req.db, req.auth.user.id, req.auth.session.tokenHash);
      const { csrf: csrfToken } = await S.rotateSession(req.db, req.auth.session, req, res, cfg, { newCsrf: true });
      await S.destroySession(req.db, req.auth.session.tokenHash);
      res.json({ ok: true, csrfToken });
    })
  );

  account.post(
    "/verify-password",
    route(async (req, res) => {
      await confirmOwnPassword(req, (req.body || {}).password);
      res.json({ ok: true });
    })
  );

  account.post(
    "/logout-all",
    route(async (req, res) => {
      await S.destroyUserSessions(req.db, req.auth.user.id);
      S.clearCookie(res, cfg);
      res.json({ ok: true });
    })
  );

  account.post(
    "/delete",
    route(async (req, res) => {
      if (req.auth.user.accountType === "lab") throw httpError(403, "The H1 Lab account can't be deleted from inside H1.", { code: "MANAGED" });
      await confirmOwnPassword(req, (req.body || {}).password);
      // Sessions, data and files go with it (ON DELETE CASCADE).
      await req.db.query("DELETE FROM h1_users WHERE id = $1", [req.auth.user.id]);
      S.clearCookie(res, cfg);
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------------------------------
  // /api/data — the account's H1 data, one row per store (notes, conversations, decks, …)
  // ---------------------------------------------------------------------------------------
  const data = express.Router();
  data.use(noStore);
  data.use(express.json({ limit: "16mb" }));
  data.use(withDb, authed);

  data.get(
    "/",
    route(async (req, res) => {
      const [items, rev] = await Promise.all([
        req.db.query("SELECT data_key, value, version FROM h1_user_data WHERE user_id = $1", [req.auth.user.id]),
        req.db.query("SELECT data_revision FROM h1_users WHERE id = $1", [req.auth.user.id]),
      ]);
      const out = {};
      items.rows.forEach((r) => (out[r.data_key] = { value: r.value, version: Number(r.version) }));
      res.json({ revision: Number(rev.rows[0] ? rev.rows[0].data_revision : 0), items: out });
    })
  );

  data.get(
    "/revision",
    route(async (req, res) => {
      const rev = await req.db.query("SELECT data_revision FROM h1_users WHERE id = $1", [req.auth.user.id]);
      res.json({ revision: Number(rev.rows[0] ? rev.rows[0].data_revision : 0) });
    })
  );

  // Save changes. Each change says which version it was based on; if the stored version has
  // moved on (another device saved in between), that change isn't applied and the current
  // value comes back so the client can merge and try again — nothing is silently overwritten.
  data.put(
    "/",
    requireSameSite,
    csrf,
    route(async (req, res) => {
      const changes = Array.isArray((req.body || {}).changes) ? req.body.changes : null;
      if (!changes || changes.length === 0 || changes.length > 200) throw httpError(400, "Nothing valid to save.", { code: "INVALID" });
      for (const c of changes) {
        if (!c || typeof c.key !== "string" || !DATA_KEY_PATTERN.test(c.key)) throw httpError(400, "Invalid data key.", { code: "INVALID" });
        if (c.value !== null && typeof c.value !== "string") throw httpError(400, "Invalid value.", { code: "INVALID" });
        if (typeof c.value === "string" && Buffer.byteLength(c.value) > lim.valueMax) {
          throw httpError(413, "One part of your H1 data is too large to save to your account.", { code: "VALUE_TOO_LARGE", key: c.key });
        }
      }
      const userId = req.auth.user.id;
      const result = await req.db.transaction(async (tx) => {
        // One writer per account at a time; two devices saving at once take turns.
        const lock = await tx.query("SELECT data_revision FROM h1_users WHERE id = $1 FOR UPDATE", [userId]);
        let revision = Number(lock.rows[0].data_revision);
        const existing = await tx.query("SELECT data_key, value, version, size_bytes FROM h1_user_data WHERE user_id = $1", [userId]);
        const current = new Map(existing.rows.map((r) => [r.data_key, r]));
        let total = existing.rows.reduce((n, r) => n + Number(r.size_bytes), 0);
        let keys = current.size;
        const results = [];
        let applied = 0;
        const now = Date.now();
        for (const c of changes) {
          const row = current.get(c.key);
          const version = row ? Number(row.version) : 0;
          const base = Number.isInteger(c.baseVersion) ? c.baseVersion : 0;
          if (base !== version) {
            results.push({ key: c.key, conflict: true, version, value: row ? row.value : null });
            continue;
          }
          if (c.value === null) {
            if (row) {
              await tx.query("DELETE FROM h1_user_data WHERE user_id = $1 AND data_key = $2", [userId, c.key]);
              total -= Number(row.size_bytes);
              keys -= 1;
              current.delete(c.key);
              applied++;
            }
            results.push({ key: c.key, ok: true, version: 0 });
            continue;
          }
          const size = Buffer.byteLength(c.value);
          const newTotal = total - (row ? Number(row.size_bytes) : 0) + size;
          if (newTotal > lim.dataQuota) {
            results.push({ key: c.key, error: "QUOTA", message: "Your account's storage is full." });
            continue;
          }
          if (!row && keys + 1 > lim.maxKeys) {
            results.push({ key: c.key, error: "QUOTA", message: "Too many separate kinds of data." });
            continue;
          }
          await tx.query(
            `INSERT INTO h1_user_data (user_id, data_key, value, version, size_bytes, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, data_key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, size_bytes = EXCLUDED.size_bytes, updated_at = EXCLUDED.updated_at`,
            [userId, c.key, c.value, version + 1, size, now]
          );
          current.set(c.key, { data_key: c.key, value: c.value, version: version + 1, size_bytes: size });
          total = newTotal;
          if (!row) keys += 1;
          applied++;
          results.push({ key: c.key, ok: true, version: version + 1 });
        }
        if (applied) {
          const up = await tx.query("UPDATE h1_users SET data_revision = data_revision + 1, updated_at = $2 WHERE id = $1 RETURNING data_revision", [userId, now]);
          revision = Number(up.rows[0].data_revision);
        }
        return { results, revision };
      });
      res.json(result);
    })
  );

  // ---------------------------------------------------------------------------------------
  // /api/files — attachment contents (photos, documents) for the account's conversations
  // ---------------------------------------------------------------------------------------
  const files = express.Router();
  files.use(noStore);
  files.use(express.json({ limit: "16mb" }));
  files.use(withDb, authed);

  files.get(
    "/usage",
    route(async (req, res) => {
      const r = await req.db.query("SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM h1_user_files WHERE user_id = $1", [req.auth.user.id]);
      res.json({ bytes: Number(r.rows[0].bytes), quota: lim.filesQuota });
    })
  );

  files.get(
    "/:id",
    route(async (req, res) => {
      if (!FILE_ID_PATTERN.test(req.params.id)) throw httpError(400, "Invalid file id.", { code: "INVALID" });
      const r = await req.db.query("SELECT record FROM h1_user_files WHERE user_id = $1 AND file_id = $2", [req.auth.user.id, req.params.id]);
      if (!r.rows[0]) throw httpError(404, "File not found.", { code: "NOT_FOUND" });
      res.type("application/json").send(`{"record":${r.rows[0].record}}`);
    })
  );

  files.put(
    "/:id",
    requireSameSite,
    csrf,
    route(async (req, res) => {
      const id = req.params.id;
      const record = (req.body || {}).record;
      if (!FILE_ID_PATTERN.test(id) || !record || typeof record !== "object" || record.id !== id) throw httpError(400, "Invalid file.", { code: "INVALID" });
      const json = JSON.stringify(record);
      const size = Buffer.byteLength(json);
      if (size > lim.fileMax) throw httpError(413, "That file is too large to keep in your account.", { code: "FILE_TOO_LARGE" });
      const conv = typeof record.conversationId === "string" ? record.conversationId.slice(0, 120) : null;
      await req.db.transaction(async (tx) => {
        await tx.query("SELECT 1 FROM h1_users WHERE id = $1 FOR UPDATE", [req.auth.user.id]);
        const used = await tx.query("SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM h1_user_files WHERE user_id = $1 AND file_id <> $2", [req.auth.user.id, id]);
        if (Number(used.rows[0].bytes) + size > lim.filesQuota) throw httpError(413, "Your account's file storage is full. Delete some old conversations with attachments to make room.", { code: "QUOTA" });
        await tx.query(
          `INSERT INTO h1_user_files (user_id, file_id, conversation_id, record, size_bytes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, file_id) DO UPDATE SET conversation_id = EXCLUDED.conversation_id, record = EXCLUDED.record, size_bytes = EXCLUDED.size_bytes`,
          [req.auth.user.id, id, conv, json, size, Date.now()]
        );
      });
      res.json({ ok: true });
    })
  );

  files.post(
    "/delete",
    requireSameSite,
    csrf,
    route(async (req, res) => {
      const { ids, conversationIds, all } = req.body || {};
      const userId = req.auth.user.id;
      let r;
      if (all === true) {
        r = await req.db.query("DELETE FROM h1_user_files WHERE user_id = $1", [userId]);
      } else if (Array.isArray(conversationIds) && conversationIds.length && conversationIds.length <= 500 && conversationIds.every((c) => typeof c === "string")) {
        r = await req.db.query("DELETE FROM h1_user_files WHERE user_id = $1 AND conversation_id = ANY($2::text[])", [userId, conversationIds]);
      } else if (Array.isArray(ids) && ids.length && ids.length <= 500 && ids.every((i) => typeof i === "string" && FILE_ID_PATTERN.test(i))) {
        r = await req.db.query("DELETE FROM h1_user_files WHERE user_id = $1 AND file_id = ANY($2::text[])", [userId, ids]);
      } else {
        throw httpError(400, "Nothing to delete.", { code: "INVALID" });
      }
      res.json({ ok: true, deleted: r.rowCount });
    })
  );

  files.post(
    "/reassign",
    requireSameSite,
    csrf,
    route(async (req, res) => {
      const { ids, conversationId } = req.body || {};
      if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((i) => typeof i === "string" && FILE_ID_PATTERN.test(i)) || typeof conversationId !== "string") {
        throw httpError(400, "Invalid request.", { code: "INVALID" });
      }
      const userId = req.auth.user.id;
      const conv = conversationId.slice(0, 120);
      await req.db.transaction(async (tx) => {
        const rows = await tx.query("SELECT file_id, record FROM h1_user_files WHERE user_id = $1 AND file_id = ANY($2::text[])", [userId, ids]);
        for (const row of rows.rows) {
          let rec;
          try {
            rec = JSON.parse(row.record);
          } catch {
            continue;
          }
          rec.conversationId = conv;
          await tx.query("UPDATE h1_user_files SET conversation_id = $3, record = $4 WHERE user_id = $1 AND file_id = $2", [userId, row.file_id, conv, JSON.stringify(rec)]);
        }
      });
      res.json({ ok: true });
    })
  );

  // Who a request is from, for code outside these routes (the AI allowance). Returns null for
  // anyone not signed in — it never guesses, and it never reads anything the browser claims.
  async function identify(req) {
    const db = await getDb();
    if (!db) return null;
    try {
      const found = await S.loadSession(db, req, cfg);
      return found.user || null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------------------
  // /api/ai — what the person in front of H1 has left
  // ---------------------------------------------------------------------------------------
  const ai = express.Router();
  ai.use(noStore);

  ai.get(
    "/usage",
    route(async (req, res) => {
      const db = await getDb();
      let user = null;
      if (db) {
        const found = await S.loadSession(db, req, cfg).catch(() => ({ user: null }));
        user = found.user || null;
      }
      const unlimited = Boolean(user && user.accountType === "lab");
      const state = await aiUsage.check(db, { userId: user ? user.id : null, guest: user ? null : aiUsage.guestKey(req), unlimited });
      res.json({
        usage: state.unlimited
          ? { unlimited: true }
          : { unlimited: false, limit: state.limit, used: state.used, remaining: state.remaining, resetsAt: state.resetsAt },
        signedIn: Boolean(user),
      });
    })
  );

  // ---------------------------------------------------------------------------------------
  // /api/creator — H1's own account only
  //
  // Everything here is gated on the account's type as stored in the database, which comes from
  // the session. There is no "creator" flag the browser can send, and no password check in the
  // frontend: an ordinary account calling these gets the same 403 whatever it claims to be.
  // ---------------------------------------------------------------------------------------
  const creator = express.Router();
  creator.use(noStore);
  creator.use(express.json({ limit: "16kb" }));
  creator.use(writesOnly(requireSameSite), withDb, authed);
  creator.use((req, res, next) => {
    if (req.auth.user.accountType !== "lab") {
      return res.status(403).json({ error: "That's not available on this account.", code: "NOT_CREATOR" });
    }
    next();
  });
  creator.use(writesOnly(csrf));

  creator.get(
    "/overview",
    route(async (req, res) => {
      const since = Date.now() - aiUsage.WINDOW_MS;
      const [limit, list, people] = await Promise.all([
        aiUsage.getLimit(req.db),
        modelRegistry.list(req.db),
        req.db.query(
          `SELECT u.username, u.account_type, u.created_at,
                  (SELECT COUNT(*)::int FROM h1_ai_usage a WHERE a.user_id = u.id AND a.created_at > $1) AS used
             FROM h1_users u ORDER BY u.created_at`,
          [since]
        ),
      ]);
      const guests = await req.db.query("SELECT COUNT(DISTINCT guest_key)::int AS devices, COUNT(*)::int AS used FROM h1_ai_usage WHERE guest_key IS NOT NULL AND created_at > $1", [since]);
      res.json({
        limit,
        windowHours: Math.round(aiUsage.WINDOW_MS / 3600000),
        providers: PROVIDER_NAMES.map((name) => ({ name, configured: isProviderConfigured(name) })),
        models: list,
        accounts: people.rows.map((r) => ({
          username: r.username,
          accountType: r.account_type,
          createdAt: Number(r.created_at),
          used: Number(r.used),
        })),
        guests: { devices: Number(guests.rows[0].devices), used: Number(guests.rows[0].used) },
      });
    })
  );

  creator.post(
    "/limit",
    route(async (req, res) => {
      const { limit } = req.body || {};
      if (!Number.isFinite(Number(limit)) || Number(limit) < 0) throw httpError(400, "That isn't a number of messages.", { field: "limit", code: "INVALID" });
      const value = await aiUsage.setLimit(req.db, limit);
      res.json({ limit: value });
    })
  );

  creator.post(
    "/models",
    route(async (req, res) => {
      const { provider, modelId, label } = req.body || {};
      const result = await modelRegistry.add(req.db, { provider, modelId, label });
      if (result.error) throw httpError(400, result.error, { code: "INVALID" });
      res.status(201).json({ id: result.id, models: await modelRegistry.list(req.db) });
    })
  );

  creator.post(
    "/models/active",
    route(async (req, res) => {
      const { id } = req.body || {};
      const result = await modelRegistry.setActive(req.db, id || null);
      if (result.error) throw httpError(400, result.error, { code: "INVALID" });
      res.json({ active: result.active, models: await modelRegistry.list(req.db) });
    })
  );

  creator.post(
    "/models/remove",
    route(async (req, res) => {
      const { id } = req.body || {};
      if (typeof id !== "string" || !id) throw httpError(400, "Which model?", { code: "INVALID" });
      const result = await modelRegistry.remove(req.db, id);
      if (!result.removed) throw httpError(404, "That model isn't on the list.", { code: "NOT_FOUND" });
      res.json({ wasActive: result.wasActive, models: await modelRegistry.list(req.db) });
    })
  );

  function mount(app) {
    app.use("/api/auth", auth);
    app.use("/api/account", account);
    app.use("/api/data", data);
    app.use("/api/files", files);
    app.use("/api/ai", ai);
    app.use("/api/creator", creator);
  }

  return { mount, identify, config: cfg };
}

// H1's own account ("Pranav-H1"). It's created on the server from configuration — never from
// the browser — and is exempt from the sign-up rules. Its password comes only from the
// environment (H1_MASTER_PASSWORD_HASH, or H1_MASTER_PASSWORD which is hashed here) and is
// never written to logs or code.
async function seedMasterAccount(db, env = process.env) {
  let hash = env.H1_MASTER_PASSWORD_HASH || null;
  const plain = env.H1_MASTER_PASSWORD || null;
  if (!hash && !plain) return { seeded: false, reason: "not configured" };
  if (hash && !isValidHash(hash)) {
    console.error("[accounts] H1_MASTER_PASSWORD_HASH isn't a valid H1 password hash; the H1 Lab account was not set up.");
    return { seeded: false, reason: "invalid hash" };
  }
  const key = V.usernameKey(V.MASTER_USERNAME);
  const existing = (await db.query("SELECT id, account_type, password_hash FROM h1_users WHERE username_key = $1", [key])).rows[0];
  if (existing && existing.account_type !== "lab") {
    // Never take over an ordinary account that somehow holds the name.
    console.error("[accounts] The H1 Lab username is held by an ordinary account; it was left untouched.");
    return { seeded: false, reason: "name held by a normal account" };
  }
  const now = Date.now();
  if (!existing) {
    if (!hash) hash = await hashPassword(plain);
    try {
      await db.query(
        `INSERT INTO h1_users (id, username, username_key, password_hash, account_type, client_ns, data_revision, created_at, updated_at, password_changed_at)
         VALUES ($1, $2, $3, $4, 'lab', $5, 0, $6, $6, $6)`,
        [crypto.randomUUID(), V.MASTER_USERNAME, key, hash, crypto.randomBytes(12).toString("base64url"), now]
      );
    } catch (err) {
      if (err && err.code === "23505") return { seeded: false, reason: "created concurrently" };
      throw err;
    }
    return { seeded: true, created: true };
  }
  // Already there: update the password only if the configured one is different, and if so sign
  // out its existing sessions.
  const same = hash ? existing.password_hash === hash : await verifyPassword(plain, existing.password_hash);
  if (!same) {
    const newHash = hash || (await hashPassword(plain));
    await db.query("UPDATE h1_users SET password_hash = $2, password_changed_at = $3, updated_at = $3 WHERE id = $1", [existing.id, newHash, now]);
    await S.destroyUserSessions(db, existing.id);
    return { seeded: true, updated: true };
  }
  return { seeded: true, unchanged: true };
}

module.exports = { createAccounts, seedMasterAccount, DATA_KEY_PATTERN };
