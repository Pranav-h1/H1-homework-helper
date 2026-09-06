import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { currentSpaceTag } from "./spacesStore.js";

const DOCS_KEY = "h1-documents";
const MAX_DOCS = 30;
const MAX_TEXT_CHARS = 20000;

function uid() {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readDocs() {
  return safeGetJson(DOCS_KEY, []);
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
  if (docs.length > MAX_DOCS) docs.length = MAX_DOCS;
  writeDocs(docs);
  logEvent("document_created", { name: record.name, subject: record.subject });
  return record;
}

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
