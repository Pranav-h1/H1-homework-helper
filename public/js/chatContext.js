import { safeGetJson } from "./storage.js";
import { getConversationContext, setConversationContext } from "./conversations.js";
import { getDocument, getDocuments } from "./documentsStore.js";
import { showToast } from "./toast.js";
import { openListPicker } from "./modal.js";
import { appState, SUBJECT_LABELS, onSubjectChange } from "./state.js";

const subjectLabel = document.getElementById("chatContextSubject");

function renderSubject() {
  if (subjectLabel) subjectLabel.textContent = SUBJECT_LABELS[appState.subject] || appState.subject;
}
onSubjectChange(renderSubject);
renderSubject();

// Per attached item, per message-send budget — keeps a context-heavy message safely under
// the backend's 4000-char cap even with 2-3 items attached plus the student's own question.
const MAX_ITEM_CHARS = 900;

const panel = document.getElementById("chatContextPanel");
const toggleBtn = document.getElementById("chatContextToggleBtn");
const list = document.getElementById("chatContextList");
const addNoteBtn = document.getElementById("chatContextAddNoteBtn");
const addDocBtn = document.getElementById("chatContextAddDocBtn");

let currentConversationId = null;
// Remembers what context signature was last actually injected into a sent message, per
// conversation — so re-sending doesn't repeat the full note/document text every turn.
const sentSignatures = {};

function getNotes() {
  return safeGetJson("h1-notes", []);
}

function signatureFor(ctx) {
  return `${ctx.noteIds.join(",")}|${ctx.docIds.join(",")}`;
}

function renderList() {
  if (!list || !currentConversationId) return;
  const ctx = getConversationContext(currentConversationId);
  const notes = getNotes();
  list.innerHTML = "";

  if (ctx.noteIds.length === 0 && ctx.docIds.length === 0) {
    list.innerHTML = '<p class="context-empty">No context attached. Answers use only this conversation.</p>';
    return;
  }

  ctx.noteIds.forEach((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    list.appendChild(contextChip("📝", note.title || "Untitled note", () => removeNote(id)));
  });
  ctx.docIds.forEach((id) => {
    const doc = getDocument(id);
    if (!doc) return;
    list.appendChild(contextChip(doc.type === "pdf" ? "📕" : "📄", doc.name, () => removeDoc(id)));
  });
}

function contextChip(icon, label, onRemove) {
  const chip = document.createElement("div");
  chip.className = "context-chip";
  chip.innerHTML = `<span></span><span class="context-chip-label"></span><button type="button" aria-label="Remove">×</button>`;
  chip.querySelector("span").textContent = icon;
  chip.querySelector(".context-chip-label").textContent = label;
  chip.querySelector("button").addEventListener("click", onRemove);
  return chip;
}

function removeNote(id) {
  const ctx = getConversationContext(currentConversationId);
  setConversationContext(currentConversationId, { noteIds: ctx.noteIds.filter((n) => n !== id) });
  renderList();
}

function removeDoc(id) {
  const ctx = getConversationContext(currentConversationId);
  setConversationContext(currentConversationId, { docIds: ctx.docIds.filter((d) => d !== id) });
  renderList();
}

if (addNoteBtn) {
  addNoteBtn.addEventListener("click", () => {
    const ctx = getConversationContext(currentConversationId);
    const options = getNotes()
      .filter((n) => !ctx.noteIds.includes(n.id))
      .map((n) => ({ id: n.id, icon: "📝", label: n.title || "Untitled note", sublabel: n.folder || "" }));
    openListPicker(
      "Attach a note",
      options,
      (id) => {
        setConversationContext(currentConversationId, { noteIds: [...ctx.noteIds, id] });
        renderList();
        showToast("Note attached to this conversation.", "success", 2000);
      },
      "No notes yet — create one first."
    );
  });
}

if (addDocBtn) {
  addDocBtn.addEventListener("click", () => {
    const ctx = getConversationContext(currentConversationId);
    const options = getDocuments()
      .filter((d) => !ctx.docIds.includes(d.id))
      .map((d) => ({ id: d.id, icon: d.type === "pdf" ? "📕" : "📄", label: d.name }));
    openListPicker(
      "Attach a document",
      options,
      (id) => {
        setConversationContext(currentConversationId, { docIds: [...ctx.docIds, id] });
        renderList();
        showToast("Document attached to this conversation.", "success", 2000);
      },
      "No documents yet — upload one first."
    );
  });
}

if (toggleBtn && panel) {
  toggleBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggleBtn.setAttribute("aria-expanded", String(!panel.hidden));
  });
}

export function setChatContextConversation(id) {
  currentConversationId = id;
  renderList();
}

// Called right before a message is sent. Returns a prefix to prepend to the OUTGOING
// message only (never stored/rendered) the first time context is attached or changes —
// after that it's already part of the conversation history, so it isn't repeated.
export function consumeContextPrefix() {
  if (!currentConversationId) return "";
  const ctx = getConversationContext(currentConversationId);
  if (ctx.noteIds.length === 0 && ctx.docIds.length === 0) return "";
  const sig = signatureFor(ctx);
  if (sentSignatures[currentConversationId] === sig) return "";
  sentSignatures[currentConversationId] = sig;

  const notes = getNotes();
  const parts = [];
  ctx.noteIds.forEach((id) => {
    const note = notes.find((n) => n.id === id);
    if (note) parts.push(`[Note: ${note.title || "Untitled"}]\n${(note.body || "").slice(0, MAX_ITEM_CHARS)}`);
  });
  ctx.docIds.forEach((id) => {
    const doc = getDocument(id);
    if (doc) parts.push(`[Document: ${doc.name}]\n${doc.text.slice(0, MAX_ITEM_CHARS)}`);
  });
  if (parts.length === 0) return "";
  return `Using this attached context:\n\n${parts.join("\n\n")}\n\n---\n\n`;
}

export function initChatContext() {
  // wiring above runs at module load; nothing else to prime
}
