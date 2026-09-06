import { saveQuickNote } from "./notes.js";
import { createTask } from "./homeworkStore.js";
import { createItem as createPlannerItem } from "./plannerStore.js";
import { openChatWithMessage } from "./chat.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";

const overlay = document.getElementById("quickCaptureOverlay");
const sheet = document.getElementById("quickCaptureSheet");
const typeRow = document.getElementById("quickCaptureTypes");
const input = document.getElementById("quickCaptureInput");
const saveBtn = document.getElementById("quickCaptureSaveBtn");

const TYPES = [
  { id: "note", label: "Note", icon: "📝", placeholder: "What do you want to remember?" },
  { id: "task", label: "Task", icon: "📘", placeholder: "What homework do you need to do?" },
  { id: "question", label: "Question", icon: "💬", placeholder: "Ask H1 anything…" },
  { id: "idea", label: "Idea", icon: "💡", placeholder: "Capture the idea…" },
  { id: "reminder", label: "Reminder", icon: "⏰", placeholder: "What should H1 remind you about today?" },
  { id: "flashcard", label: "Flashcard", icon: "🗂️", placeholder: "What topic should H1 build flashcards for?" },
];

let activeType = "note";

function renderTypes() {
  if (!typeRow) return;
  typeRow.innerHTML = "";
  TYPES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qc-type-btn" + (t.id === activeType ? " active" : "");
    btn.innerHTML = `<span>${t.icon}</span><span>${t.label}</span>`;
    btn.addEventListener("click", () => {
      activeType = t.id;
      renderTypes();
      input.placeholder = t.placeholder;
      input.focus();
    });
    typeRow.appendChild(btn);
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function openCapture() {
  if (!overlay) return;
  overlay.hidden = false;
  renderTypes();
  input.value = "";
  input.placeholder = TYPES.find((t) => t.id === activeType).placeholder;
  setTimeout(() => input.focus(), 10);
}

function closeCapture() {
  if (overlay) overlay.hidden = true;
}

function submitCapture() {
  const text = input.value.trim();
  if (!text) return;

  if (activeType === "note") {
    saveQuickNote(text.split("\n")[0].slice(0, 60) || "Quick note", text);
    showToast("Note saved.", "success");
  } else if (activeType === "task") {
    createTask({ title: text });
    showToast("Task added to Homework.", "success");
  } else if (activeType === "question") {
    closeCapture();
    openChatWithMessage(text);
    return;
  } else if (activeType === "idea") {
    saveQuickNote(text.split("\n")[0].slice(0, 60) || "Idea", text, "Ideas");
    showToast("Idea saved to Notes.", "success");
  } else if (activeType === "reminder") {
    createPlannerItem({ type: "goal", title: text, deadline: todayStr() });
    showToast("Reminder added to your planner.", "success");
  } else if (activeType === "flashcard") {
    closeCapture();
    switchView("flashcards");
    startFlashcardsWithTopic(text);
    return;
  }

  closeCapture();
}

saveBtn?.addEventListener("click", submitCapture);
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitCapture();
  }
  if (e.key === "Escape") closeCapture();
});
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) closeCapture();
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (overlay && !overlay.hidden) closeCapture();
    else openCapture();
  }
});

export function initQuickCapture() {
  // wiring above runs at module load
}
