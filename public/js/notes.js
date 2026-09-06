import { safeGetJson, safeSetJson } from "./storage.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";
import { logEvent } from "./progress.js";
import { switchView } from "./nav.js";
import { explainQuestion } from "./explain.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { currentSpaceTag, matchesCurrentSpace } from "./spacesStore.js";

const NOTES_KEY = "h1-notes";

const notesList = document.getElementById("notesList");
const notesSearch = document.getElementById("notesSearch");
const notesFolderRow = document.getElementById("notesFolderRow");
const newNoteBtn = document.getElementById("newNoteBtn");
const noteEmptyState = document.getElementById("noteEmptyState");
const noteEditor = document.getElementById("noteEditor");
const noteTitleInput = document.getElementById("noteTitleInput");
const noteBodyInput = document.getElementById("noteBodyInput");
const noteFolderInput = document.getElementById("noteFolderInput");
const noteTagsInput = document.getElementById("noteTagsInput");
const notePinBtn = document.getElementById("notePinBtn");
const noteFavoriteBtn = document.getElementById("noteFavoriteBtn");
const noteChecklist = document.getElementById("noteChecklist");
const addChecklistItemBtn = document.getElementById("addChecklistItemBtn");
const noteMeta = document.getElementById("noteMeta");
const deleteNoteBtn = document.getElementById("deleteNoteBtn");
const noteSummarizeBtn = document.getElementById("noteSummarizeBtn");
const noteExplainBtn = document.getElementById("noteExplainBtn");
const noteQuizBtn = document.getElementById("noteQuizBtn");
const noteFlashcardsBtn = document.getElementById("noteFlashcardsBtn");
const notePracticeBtn = document.getElementById("notePracticeBtn");

let activeId = null;
let activeFolder = "";
let saveTimer = null;
let moreTools = null; // lazily bound to avoid a hard circular import at module-eval time

function uid() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadNotes() {
  return safeGetJson(NOTES_KEY, []);
}

function saveNotes(list) {
  safeSetJson(NOTES_KEY, list);
}

