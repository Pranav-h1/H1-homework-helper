import { safeGet, safeSet } from "./storage.js";

// Small shared mutable state so feature modules (chat, quiz, flashcards, ...) can all read
// "what subject/mode is selected right now" without importing each other.
export const appState = {
  subject: safeGet("h1-subject", "general"),
  mode: safeGet("h1-ai-mode", "tutor"),
};

const subjectListeners = [];
const modeListeners = [];

export function setSubject(subject) {
  appState.subject = subject;
  safeSet("h1-subject", subject);
  subjectListeners.forEach((cb) => cb(subject));
}

export function onSubjectChange(cb) {
  subjectListeners.push(cb);
}

export const AI_MODES = [
  { value: "tutor", label: "Tutor", icon: "🎓", description: "Teaches step-by-step" },
  { value: "examcoach", label: "Exam Coach", icon: "🧭", description: "Hints before answers" },
  { value: "quick", label: "Quick Answer", icon: "⚡", description: "Short and direct" },
  { value: "socratic", label: "Socratic", icon: "❓", description: "Guides with questions" },
  { value: "beginner", label: "Beginner", icon: "🌱", description: "Very simple language" },
  { value: "revision", label: "Revision", icon: "📌", description: "Key points only" },
];

export function setMode(mode) {
  appState.mode = mode;
  safeSet("h1-ai-mode", mode);
  modeListeners.forEach((cb) => cb(mode));
}

export function onModeChange(cb) {
  modeListeners.push(cb);
}
