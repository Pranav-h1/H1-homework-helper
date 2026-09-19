import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { currentSpaceTag } from "./spacesStore.js";

const DOCS_KEY = "h1-documents";
const MAX_DOCS = 30;
const MAX_TEXT_CHARS = 20000;

function uid() {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Documents come back from storage that older versions of H1 wrote, and — with an account —
// from other devices. Giving every record the expected shape here means one missing field can't
// break the library, or H1's start-up.
function normalizeDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  return {
    ...doc,
    id: typeof doc.id === "string" ? doc.id : `doc_${Math.random().toString(36).slice(2, 10)}`,
    name: typeof doc.name === "string" ? doc.name : "Untitled document",
    text: typeof doc.text === "string" ? doc.text : "",
    subject: typeof doc.subject === "string" ? doc.subject : "general",
  };
}

function readDocs() {
  const raw = safeGetJson(DOCS_KEY, []);
  return (Array.isArray(raw) ? raw : []).map(normalizeDoc).filter(Boolean);
}

function writeDocs(docs) {
  safeSetJson(DOCS_KEY, docs);
  return docs;
}

export function addDocument({ name, type, text, sizeBytes, subject }) {
  const docs = readDocs();
  const record = {
    id: uid(),
    name: (name || "Untitled document").slice(0, 200),
    type,
    text: (text || "").slice(0, MAX_TEXT_CHARS),
    truncated: (text || "").length > MAX_TEXT_CHARS,
    sizeBytes: sizeBytes || 0,
    subject: subject || "general",
    favorite: false,
    spaceId: currentSpaceTag(),
    uploadedAt: Date.now(),
  };
  docs.unshift(record);
  // H1 keeps a bounded number of documents so the browser's storage quota isn't quietly
  // exhausted. Reaching that limit used to drop the oldest document with no word to anyone;
  // now the one removed is named, so it can be re-added, and a favourite is never the one
  // that goes.
  const dropped = [];
  while (docs.length > MAX_DOCS) {
    let index = -1;
    for (let i = docs.length - 1; i >= 0; i--) {
      if (!docs[i].favorite) {
        index = i;
        break;
      }
    }
    // Everything is a favourite: drop the oldest anyway rather than refuse the new document,
    // and say which one it was.
    if (index === -1) index = docs.length - 1;
    dropped.push(docs[index].name);
    docs.splice(index, 1);
  }
  writeDocs(docs);
  logEvent("document_created", { name: record.name, subject: record.subject });
  record.dropped = dropped;
  return record;
}

export const DOCUMENT_LIMIT = MAX_DOCS;

export function renameDocument(id, name) {
  const docs = readDocs();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;
  doc.name = name.slice(0, 200);
  writeDocs(docs);
  return doc;
}

export function toggleFavorite(id) {
  const docs = readDocs();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;
  doc.favorite = !doc.favorite;
  writeDocs(docs);
  return doc;
}

export function deleteDocument(id) {
  writeDocs(readDocs().filter((d) => d.id !== id));
}

export function getDocuments() {
  return readDocs();
}

export function getDocument(id) {
  return readDocs().find((d) => d.id === id) || null;
}

export function clearAllDocuments() {
  writeDocs([]);
}

export { MAX_TEXT_CHARS };
