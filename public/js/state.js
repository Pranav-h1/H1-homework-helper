import { safeGet, safeSet } from "./storage.js";

// Small shared mutable state so feature modules (chat, quiz, flashcards, ...) can all read
// "what subject/mode is selected right now" without importing each other.
export const appState = {
  subject: safeGet("h1-subject", "general"),
  mode: safeGet("h1-ai-mode", "tutor"),
  language: safeGet("h1-ai-language", "english"),
};

const subjectListeners = [];
const modeListeners = [];
const languageListeners = [];

export const SUBJECT_LABELS = {
  general: "General",
  math: "Mathematics",
  science: "Science",
  english: "English",
  hindi: "Hindi",
  tamil: "Tamil",
};

export function setSubject(subject) {
  appState.subject = subject;
  safeSet("h1-subject", subject);
  subjectListeners.forEach((cb) => cb(subject));
}

export function onSubjectChange(cb) {
  subjectListeners.push(cb);
}

// Mirrors AI_MODES in server/index.js — the `value` here must match a key the server
// recognizes, since it's sent straight through as the chat "mode" field.
export const AI_MODES = [
  { value: "tutor", label: "Tutor", icon: "🎓", description: "Teaches step-by-step" },
  { value: "homeworkhelper", label: "Homework Helper", icon: "📘", description: "Guides you through homework" },
  { value: "socratic", label: "Socratic", icon: "❓", description: "Guides with questions" },
  { value: "examcoach", label: "Exam Coach", icon: "🧭", description: "Hints before answers" },
  { value: "quick", label: "Quick Answer", icon: "⚡", description: "Short and direct" },
  { value: "deepexplain", label: "Deep Explain", icon: "🔬", description: "Thorough, detailed answers" },
  { value: "practicecoach", label: "Practice Coach", icon: "✍️", description: "Turns answers into practice" },
  { value: "writingcoach", label: "Writing Coach", icon: "🖋️", description: "Helps improve your writing" },
  { value: "languagetutor", label: "Language Tutor", icon: "🌐", description: "Hindi / Tamil / English help" },
  { value: "sciencelab", label: "Science Lab", icon: "🧪", description: "Explains scientific concepts" },
  { value: "mathcoach", label: "Math Coach", icon: "📐", description: "Step-by-step math reasoning" },
  { value: "beginner", label: "Beginner", icon: "🌱", description: "Very simple language" },
  { value: "revision", label: "Revision", icon: "📌", description: "Key points only" },
  { value: "teachme", label: "Teach Me", icon: "🧑‍🏫", description: "A guided lesson with a check-in question" },
];

export function setMode(mode) {
  appState.mode = mode;
  safeSet("h1-ai-mode", mode);
  modeListeners.forEach((cb) => cb(mode));
}

export function onModeChange(cb) {
  modeListeners.push(cb);
}

export const AI_LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "tamil", label: "Tamil" },
];

export function setLanguage(language) {
  appState.language = language;
  safeSet("h1-ai-language", language);
  languageListeners.forEach((cb) => cb(language));
}

export function onLanguageChange(cb) {
  languageListeners.push(cb);
}
