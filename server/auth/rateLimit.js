// A small fixed-window rate limiter kept in memory. Enough for a single server instance, which
// is what H1 runs; it slows down password guessing and sign-up spam without any extra service.
//
// Failed logins are counted per IP and per username. Per-username counting applies whether or
// not the account exists, so being limited doesn't reveal anything about which usernames are
// real.
function createLimiter({ windowMs, max }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60000));
  if (sweep.unref) sweep.unref();

  return {
    // How many seconds until `key` may try again, or 0 if it's allowed now.
    blockedFor(key) {
      const v = hits.get(key);
      if (!v || v.resetAt <= Date.now() || v.count < max) return 0;
      return Math.ceil((v.resetAt - Date.now()) / 1000);
    },
    hit(key) {
      const now = Date.now();
      const v = hits.get(key);
      if (!v || v.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
      else v.count += 1;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

function clientIp(req) {
  // With `trust proxy` set, Express takes this from X-Forwarded-For as set by Render's proxy.
  return req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { createLimiter, clientIp };