function formatMeta(note) {
  const d = new Date(note.updatedAt);
  return `Edited ${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function allFolders() {
  const set = new Set(
    loadNotes()
      .filter((n) => matchesCurrentSpace(n.spaceId))
      .map((n) => n.folder || "General")
  );
  return Array.from(set).sort();
}

function renderFolderChips() {
  const folders = allFolders();
  notesFolderRow.innerHTML = "";
  if (folders.length <= 1) return;
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "folder-chip" + (activeFolder === "" ? " active" : "");
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    activeFolder = "";
    renderFolderChips();
    renderList();
  });
  notesFolderRow.appendChild(allChip);
  folders.forEach((folder) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "folder-chip" + (activeFolder === folder ? " active" : "");
    chip.textContent = folder;
    chip.addEventListener("click", () => {
      activeFolder = folder;
      renderFolderChips();
      renderList();
    });
    notesFolderRow.appendChild(chip);
  });
}

function renderList() {
  const query = notesSearch.value.trim().toLowerCase();
  const notes = loadNotes()
    .slice()
    .filter((n) => matchesCurrentSpace(n.spaceId))
    .filter((n) => !activeFolder || (n.folder || "General") === activeFolder)
    .filter(
      (n) =>
        !query ||
        n.title.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(query))
    )
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);

  notesList.innerHTML = "";
  if (notes.length === 0) {
    const msg = document.createElement("p");
    msg.className = "settings-hint";
    msg.style.padding = "8px 2px";
    msg.textContent = query ? "No notes match your search." : "No notes yet.";
    notesList.appendChild(msg);
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "note-item" + (note.id === activeId ? " active" : "");
    item.innerHTML = '<div class="note-item-title"></div><div class="note-item-preview"></div>';
    item.querySelector(".note-item-title").textContent = (note.pinned ? "📌 " : "") + (note.title || "Untitled note");
    item.querySelector(".note-item-preview").textContent = note.body.slice(0, 80) || "No content yet";
    item.addEventListener("click", () => openNote(note.id));
    notesList.appendChild(item);
  });
}

function renderChecklist(note) {
  noteChecklist.innerHTML = "";
  (note.checklist || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "checklist-item" + (item.done ? " done" : "");
    row.innerHTML = `<input type="checkbox" ${item.done ? "checked" : ""} /><input type="text" /><button type="button" class="checklist-remove" aria-label="Remove item">×</button>`;
    const checkbox = row.querySelector('input[type="checkbox"]');
    const textInput = row.querySelector('input[type="text"]');
    textInput.value = item.text;
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      row.classList.toggle("done", item.done);
      persistActive();
    });
    textInput.addEventListener("input", () => {
      item.text = textInput.value;
      scheduleSave();
    });
    row.querySelector(".checklist-remove").addEventListener("click", () => {
      note.checklist.splice(i, 1);
      renderChecklist(note);
      persistActive();
    });
    noteChecklist.appendChild(row);
  });
}

function currentNote() {
  return loadNotes().find((n) => n.id === activeId) || null;
}

function openNote(id) {
  activeId = id;
  const note = currentNote();
  if (!note) return;
  note.checklist = note.checklist || [];
  note.tags = note.tags || [];
  note.folder = note.folder || "General";
  noteEmptyState.hidden = true;
  noteEditor.hidden = false;
  noteTitleInput.value = note.title;
  noteBodyInput.value = note.body;
  noteFolderInput.value = note.folder === "General" ? "" : note.folder;
  noteTagsInput.value = note.tags.join(", ");
  notePinBtn.setAttribute("aria-pressed", String(Boolean(note.pinned)));
  noteFavoriteBtn.setAttribute("aria-pressed", String(Boolean(note.favorite)));
  renderChecklist(note);
  noteMeta.textContent = formatMeta(note);
  renderList();
}

function persistActive() {
  if (!activeId) return;
  const list = loadNotes();
  const note = list.find((n) => n.id === activeId);
  if (!note) return;
  note.title = noteTitleInput.value;
  note.body = noteBodyInput.value;
  note.folder = noteFolderInput.value.trim() || "General";
  note.tags = noteTagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  note.updatedAt = Date.now();
  saveNotes(list);
  noteMeta.textContent = formatMeta(note);
  renderFolderChips();
  renderList();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistActive, 400);
}

[noteTitleInput, noteBodyInput, noteFolderInput, noteTagsInput].forEach((el) => el.addEventListener("input", scheduleSave));

notePinBtn.addEventListener("click", () => {
  const note = currentNote();
  if (!note) return;
  note.pinned = !note.pinned;
  notePinBtn.setAttribute("aria-pressed", String(note.pinned));
  const list = loadNotes();
  const idx = list.findIndex((n) => n.id === note.id);
  if (idx !== -1) list[idx] = note;
  saveNotes(list);
  renderList();
});

noteFavoriteBtn.addEventListener("click", () => {
  if (!activeId) return;
  toggleNoteFavorite(activeId);
  noteFavoriteBtn.setAttribute("aria-pressed", String(Boolean(currentNote()?.favorite)));
});

addChecklistItemBtn.addEventListener("click", () => {
  const note = currentNote();
  if (!note) return;
  note.checklist = note.checklist || [];
  note.checklist.push({ text: "", done: false });
  renderChecklist(note);
  persistActive();
  const inputs = noteChecklist.querySelectorAll('input[type="text"]');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

newNoteBtn.addEventListener("click", () => {
  const now = Date.now();
  const note = { id: uid(), title: "", body: "", folder: "General", tags: [], checklist: [], pinned: false, favorite: false, spaceId: currentSpaceTag(), createdAt: now, updatedAt: now };
  const list = loadNotes();
  list.unshift(note);
  saveNotes(list);
  openNote(note.id);
  noteTitleInput.focus();
  logEvent("note_created");
});

deleteNoteBtn.addEventListener("click", () => {
  if (!activeId) return;
  confirmDanger("Delete this note?", "This can't be undone.", "Delete", () => {
    const list = loadNotes().filter((n) => n.id !== activeId);
    saveNotes(list);
    activeId = null;
    noteEditor.hidden = true;
    noteEmptyState.hidden = list.length !== 0;
    if (!noteEmptyState.hidden) {
      noteEmptyState.querySelector("h2").textContent = "No notes yet";
      noteEmptyState.querySelector("p").textContent = "Create your first note to start collecting what you've learned.";
    }
    renderFolderChips();
    renderList();
    showToast("Note deleted.", "success");
  });
});

notesSearch.addEventListener("input", renderList);

/* ---------------------------------------------------------
   AI actions on the active note
   --------------------------------------------------------- */
function requireNoteBody() {
  const note = currentNote();
  if (!note || !note.body.trim()) {
    showToast("This note is empty — write something first.", "error");
    return null;
  }
  return note;
}

noteSummarizeBtn.addEventListener("click", () => {
  const note = requireNoteBody();
  if (!note || !moreTools) return;
  moreTools.summarizeText(note.body.slice(0, 6000));
});

noteExplainBtn.addEventListener("click", () => {
  const note = requireNoteBody();
  if (!note) return;
  switchView("explain");
  explainQuestion(`${note.title ? note.title + ": " : ""}${note.body}`.slice(0, 4000));
});

noteQuizBtn.addEventListener("click", () => {
  const note = requireNoteBody();
  if (!note) return;
  switchView("quiz");
  startQuizWithTopic(note.title || "this note", note.body.slice(0, 4000));
});

noteFlashcardsBtn.addEventListener("click", () => {
  const note = requireNoteBody();
  if (!note) return;
  switchView("flashcards");
  startFlashcardsWithTopic(note.title || "this note", note.body.slice(0, 4000));
});

notePracticeBtn.addEventListener("click", () => {
  const note = requireNoteBody();
  if (!note || !moreTools) return;
  moreTools.generatePracticeFromSource(note.title || "this note", note.body.slice(0, 4000));
});

// Called once from main.js after moreTools.js has initialized, to avoid a circular
// static import between notes.js and moreTools.js.
export function bindMoreTools(api) {
  moreTools = api;
}

// Used by moreTools.js's "Save to notes" action (Summarizer) — kept independent of the
// editor's own open/active-note flow so it works even when Notes isn't the current view.
export function saveQuickNote(title, body, folder) {
  const now = Date.now();
  const note = { id: uid(), title, body, folder: folder || "General", tags: [], checklist: [], pinned: false, favorite: false, spaceId: currentSpaceTag(), createdAt: now, updatedAt: now };
  const list = loadNotes();
  list.unshift(note);
  saveNotes(list);
  logEvent("note_created");
  renderFolderChips();
  renderList();
}

window.addEventListener("h1:note-selected", (e) => {
  if (e.detail && e.detail.id) openNote(e.detail.id);
});

export function initNotes() {
  renderFolderChips();
  renderList();
  if (loadNotes().length === 0) {
    noteEmptyState.hidden = false;
    noteEditor.hidden = true;
  }
}

export function toggleNoteFavorite(id) {
  const list = loadNotes();
  const note = list.find((n) => n.id === id);
  if (!note) return;
  note.favorite = !note.favorite;
  saveNotes(list);
  renderList();
}

export function refreshNotes() {
  activeFolder = "";
  renderFolderChips();
  renderList();
}

export function clearAllNotesData() {
  saveNotes([]);
  activeId = null;
  activeFolder = "";
  noteEditor.hidden = true;
  noteEmptyState.hidden = false;
  renderFolderChips();
  renderList();
}
