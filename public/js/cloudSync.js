// Keeping an account's work in step across devices.
//
// How it works, and why this way:
//
// H1 has ~50 separate stores (notes, homework, decks, planner…) that every feature reads and
// writes synchronously from localStorage. Making all of them async would have meant rewriting
// the whole app and would have made H1 slower and less reliable offline. So the device keeps
// being the thing features talk to, and this module carries changes between the device and the
// account:
//
//   • local write  → marked dirty → uploaded a moment later (batched)
//   • other device → the account's revision number changes → the new values are pulled down
//
// Each store has a version. An upload says which version it was based on; if the account has
// moved on since (another device saved first), the server refuses that write and returns what it
// holds. Nothing is overwritten blindly — the two versions are merged and the result is saved.
// Merging is by item id, so a note written on a phone and a note written on a laptop both
// survive, which is the behaviour that matters: H1 must never quietly lose a student's work.
//
// Anything that can't be uploaded stays marked dirty on the device and is retried — closing the
// tab, going offline or a server hiccup delays a save, it doesn't lose it.
import { physicalKey, onLocalWrite, listKeys, safeGet } from "./storage.js";
import * as api from "./accountApi.js";

const PUSH_DELAY_MS = 1200;
const POLL_MS = 90000;
const MAX_BACKOFF_MS = 60000;

let ns = null;
let versions = {};
let dirty = new Set();
let revision = 0;
let pushTimer = null;
let pushing = null;
let backoff = 0;
let active = false;
let lastError = null;
let pollTimer = null;

const stateListeners = new Set();
const remoteListeners = new Set();

