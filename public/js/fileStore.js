// Where the actual contents of chat attachments live.
//
// Conversations are saved in localStorage, which has a ~5 MB quota for the whole app. Chat
// images used to be embedded in the conversation as full base64 — one decent phone photo was
// enough to push a save past the quota, and localStorage fails silently, so the conversation
// quietly stopped persisting. Now a message only carries a small reference (name, size, a
// thumbnail) and the heavy content goes into IndexedDB, which is built for exactly this.
//
// If IndexedDB isn't available (some private-browsing modes), everything still works for the
// current session from memory; it just won't survive a reload, and chat says so.

const DB_NAME = "h1-files";
const STORE = "attachments";
const VERSION = 1;

const memory = new Map();
let dbPromise = null;
let persistent = true;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
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
  return dbPromise;
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

export function isPersistent() {
  return persistent;
}

// record: { id, conversationId, kind, name, mimeType?, data?, text?, images? }
export async function putFile(record) {
  memory.set(record.id, record);
  const db = await openDb();
  if (!db) return false;
  try {
    await tx(db, "readwrite", (store) => request(store.put(record)));
    return true;
  } catch {
    // Quota or a transient failure: the in-memory copy still serves this session.
    return false;
  }
}

export async function getFile(id) {
  if (memory.has(id)) return memory.get(id);
  const db = await openDb();
  if (!db) return null;
  try {
    const found = await tx(db, "readonly", (store) => request(store.get(id)));
    if (found) memory.set(id, found);
    return found || null;
  } catch {
    return null;
  }
}

export async function deleteFilesForConversation(conversationId) {
  [...memory.values()].forEach((r) => {
    if (r.conversationId === conversationId) memory.delete(r.id);
  });
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
  const db = await openDb();
  if (!db) return;
  try {
    await tx(db, "readwrite", (store) => request(store.clear()));
  } catch {
    // Nothing further to do.
  }
}
