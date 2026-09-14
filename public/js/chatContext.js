import { safeGet, safeGetJson } from "./storage.js";
import { buildAiContext, getContextSignature } from "./secondBrain.js";
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

// The backend rejects any single message over this with a 400, so everything prepended to
// the student's question has to fit inside it alongside the question itself.
const MAX_MESSAGE_CHARS = 4000;
const SEND_MARGIN_CHARS = 120;
// The Second Brain briefing's own framing text, excluded from the body budget.
const BRAIN_WRAPPER_CHARS = 300;
// Below this there isn't room for a briefing worth sending, so it's skipped entirely.
const MIN_BRAIN_CHARS = 500;

const BRAIN_SETTING_KEY = "h1-ai-knows-me";

export function aiKnowsMeEnabled() {
  return safeGet(BRAIN_SETTING_KEY, "1") !== "0";
}

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

// Remembers the material signature of the briefing last sent per conversation, so an
// unchanged picture isn't repeated on every turn — the model already has it in the history.
const sentBrainSignatures = {};

// The Second Brain briefing: what H1 actually knows about this student's studying, prepended
// to an outgoing message so the tutor can answer "what should I revise?" from their real
// data instead of guessing.
//
// It yields to two things. Attachments the student picked by hand come first — they asked
// for those — so this only gets whatever room is left under the backend's message cap. And
// it re-sends only when the *material* picture has changed since the last one in this
// conversation (see getContextSignature), so a long chat doesn't carry the same block over
// and over just because the question counter ticked up.
export function consumeBrainPrefix(userContent = "", attachmentPrefix = "") {
  if (!aiKnowsMeEnabled()) return "";

  const id = currentConversationId || "__none__";
  const signature = getContextSignature();
  if (!signature || sentBrainSignatures[id] === signature) return "";

  const room = MAX_MESSAGE_CHARS - SEND_MARGIN_CHARS - userContent.length - attachmentPrefix.length;
  if (room < MIN_BRAIN_CHARS) return "";

  const briefing = buildAiContext({ maxChars: Math.max(0, room - BRAIN_WRAPPER_CHARS) });
  if (!briefing) return "";
  // buildAiContext caps the body, not its framing — if the whole thing still doesn't fit,
  // drop it rather than send a message the backend will reject. Don't record the signature
  // in that case either, so it gets another chance on a shorter message.
  if (briefing.length > room) return "";

  sentBrainSignatures[id] = signature;
  return briefing;
}

export function initChatContext() {
  // wiring above runs at module load; nothing else to prime
}
