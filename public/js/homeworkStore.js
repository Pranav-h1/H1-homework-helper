import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { currentSpaceTag, matchesCurrentSpace } from "./spacesStore.js";

const TASKS_KEY = "h1-homework-tasks";

function readTasks() {
  return safeGetJson(TASKS_KEY, []);
}

function writeTasks(tasks) {
  safeSetJson(TASKS_KEY, tasks);
  return tasks;
}

function uid() {
  return `hw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// task: { title, subject, notes, deadline (YYYY-MM-DD or ""), priority (low|medium|high),
//         estimatedMinutes, difficulty (easy|medium|hard) }
export function createTask(task) {
  const tasks = readTasks();
  const now = Date.now();
  const record = {
    id: uid(),
    title: (task.title || "").trim(),
    subject: task.subject || "general",
    notes: (task.notes || "").trim(),
    deadline: task.deadline || "",
    priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
    estimatedMinutes: Number.isFinite(Number(task.estimatedMinutes)) ? Math.max(0, Math.round(Number(task.estimatedMinutes))) : 0,
    difficulty: ["easy", "medium", "hard"].includes(task.difficulty) ? task.difficulty : "medium",
    status: "todo",
    spaceId: currentSpaceTag(),
    linkedDocId: task.linkedDocId || null,
    linkedNoteId: task.linkedNoteId || null,
    createdAt: now,
    completedAt: null,
  };
  tasks.unshift(record);
  writeTasks(tasks);
  return record;
}

export function updateTask(id, patch) {
  const tasks = readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const wasDone = tasks[idx].status === "done";
  tasks[idx] = { ...tasks[idx], ...patch };
  const isDone = tasks[idx].status === "done";
  if (isDone && !wasDone) {
    tasks[idx].completedAt = Date.now();
    logEvent("homework_completed", { title: tasks[idx].title, subject: tasks[idx].subject });
  } else if (!isDone && wasDone) {
    tasks[idx].completedAt = null;
  }
  writeTasks(tasks);
  return tasks[idx];
}

export function deleteTask(id) {
  writeTasks(readTasks().filter((t) => t.id !== id));
}

export function getTasks() {
  return readTasks();
}

export function getTask(id) {
  return readTasks().find((t) => t.id === id) || null;
}

export function clearAllTasks() {
  writeTasks([]);
}

export function getTodayAndUpcoming(limit = 5) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return readTasks()
    .filter((t) => t.status !== "done" && t.deadline && matchesCurrentSpace(t.spaceId))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, limit)
    .map((t) => ({ ...t, overdue: t.deadline < todayStr }));
}

export function getOpenCount() {
  return readTasks().filter((t) => t.status !== "done").length;
}
