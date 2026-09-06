import { safeGet, safeSet, safeGetJson, safeSetJson } from "./storage.js";
import { getEvents } from "./progress.js";
import { currentSpaceTag } from "./spacesStore.js";

const GOALS_KEY = "h1-goals";
const DAILY_TARGET_KEY = "h1-daily-goal-minutes";

export function getDailyGoalMinutes() {
  return Number(safeGet(DAILY_TARGET_KEY, "20")) || 20;
}

export function setDailyGoalMinutes(minutes) {
  safeSet(DAILY_TARGET_KEY, String(Math.max(5, Math.round(minutes))));
}

function uid() {
  return `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readGoals() {
  return safeGetJson(GOALS_KEY, []);
}

function writeGoals(goals) {
  safeSetJson(GOALS_KEY, goals);
  return goals;
}

// goal: { type: 'daily'|'weekly'|'subject'|'exam', title, subject, targetMinutes, deadline, notes }
export function createGoal(goal) {
  const goals = readGoals();
  const record = {
    id: uid(),
    type: ["daily", "weekly", "subject", "exam"].includes(goal.type) ? goal.type : "subject",
    title: (goal.title || "").trim(),
    subject: goal.subject || "general",
    targetMinutes: Number(goal.targetMinutes) || 0,
    deadline: goal.deadline || "",
    notes: (goal.notes || "").trim(),
    done: false,
    archived: false,
    spaceId: currentSpaceTag(),
    createdAt: Date.now(),
  };
  goals.unshift(record);
  writeGoals(goals);
  return record;
}

export function updateGoal(id, patch) {
  const goals = readGoals();
  const g = goals.find((x) => x.id === id);
  if (!g) return null;
  Object.assign(g, patch);
  writeGoals(goals);
  return g;
}

export function deleteGoal(id) {
  writeGoals(readGoals().filter((g) => g.id !== id));
}

export function getGoals({ includeArchived = false } = {}) {
  return readGoals().filter((g) => includeArchived || !g.archived);
}

function studyMinutesSince(sinceMs) {
  return getEvents()
    .filter((e) => e.type === "study_session" && e.ts >= sinceMs)
    .reduce((sum, e) => sum + (e.minutes || 0), 0);
}

// Real, derived progress — daily/weekly goals compute from actual focus-session minutes;
// subject/exam goals only track manual completion (no metric to honestly derive one from).
export function getGoalProgress(goal) {
  if (goal.type === "daily") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const minutes = studyMinutesSince(startOfToday.getTime());
    return { current: minutes, target: goal.targetMinutes, pct: Math.min(100, Math.round((minutes / Math.max(1, goal.targetMinutes)) * 100)) };
  }
  if (goal.type === "weekly") {
    const d = new Date();
    const startOfWeek = new Date(d.setDate(d.getDate() - d.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const minutes = studyMinutesSince(startOfWeek.getTime());
    return { current: minutes, target: goal.targetMinutes, pct: Math.min(100, Math.round((minutes / Math.max(1, goal.targetMinutes)) * 100)) };
  }
  return { current: goal.done ? 1 : 0, target: 1, pct: goal.done ? 100 : 0 };
}
