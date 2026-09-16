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

// How many times in a row a mistake has to be answered correctly before it retires from the
// active book. Two, not one: getting it right immediately after reading the answer proves
// short-term recall, not that the gap is closed.
const REPLAY_STREAK_TO_RESOLVE = 2;

// Records written before replay existed have none of these fields. Missing is read as
// "never replayed", so old entries keep working untouched rather than being migrated.
function replayState(m) {
  return {
    streak: Number(m.replayStreak) || 0,
    lastReplayedAt: m.lastReplayedAt || null,
    resolvedAt: m.resolvedAt || null,
  };
}

export function isResolved(m) {
  return Boolean(m && m.resolvedAt);
}

// The mistakes still worth drilling. Resolved ones are kept in storage forever — they're the
// student's record of what they fixed — they're just out of the active rotation.
export function getActiveMistakes() {
  return readAll().filter((m) => !isResolved(m));
}

export function getResolvedMistakes() {
  return readAll().filter(isResolved);
}

// Returns the updated record, or null if the id is gone.
export function markReplay(id, correct) {
  const list = readAll();
  const m = list.find((x) => x.id === id);
  if (!m) return null;
  const state = replayState(m);
  m.lastReplayedAt = Date.now();
  m.replayAttempts = (Number(m.replayAttempts) || 0) + 1;
  if (correct) {
    m.replayStreak = state.streak + 1;
    if (m.replayStreak >= REPLAY_STREAK_TO_RESOLVE) m.resolvedAt = Date.now();
  } else {
    // Nothing is deleted and nothing is hidden — a miss just puts it back to the start.
    m.replayStreak = 0;
    m.resolvedAt = null;
  }
  writeAll(list);
  return m;
}

// Puts a resolved mistake back into rotation, e.g. if it turns out it wasn't really fixed.
export function unresolveMistake(id) {
  const list = readAll();
  const m = list.find((x) => x.id === id);
  if (!m) return null;
  m.resolvedAt = null;
  m.replayStreak = 0;
  writeAll(list);
  return m;
}

export { REPLAY_STREAK_TO_RESOLVE };

export function deleteMistake(id) {
  writeAll(readAll().filter((m) => m.id !== id));
}

export function clearMistakes() {
  writeAll([]);
}

// A real pattern signal, not a fabricated one: any topic with 2+ recorded mistakes.
// Counts only mistakes still in the active book — a topic you've since drilled back to
// correct twice isn't a pattern you currently have, and reporting it as one would keep
// pointing the student at work they've already done.
export function getMistakePatterns() {
  const list = getActiveMistakes();
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
