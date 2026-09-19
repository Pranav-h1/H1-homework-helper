// Where the actual contents of chat attachments live.
//
// Conversations are saved in localStorage, which has a ~5 MB quota for the whole app. Chat
// images used to be embedded in the conversation as full base64 — one decent phone photo was
// enough to push a save past the quota, and localStorage fails silently, so the conversation
// quietly stopped persisting. Now a message only carries a small reference (name, size, a
// thumbnail) and the heavy content goes into IndexedDB, which is built for exactly this.
//
// With accounts, two things are added:
//   • Each account gets its own database on the device ("h1-files-<ns>"), so one person's
//     photos are never served to another person using the same computer. Guest mode keeps the
//     original name, so anything saved before accounts existed is still there.
//   • While signed in, attachments are also kept with the account, so opening an old
//     conversation on another device shows its photos instead of a broken reference. The
//     device copy stays the fast path; the account is the fallback and the backup.
//
// If IndexedDB isn't available (some private-browsing modes), everything still works for the
// current session from memory; it just won't survive a reload, and chat says so.
import { getNamespace } from "./storage.js";
import { isAccountMode, isOffline } from "./session.js";
import * as api from "./accountApi.js";

const STORE = "attachments";
const VERSION = 1;

const memory = new Map();
let dbPromise = null;
let persistent = true;

function dbName() {
  const ns = getNamespace();
  return ns ? `h1-files-${ns}` : "h1-files";
}

function openDb(name = dbName()) {
  if (dbPromise && dbPromise.name === name) return dbPromise.promise;
  const promise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(name, VERSION);
    } catch {
      persistent = false;
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      persistent = false;
      resolve(null);
    };
    req.onblocked = () => {
      persistent = false;
      resolve(null);
    };
  });
  dbPromise = { name, promise };
  return promise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => {
      result = r;
    });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function syncing() {
  return isAccountMode() && !isOffline();
}

export function isPersistent() {
  return persistent;
}

// record: { id, conversationId, kind, name, mimeType?, data?, text?, images? }
export async function putFile(record) {
  memory.set(record.id, record);
  const db = await openDb();
  let stored = false;
  if (db) {
    try {
      await tx(db, "readwrite", (store) => request(store.put(record)));
      stored = true;
    } catch {
      // Quota or a transient failure: the in-memory copy still serves this session.
    }
  }
  if (syncing()) {
    // Not awaited: sending a photo shouldn't make the chat wait on an upload. A failure here
    // leaves the attachment on this device, which is exactly how H1 behaved before accounts.
    api.putFileRecord(record).catch(() => {});
  }
  return stored;
}

export async function getFile(id) {
  if (memory.has(id)) return memory.get(id);
  const db = await openDb();
  if (db) {
    try {
      const found = await tx(db, "readonly", (store) => request(store.get(id)));
      if (found) {
        memory.set(id, found);
        return found;
      }
    } catch {
      // Fall through to the account copy.
    }
  }
  if (syncing()) {
    // Not on this device — most likely the conversation was started somewhere else.
    try {
      const { record } = await api.getFileRecord(id);
      if (record) {
        memory.set(id, record);
        if (db) {
          try {
            await tx(db, "readwrite", (store) => request(store.put(record)));
          } catch {
            // Caching it locally is a bonus, not a requirement.
          }
        }
        return record;
      }
    } catch {
      // Genuinely gone, or offline.
    }
  }
  return null;
}

export async function deleteFilesForConversation(conversationId) {
  [...memory.values()].forEach((r) => {
    if (r.conversationId === conversationId) memory.delete(r.id);
  });
  if (syncing()) api.deleteFiles({ conversationIds: [conversationId] }).catch(() => {});
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, "readwrite", async (store) => {
      const keys = await request(store.index("conversationId").getAllKeys(conversationId));
      keys.forEach((k) => store.delete(k));
    });
  } catch {
    // Leaving an orphaned file behind is harmless; failing a conversation delete is not.
  }
}

// Moves attachments from a draft id to the conversation they were actually sent in.
export async function reassignFiles(ids, conversationId) {
  for (const id of ids) {
    const rec = await getFile(id);
    if (rec && rec.conversationId !== conversationId) {
      await putFile({ ...rec, conversationId });
    }
  }
}

export async function clearAllFiles() {
  memory.clear();
  if (syncing()) {
    try {
      await api.deleteFiles({ all: true });
    } catch {
      // The local copy is still cleared below; the account copy is retried on the next clear.
    }
  }
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, "readwrite", (store) => request(store.clear()));
  } catch {
    // Nothing further to do.
  }
}

// Everything in one device database, used when bringing guest attachments into an account.
export async function readAllFrom(name) {
  let db;
  try {
    db = await openDb(name);
  } catch {
    return [];
  }
  if (!db) return [];
  try {
    return (await tx(db, "readonly", (store) => request(store.getAll()))) || [];
  } catch {
    return [];
  } finally {
    // Leave the handle pointing back at the active identity's database.
    dbPromise = null;
  }
}

// Copies attachments saved as a guest into the signed-in account. Nothing is removed from the
// guest database — the copy is additive, and running it twice is harmless.
export async function importGuestFiles() {
  const records = await readAllFrom("h1-files");
  let copied = 0;
  for (const record of records) {
    if (!record || !record.id) continue;
    const existing = await getFile(record.id);
    if (existing) continue;
    await putFile(record);
    copied++;
  }
  return copied;
}
