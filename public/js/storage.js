// Thin localStorage wrappers that never throw (private browsing / storage-full safe).

export function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignored — feature degrades to "doesn't persist" rather than crashing
  }
}

export function safeGetJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function safeSetJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignored
  }
}
