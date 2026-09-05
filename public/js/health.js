import { fetchHealth } from "./api.js";

// The old UI trusted a single health fetch and could flash a false "not configured"
// banner on a slow first paint or a one-off network hiccup. This retries with backoff
// before concluding the backend is truly unreachable, then keeps re-checking forever so
// the UI self-heals the moment the backend is actually configured/reachable again.
const RETRY_DELAYS_MS = [500, 1200, 2500];
const RECHECK_INTERVAL_MS = 45000;

const listeners = [];

export function onHealthChange(cb) {
  listeners.push(cb);
}

function notify(status) {
  listeners.forEach((cb) => cb(status));
}

async function attemptFetch(retriesLeft) {
  try {
    const data = await fetchHealth();
    return { reachable: true, ai: data.ai || null };
  } catch {
    if (retriesLeft > 0) {
      const delay = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - retriesLeft] || 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return attemptFetch(retriesLeft - 1);
    }
    return { reachable: false, ai: null };
  }
}

export async function checkHealthOnce() {
  const result = await attemptFetch(RETRY_DELAYS_MS.length);
  notify(result);
  return result;
}

export function startHealthPolling() {
  checkHealthOnce();
  setInterval(checkHealthOnce, RECHECK_INTERVAL_MS);
}
