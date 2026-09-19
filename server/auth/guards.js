// Request guards for everything that uses the session cookie.
//
// CSRF: a cookie is sent by the browser automatically, so a state-changing request must also
// prove it came from H1's own pages:
//   1. Origin check — the request's Origin (or, failing that, Referer) must be this site, or an
//      origin explicitly listed in ALLOWED_ORIGINS. A request with neither is refused.
//   2. CSRF token — the X-H1-CSRF header must match the session's token, which H1's pages get
//      from /api/auth/session and hold in memory only. Another site can't read it.
// Plus SameSite=Lax on the cookie itself, so browsers don't attach it to cross-site POSTs.
//
// CORS: H1's pages and API share one origin, so no CORS headers are sent at all — browsers
// refuse cross-origin reads of the API by default, and nothing here widens that.
const crypto = require("crypto");

function allowedOrigins(env = process.env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function requestOrigin(req) {
  const origin = req.headers.origin;
  if (origin && origin !== "null") return origin;
  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

// True when the request demonstrably comes from this site.
function isSameSite(req, env = process.env) {
  const origin = requestOrigin(req);
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (allowedOrigins(env).includes(url.origin)) return true;
  const host = req.headers.host;
  if (!host || url.host !== host) return false;
  // In production only HTTPS pages count.
  const secureRequired = env.NODE_ENV === "production" || Boolean(env.RENDER);
  return secureRequired ? url.protocol === "https:" : url.protocol === "https:" || url.protocol === "http:";
}

function requireSameSite(req, res, next) {
  if (!isSameSite(req)) {
    return res.status(403).json({ error: "This request didn't come from H1, so it was blocked.", code: "BAD_ORIGIN" });
  }
  next();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function checkCsrf(req, session) {
  return Boolean(session) && safeEqual(req.get("X-H1-CSRF"), session.csrf);
}

module.exports = { isSameSite, requireSameSite, checkCsrf, allowedOrigins };
