// How much of the AI each person may use, and how much they have left.
//
// Every AI Tutor message costs real money on H1's API key, so each account gets an allowance:
// a number of messages within a rolling window (by default 68 in 24 hours). Rolling, not
// "resets at midnight", because a student working at 11pm shouldn't get a fresh allowance an
// hour later and then nothing the next evening.
//
// Three rules:
//   • The server decides. The browser is told what's left so it can show it, but the count that
//     matters is the one here, taken from rows the server wrote.
//   • The creator's account has no allowance at all — it's the account that pays for the key.
//   • Someone using H1 without an account is limited too, by device rather than by account.
//     Their messages cost exactly the same.
const crypto = require("crypto");

const DEFAULT_LIMIT = 68;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const SETTING_LIMIT = "ai.daily_limit";

// Cached so the limit isn't re-read from the database on every message; the creator changing it
// takes effect within a few seconds.
let cached = { value: null, at: 0 };
const CACHE_MS = 5000;

function envLimit() {
  const n = Number(process.env.AI_MESSAGE_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

async function getLimit(db) {
  if (!db) return envLimit();
  if (cached.value !== null && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const r = await db.query("SELECT value FROM h1_settings WHERE key = $1", [SETTING_LIMIT]);
    const stored = r.rows[0] ? Number(r.rows[0].value) : NaN;
    const value = Number.isFinite(stored) && stored >= 0 ? Math.floor(stored) : envLimit();
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return envLimit();
  }
}

async function setLimit(db, limit) {
  const value = Math.max(0, Math.min(100000, Math.floor(Number(limit) || 0)));
  await db.query(
    `INSERT INTO h1_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [SETTING_LIMIT, String(value), Date.now()]
  );
  cached = { value, at: Date.now() };
  return value;
}

// A stable, non-identifying label for a device that isn't signed in. It's a hash of the address
// with a per-server salt, so the usage table doesn't become a log of who was where.
function guestKey(req, env = process.env) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
  const salt = env.GUEST_KEY_SALT || env.SESSION_SALT || "h1";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// What someone has left. `unlimited` is true for the creator's account, which is never counted.
async function check(db, { userId = null, guest = null, unlimited = false } = {}) {
  const limit = await getLimit(db);
  if (unlimited) return { unlimited: true, limit: null, used: 0, remaining: null, resetsAt: null, allowed: true };
  // With no database there is nowhere to count, and a count that resets whenever the server
  // restarts isn't a limit. H1 says nothing about an allowance rather than showing a number that
  // would sit at full forever.
  if (!db) return { unmetered: true, limit: null, used: 0, remaining: null, resetsAt: null, allowed: true };

  const since = Date.now() - WINDOW_MS;
  const where = userId ? "user_id = $1" : "guest_key = $1";
  const key = userId || guest;
  const r = await db.query(
    `SELECT COUNT(*)::int AS used, MIN(created_at) AS oldest FROM h1_ai_usage WHERE ${where} AND created_at > $2`,
    [key, since]
  );
  const used = Number(r.rows[0].used) || 0;
  const oldest = r.rows[0].oldest ? Number(r.rows[0].oldest) : null;
  const remaining = Math.max(0, limit - used);
  return {
    unlimited: false,
    limit,
    used,
    remaining,
    // When the oldest message in the window ages out, one more becomes available.
    resetsAt: remaining === 0 && oldest ? oldest + WINDOW_MS : null,
    allowed: remaining > 0,
  };
}

async function record(db, { userId = null, guest = null, kind = "chat" } = {}) {
  if (!db) return;
  await db.query("INSERT INTO h1_ai_usage (user_id, guest_key, kind, created_at) VALUES ($1, $2, $3, $4)", [userId, guest, kind, Date.now()]);
}

// Old rows tell us nothing once they're outside the window.
async function purge(db) {
  if (!db) return;
  await db.query("DELETE FROM h1_ai_usage WHERE created_at < $1", [Date.now() - WINDOW_MS * 2]);
}

function describeReset(resetsAt) {
  if (!resetsAt) return "";
  const ms = resetsAt - Date.now();
  if (ms <= 0) return "in a moment";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.round((ms % (60 * 60 * 1000)) / 60000);
  if (hours >= 1) return `in ${hours}h ${minutes}m`;
  return `in ${Math.max(1, minutes)}m`;
}

module.exports = { check, record, purge, getLimit, setLimit, guestKey, describeReset, DEFAULT_LIMIT, WINDOW_MS };
