import { safeGetJson, safeSetJson } from "./storage.js";

const KEY = "h1-mistake-book";
const MAX_MISTAKES = 500;

function uid() {
  return `mistake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll() {
  return safeGetJson(KEY, []);
}

function writeAll(list) {
  safeSetJson(KEY, list);
  return list;
}

// entry: { question, subject, topic, studentAnswer, correctAnswer, explanation }
export function addMistake(entry) {
  const list = readAll();
  list.unshift({ id: uid(), date: Date.now(), ...entry });
  if (list.length > MAX_MISTAKES) list.length = MAX_MISTAKES;
  writeAll(list);
}

export function getMistakes() {
  return readAll();
}

export function deleteMistake(id) {
  writeAll(readAll().filter((m) => m.id !== id));
}

export function clearMistakes() {
  writeAll([]);
}

// A real pattern signal, not a fabricated one: any topic with 2+ recorded mistakes.
export function getMistakePatterns() {
  const list = readAll();
  const byTopic = {};
  list.forEach((m) => {
    const key = m.topic || "General";
    byTopic[key] = (byTopic[key] || 0) + 1;
  });
  return Object.entries(byTopic)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
}
