import { safeGetJson, safeSetJson } from "./storage.js";
import { SUBJECT_LABELS } from "./state.js";
import { getStats } from "./progress.js";
import { getTasks } from "./homeworkStore.js";
import { getDocuments } from "./documentsStore.js";
import { getDecks } from "./flashcardDecks.js";

const CUSTOM_KEY = "h1-custom-subjects";

const BUILTIN_ICONS = { general: "🎓", math: "🧮", science: "🔬", english: "📖", hindi: "अ", tamil: "அ" };
const BUILTIN_COLORS = {
  general: "var(--subject-general)",
  math: "var(--subject-math)",
  science: "var(--subject-science)",
  english: "var(--subject-english)",
  hindi: "var(--subject-hindi)",
  tamil: "var(--subject-tamil)",
};

function uid() {
  return `subj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getCustomSubjects() {
  return safeGetJson(CUSTOM_KEY, []);
}

export function addCustomSubject(label, icon) {
  const subjects = getCustomSubjects();
  const record = { id: uid(), label: label.trim().slice(0, 40), icon: icon || "📚" };
  subjects.push(record);
  safeSetJson(CUSTOM_KEY, subjects);
  return record;
}

export function deleteCustomSubject(id) {
  safeSetJson(CUSTOM_KEY, getCustomSubjects().filter((s) => s.id !== id));
}

// A unified list of every subject the student can file things under: the six built-in ones
// the AI backend understands by key, plus any custom (organizational-only) subjects.
export function getAllSubjects() {
  const builtin = Object.keys(SUBJECT_LABELS).map((key) => ({
    key,
    label: SUBJECT_LABELS[key],
    icon: BUILTIN_ICONS[key],
    color: BUILTIN_COLORS[key],
    custom: false,
  }));
  const custom = getCustomSubjects().map((s) => ({
    key: s.id,
    label: s.label,
    icon: s.icon,
    color: "var(--subject-general)",
    custom: true,
  }));
  return [...builtin, ...custom];
}

// Real, derived-only stats per subject — never fabricated. Built-in subjects get AI-usage
// stats (questions/quizzes/study minutes) from the progress log; every subject (built-in or
// custom) gets homework/document/flashcard counts, since those are tagged directly.
export function getSubjectSummary(key) {
  const progressStats = getStats();
  const usage = progressStats.subjectStats.find((s) => s.subject === key) || null;
  const tasks = getTasks().filter((t) => t.subject === key);
  const docs = getDocuments().filter((d) => d.subject === key);
  const decks = getDecks().filter((d) => d.subject === key);
  return {
    questions: usage ? usage.questions : 0,
    quizzes: usage ? usage.quizzes : 0,
    avgScorePct: usage ? usage.avgScorePct : null,
    studyMinutes: usage ? usage.studyMinutes : 0,
    notes: usage ? usage.notes : 0,
    homeworkOpen: tasks.filter((t) => t.status !== "done").length,
    homeworkDone: tasks.filter((t) => t.status === "done").length,
    documents: docs.length,
    flashcardDecks: decks.length,
    hasActivity:
      (usage && (usage.questions > 0 || usage.quizzes > 0 || usage.studyMinutes > 0 || usage.notes > 0)) ||
      tasks.length > 0 ||
      docs.length > 0 ||
      decks.length > 0,
  };
}
