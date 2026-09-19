// How many AI messages the person in front of H1 has left, and telling them honestly.
//
// The number here is never worked out in the browser — it's whatever the server last said, and
// the server is the thing that enforces it. Asking for it is cheap; it's refreshed when H1
// starts, after every answer (the reply carries the new figure), and when the allowance is about
// to be shown.
const listeners = new Set();
let state = null;
let inFlight = null;

export function currentUsage() {
  return state;
}

export function onUsageChange(cb) {
  listeners.add(cb);
  if (state) cb(state);
  return () => listeners.delete(cb);
}

function announce() {
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch {
      // A badge failing to draw shouldn't break the next one.
    }
  });
}

// Called with whatever the server attached to a reply.
export function applyUsage(usage) {
  if (!usage) return;
  state = usage;
  announce();
}

export async function refreshUsage() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/ai/usage", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!res.ok) return state;
      const data = await res.json();
      state = data.usage || null;
      announce();
      return state;
    } catch {
      // Offline, or accounts aren't set up here: nothing to show, and nothing to worry about.
      return state;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function timeUntil(resetsAt) {
  if (!resetsAt) return "";
  const ms = resetsAt - Date.now();
  if (ms <= 0) return "in a moment";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return hours >= 1 ? `in ${hours}h ${minutes}m` : `in ${Math.max(1, minutes)}m`;
}

// Short form for the sidebar: "61 left", or nothing at all when there's no limit.
export function shortUsage(usage = state) {
  if (!usage || usage.unlimited) return "";
  return `${usage.remaining} left`;
}

// Full sentence for Settings and for the message H1 shows when the allowance runs out.
export function describeUsage(usage = state) {
  if (!usage) return "";
  if (usage.unlimited) return "No message limit on this account.";
  if (usage.remaining > 0) {
    return `${usage.remaining} of ${usage.limit} AI messages left. The allowance is for a rolling 24 hours, so used messages come back as they age out.`;
  }
  const when = timeUntil(usage.resetsAt);
  return `You've used all ${usage.limit} AI messages for now. More become available ${when || "shortly"}.`;
}

export function isLow(usage = state) {
  return Boolean(usage && !usage.unlimited && usage.remaining <= Math.max(3, Math.round(usage.limit * 0.1)));
}

export function isExhausted(usage = state) {
  return Boolean(usage && !usage.unlimited && usage.remaining <= 0);
}