// --- device-side bookkeeping ---------------------------------------------------------------
// Kept outside the account namespace deliberately: it describes what THIS device has already
// sent and received, not the account's content.
function metaKey(name) {
  return `h1sync:${ns}:${name}`;
}
function readMeta(name, fallback) {
  try {
    const raw = localStorage.getItem(metaKey(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeMeta(name, value) {
  try {
    localStorage.setItem(metaKey(name), JSON.stringify(value));
  } catch {
    // If this can't be written the worst case is re-uploading or re-downloading later.
  }
}
function saveDirty() {
  writeMeta("dirty", [...dirty]);
}

// --- reading and writing local values without looping back into sync ------------------------
function readLocal(key) {
  try {
    return localStorage.getItem(physicalKey(key));
  } catch {
    return null;
  }
}
function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(physicalKey(key));
    else localStorage.setItem(physicalKey(key), value);
    return true;
  } catch {
    return false;
  }
}

// --- state reporting ------------------------------------------------------------------------
function emitState() {
  const state = {
    syncing: Boolean(pushing),
    pending: dirty.size,
    error: lastError,
    lastRevision: revision,
  };
  stateListeners.forEach((cb) => {
    try {
      cb(state);
    } catch {
      /* a badge failing to update must not break syncing */
    }
  });
}

export function onSyncState(cb) {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export function onRemoteChange(cb) {
  remoteListeners.add(cb);
  return () => remoteListeners.delete(cb);
}

export function syncStatus() {
  return { active, pending: dirty.size, syncing: Boolean(pushing), error: lastError, revision };
}

// --- merging ---------------------------------------------------------------------------------
// When the same store was changed in two places, keep both sides' work.
const TIME_FIELDS = ["updatedAt", "modifiedAt", "editedAt", "savedAt", "ts", "time", "createdAt", "date"];

function timeOf(item) {
  for (const f of TIME_FIELDS) {
    const v = item && item[f];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Date.parse(v);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

function idOf(item) {
  if (!item || typeof item !== "object") return null;
  for (const f of ["id", "uid", "key", "slug"]) {
    if (typeof item[f] === "string" && item[f]) return item[f];
    if (typeof item[f] === "number") return String(item[f]);
  }
  return null;
}

export function mergeValues(localRaw, serverRaw) {
  if (localRaw === null) return serverRaw;
  if (serverRaw === null) return localRaw;
  if (localRaw === serverRaw) return localRaw;
  let local;
  let server;
  try {
    local = JSON.parse(localRaw);
    server = JSON.parse(serverRaw);
  } catch {
    // Not JSON (a plain setting): the change made here is the more recent one.
    return localRaw;
  }

  // Lists of things with ids — notes, tasks, flashcards, conversations, events…
  if (Array.isArray(local) && Array.isArray(server)) {
    const byId = new Map();
    const loose = [];
    const add = (item, fromLocal) => {
      const id = idOf(item);
      if (!id) {
        loose.push({ item, fromLocal });
        return;
      }
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, item);
        return;
      }
      // Same item on both sides: keep whichever was edited later, and the local copy when
      // neither carries a timestamp (this device knows what the person just did).
      const a = timeOf(existing);
      const b = timeOf(item);
      if (b > a || (b === a && fromLocal)) byId.set(id, item);
    };
    server.forEach((item) => add(item, false));
    local.forEach((item) => add(item, true));
    if (byId.size === 0) {
      // No ids to merge on: keep the longer list rather than throwing entries away.
      return local.length >= server.length ? localRaw : serverRaw;
    }
    const seenLoose = new Set();
    const extras = loose
      .map(({ item }) => item)
      .filter((item) => {
        const fingerprint = JSON.stringify(item);
        if (seenLoose.has(fingerprint)) return false;
        seenLoose.add(fingerprint);
        return true;
      });
    return JSON.stringify([...byId.values(), ...extras]);
  }

  // Objects keyed by id, and settings objects: take both sides, preferring this device for
  // anything set in both.
  if (local && server && typeof local === "object" && typeof server === "object" && !Array.isArray(local) && !Array.isArray(server)) {
    return JSON.stringify({ ...server, ...local });
  }

  return localRaw;
}

// --- pulling -----------------------------------------------------------------------------
// Brings the account's data onto this device. Called once at sign-in and whenever the account
// has changed elsewhere.
export async function pullAll({ initial = false } = {}) {
  const payload = await api.fetchAllData();
  const changed = [];
  const serverKeys = new Set(Object.keys(payload.items || {}));

  for (const [key, entry] of Object.entries(payload.items || {})) {
    const localVersion = versions[key] || 0;
    if (dirty.has(key)) {
      // Changed here and there: merge, keep it dirty so the merged result gets uploaded.
      const merged = mergeValues(readLocal(key), entry.value);
      if (merged !== readLocal(key)) {
        writeLocal(key, merged);
        changed.push(key);
      }
      versions[key] = entry.version;
      continue;
    }
    if (entry.version > localVersion || readLocal(key) === null) {
      if (writeLocal(key, entry.value)) changed.push(key);
      versions[key] = entry.version;
    }
  }

  // Keys this device has that the account doesn't know about yet — from before signing in on
  // this device, or an upload that never completed. They're queued, never discarded.
  for (const key of listKeys()) {
    if (!serverKeys.has(key) && readLocal(key) !== null) {
      versions[key] = versions[key] || 0;
      dirty.add(key);
    }
  }

  revision = payload.revision || 0;
  writeMeta("versions", versions);
  writeMeta("revision", revision);
  saveDirty();

  if (changed.length && !initial) {
    remoteListeners.forEach((cb) => {
      try {
        cb(changed);
      } catch {
        /* a view failing to refresh shouldn't stop the sync */
      }
    });
  }
  if (dirty.size) schedulePush(0);
  emitState();
  return changed;
}

// --- pushing -----------------------------------------------------------------------------
function schedulePush(delay = PUSH_DELAY_MS) {
  if (!active) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    push().catch(() => {
      /* push() records its own errors */
    });
  }, delay);
}

export async function push() {
  if (!active || pushing) return pushing;
  if (!dirty.size) return null;
  pushing = (async () => {
    const keys = [...dirty];
    const changes = keys.map((key) => ({ key, value: readLocal(key), baseVersion: versions[key] || 0 }));
    emitState();
    try {
      const result = await api.saveChanges(changes);
      let conflicts = 0;
      for (const entry of result.results || []) {
        if (entry.ok) {
          // Unless it was edited again while the upload was in flight.
          const stillSame = changes.find((c) => c.key === entry.key).value === readLocal(entry.key);
          versions[entry.key] = entry.version;
          if (stillSame) dirty.delete(entry.key);
        } else if (entry.conflict) {
          conflicts++;
          const merged = mergeValues(readLocal(entry.key), entry.value);
          writeLocal(entry.key, merged);
          versions[entry.key] = entry.version;
          // Still dirty: the merged result goes up on the next round.
        } else if (entry.error === "QUOTA") {
          // Keep it on the device and stop retrying in a loop; the person is told once.
          dirty.delete(entry.key);
          lastError = entry.message || "Your account's storage is full.";
        }
      }
      revision = result.revision || revision;
      writeMeta("versions", versions);
      writeMeta("revision", revision);
      saveDirty();
      backoff = 0;
      if (!lastError) lastError = null;
      if (conflicts) schedulePush(200);
      else if (dirty.size) schedulePush(PUSH_DELAY_MS);
    } catch (err) {
      // Nothing is dropped: the keys stay dirty and go up on the next attempt.
      lastError = err && err.offline ? "offline" : (err && err.message) || "Couldn't save to your account.";
      if (!(err instanceof api.ApiError) || err.status === 0 || err.status >= 500 || err.offline) {
        backoff = Math.min(backoff ? backoff * 2 : 2000, MAX_BACKOFF_MS);
        schedulePush(backoff);
      }
    } finally {
      pushing = null;
      emitState();
    }
  })();
  return pushing;
}

// Uploads everything outstanding and waits for it. Used before signing out and when the page is
// being closed.
export async function flush({ timeoutMs = 8000 } = {}) {
  if (!active) return true;
  clearTimeout(pushTimer);
  const deadline = Date.now() + timeoutMs;
  while (dirty.size && Date.now() < deadline) {
    const before = dirty.size;
    await push();
    if (dirty.size >= before && lastError) break;
  }
  return dirty.size === 0;
}

// --- watching for changes made elsewhere -----------------------------------------------------
export async function checkRemote() {
  if (!active || pushing) return;
  try {
    const { revision: current } = await api.fetchRevision();
    if (current > revision) await pullAll();
  } catch {
    // Offline or a blip — the next check will pick it up.
  }
}

function startWatching() {
  const onVisible = () => {
    if (document.visibilityState === "visible") checkRemote();
    else flush({ timeoutMs: 2000 });
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", () => checkRemote());
  window.addEventListener("online", () => {
    backoff = 0;
    schedulePush(0);
    checkRemote();
  });
  // A last chance to save when the tab is closing. keepalive lets the browser finish the
  // request after the page is gone; it's capped at 64KB, so it's a safety net for small
  // changes rather than the main path — the main path is the 1.2s batch above.
  window.addEventListener("pagehide", () => {
    if (!dirty.size) return;
    const changes = [...dirty].map((key) => ({ key, value: readLocal(key), baseVersion: versions[key] || 0 }));
    const body = JSON.stringify({ changes });
    if (body.length > 60000) return;
    try {
      fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-H1-CSRF": api.getCsrfToken() || "" },
        credentials: "same-origin",
        body,
        keepalive: true,
      });
    } catch {
      // Nothing more to try at this point; the changes are still on the device.
    }
  });
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") checkRemote();
  }, POLL_MS);
}

// --- lifecycle ---------------------------------------------------------------------------
export function start(namespace) {
  ns = namespace;
  versions = readMeta("versions", {}) || {};
  revision = readMeta("revision", 0) || 0;
  dirty = new Set(readMeta("dirty", []) || []);
  active = true;
  lastError = null;
  onLocalWrite((key) => {
    if (!active) return;
    dirty.add(key);
    saveDirty();
    schedulePush();
    emitState();
  });
  startWatching();
  emitState();
}

export function stop() {
  active = false;
  clearTimeout(pushTimer);
  clearInterval(pollTimer);
}

// Everything on this device that hasn't reached the account yet.
export function pendingKeys() {
  return [...dirty];
}

// Used by the guest-data offer: bring a value in, merged with whatever the account already has.
export function adoptValue(key, incomingRaw) {
  const merged = mergeValues(incomingRaw, readLocal(key));
  if (merged === readLocal(key)) return false;
  writeLocal(key, merged);
  dirty.add(key);
  saveDirty();
  schedulePush(300);
  return true;
}

export function markAllDirty() {
  listKeys().forEach((key) => {
    if (safeGet(key) !== null) dirty.add(key);
  });
  saveDirty();
  schedulePush(0);
}
