// Today's Mission completion state.
//
// The mission itself is generated fresh from live signals (see secondBrain.js) and is never
// stored — only which of today's steps the student has ticked off. That state resets when
// the date rolls over, so an old plan can't linger and look like today's.
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";

const KEY = "h1-mission-state";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// `done` follows the checkbox and can go back to false. `awarded` does not: once a step has
// earned its XP today it can't earn it again by being unticked and reticked. Events are
// append-only, so this guard is what keeps the tick from being a free XP button.
function read() {
  const state = safeGetJson(KEY, null);
  if (!state || state.date !== todayKey()) return { date: todayKey(), done: {}, awarded: {} };
  return { date: state.date, done: state.done || {}, awarded: state.awarded || {} };
}

function write(state) {
  safeSetJson(KEY, state);
  return state;
}

export function getDoneIds() {
  return Object.keys(read().done);
}

export function isDone(taskId) {
  return Boolean(read().done[taskId]);
}

export function getCompletedCount() {
  return Object.keys(read().done).length;
}

// Returns { done, awardedXp } — awardedXp is 0 when this step already paid out today.
export function toggleTask(taskId, xp = 0) {
  const state = read();
  let awardedXp = 0;
  if (state.done[taskId]) {
    delete state.done[taskId];
  } else {
    state.done[taskId] = Date.now();
    if (!state.awarded[taskId]) {
      state.awarded[taskId] = true;
      awardedXp = xp;
      // XP is never stored as a number anywhere — it's derived from the event log, so the
      // only honest way to grant it is to log that the step actually happened.
      logEvent("mission_task_done", { taskId, xp });
    }
  }
  write(state);
  return { done: Boolean(state.done[taskId]), awardedXp };
}

export function clearMissionState() {
  write({ date: todayKey(), done: {}, awarded: {} });
}
