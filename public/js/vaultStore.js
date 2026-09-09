// H1 Vault — saved AI answers. A real, separate collection from Notes (which is for the
// student's own writing) and from per-object favorites (which just flag existing records) —
// this is specifically for "keep this exact AI answer, verbatim, for later".
import { safeGetJson, safeSetJson } from "./storage.js";

const KEY = "h1-vault-answers";
const MAX_SAVED = 300;

function uid() {
  return `vault_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSavedAnswers() {
  return safeGetJson(KEY, []);
}

export function saveAnswer({ question, answer, subject }) {
  const list = getSavedAnswers();
  const record = { id: uid(), question: question || "", answer, subject: subject || "general", savedAt: Date.now() };
  list.unshift(record);
  if (list.length > MAX_SAVED) list.length = MAX_SAVED;
  safeSetJson(KEY, list);
  return record;
}

export function deleteSavedAnswer(id) {
  safeSetJson(KEY, getSavedAnswers().filter((a) => a.id !== id));
}

export function isAnswerSaved(answerText) {
  return getSavedAnswers().some((a) => a.answer === answerText);
}
