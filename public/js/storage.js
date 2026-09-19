// Where H1 keeps everything on the device.
//
// Every feature in H1 reads and writes through these four functions, synchronously, exactly as
// it always has. What changed with accounts is *which* physical key a logical key maps to:
//
//   • Guest (no account)   "h1-notes"  →  "h1-notes"          — unchanged, so anyone who used
//                                                                H1 before accounts existed
//                                                                still finds their work.
//   • Signed in            "h1-notes"  →  "h1u:<ns>:h1-notes" — one private set of keys per
//                                                                account, so two people sharing
//                                                                a laptop never see each other's
//                                                                work, even before anything has
//                                                                reached the server.
//
// `<ns>` is an opaque namespace the server hands out per account. It is not the account's
// internal id, and it is never used to prove who anyone is — the server decides that from the
// session cookie alone. It is only a local filing label.
//
// The namespace is set once during boot, before any feature module is imported, so no module
// ever needs to know accounts exist.

let namespace = null;
const writeListeners = new Set();

// Settings that belong to this device rather than to the person: the first-paint theme cache,
// whether this browser last ran as a guest, boot retry counters, the collapsed sidebar. These
// stay outside the account namespace and are never synced — the sidebar being collapsed on a
// phone shouldn't collapse it on a laptop.
const DEVICE_ONLY = new Set([
  "h1-last-theme",
  "h1-last-accent",
  "h1-boot-retries",
  "h1-device-mode",
  "h1-device-account",
  "h1-sidebar-collapsed",
  "h1-device",
  "h1-device-preview",
]);

export function isDeviceOnly(key) {
  return DEVICE_ONLY.has(key) || key.startsWith("h1sync:") || key.startsWith("h1u:");
}

// Called once during boot. `ns` is null for guest mode.
export function setNamespace(ns) {
  namespace = ns || null;
}

export function getNamespace() {
  return namespace;
}

export function physicalKey(key) {
  if (!namespace || isDeviceOnly(key)) return key;
  return `h1u:${namespace}:${key}`;
}

// Lets a logical key be recovered from a physical one — used by sync and by export.
function logicalKey(stored) {
  if (!namespace) return isDeviceOnly(stored) || stored.startsWith("h1u:") ? null : stored;
  const prefix = `h1u:${namespace}:`;
  return stored.startsWith(prefix) ? stored.slice(prefix.length) : null;
}

function notify(key) {
  if (isDeviceOnly(key)) return;
  writeListeners.forEach((cb) => {
    try {
      cb(key);
    } catch {
      // A sync listener must never break the write that triggered it.
    }
  });
}

// The sync engine subscribes here, so saving a note is still one synchronous localStorage write
// and the upload happens afterwards, in the background.
export function onLocalWrite(cb) {
  writeListeners.add(cb);
  return () => writeListeners.delete(cb);
}

export function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(physicalKey(key));
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(physicalKey(key), value);
  } catch {
    // ignored — feature degrades to "doesn't persist" rather than crashing
  }
  notify(key);
}

export function safeRemove(key) {
  try {
    localStorage.removeItem(physicalKey(key));
  } catch {
    // ignored
  }
  notify(key);
}

export function safeGetJson(key, fallback) {
  try {
    const raw = localStorage.getItem(physicalKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function safeSetJson(key, value) {
  try {
    localStorage.setItem(physicalKey(key), JSON.stringify(value));
  } catch {
    // ignored
  }
  notify(key);
}

// Every H1 key that belongs to the current identity (guest or account), as logical keys.
// Used by sync, by export, and by "clear everything".
export function listKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const stored = localStorage.key(i);
      if (!stored) continue;
      const key = logicalKey(stored);
      if (key && key.startsWith("h1-") && !isDeviceOnly(key)) out.push(key);
    }
  } catch {
    // Storage unavailable: nothing to list.
  }
  return out;
}

// Reads a value belonging to guest mode specifically, whichever mode is active. This is how the
// "bring your guest work into this account" offer looks at what's there without switching modes.
export function readGuestValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function listGuestKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const stored = localStorage.key(i);
      if (stored && stored.startsWith("h1-") && !isDeviceOnly(stored)) out.push(stored);
    }
  } catch {
    // Storage unavailable.
  }
  return out;
}

// Removes every key for the current identity. Device settings survive; guest data is untouched
// when an account is signed out, and vice versa.
export function clearCurrentKeys() {
  listKeys().forEach((key) => {
    try {
      localStorage.removeItem(physicalKey(key));
    } catch {
      // ignored
    }
  });
}
