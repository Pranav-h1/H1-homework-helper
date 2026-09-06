import { safeGetJson, safeSetJson } from "./storage.js";
import { currentSpaceTag, matchesCurrentSpace } from "./spacesStore.js";
import { logEvent } from "./progress.js";

const KEY = "h1-projects";

function uid() {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll() {
  return safeGetJson(KEY, []);
}

function writeAll(list) {
  safeSetJson(KEY, list);
  return list;
}

// project: { title, type, subject, deadline, notes }
export function createProject(project) {
  const list = readAll();
  const record = {
    id: uid(),
    title: (project.title || "Untitled project").trim(),
    type: project.type || "assignment",
    subject: project.subject || "general",
    deadline: project.deadline || "",
    notes: project.notes || "",
    tasks: [],
    linkedDocIds: [],
    linkedNoteIds: [],
    favorite: false,
    archived: false,
    spaceId: currentSpaceTag(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  list.unshift(record);
  writeAll(list);
  return record;
}

export function getProjects({ includeArchived = false } = {}) {
  return readAll().filter((p) => (includeArchived || !p.archived) && matchesCurrentSpace(p.spaceId));
}

export function getProject(id) {
  return readAll().find((p) => p.id === id) || null;
}

export function updateProject(id, patch) {
  const list = readAll();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, patch, { updatedAt: Date.now() });
  writeAll(list);
  return p;
}

export function deleteProject(id) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function toggleFavoriteProject(id) {
  const list = readAll();
  const p = list.find((x) => x.id === id);
  if (!p) return;
  p.favorite = !p.favorite;
  writeAll(list);
}

// tasks: [{ title }] or [string, ...]
export function addTasks(projectId, tasks) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  tasks.forEach((t) => {
    p.tasks.push({ id: uid(), title: typeof t === "string" ? t : t.title, done: false });
  });
  p.updatedAt = Date.now();
  writeAll(list);
  return p;
}

export function toggleTask(projectId, taskId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  const task = p.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const wasDone = task.done;
  task.done = !task.done;
  p.updatedAt = Date.now();
  writeAll(list);
  if (!wasDone && task.done) {
    const allDone = p.tasks.every((t) => t.done);
    if (allDone && p.tasks.length > 0) logEvent("project_completed", { title: p.title });
  }
}

export function deleteTask(projectId, taskId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  p.tasks = p.tasks.filter((t) => t.id !== taskId);
  writeAll(list);
}

export function reorderTasks(projectId, orderedTaskIds) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  const byId = Object.fromEntries(p.tasks.map((t) => [t.id, t]));
  p.tasks = orderedTaskIds.map((id) => byId[id]).filter(Boolean);
  writeAll(list);
}

export function linkDocument(projectId, docId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p || p.linkedDocIds.includes(docId)) return;
  p.linkedDocIds.push(docId);
  writeAll(list);
}

export function unlinkDocument(projectId, docId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  p.linkedDocIds = p.linkedDocIds.filter((id) => id !== docId);
  writeAll(list);
}

export function linkNote(projectId, noteId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p || p.linkedNoteIds.includes(noteId)) return;
  p.linkedNoteIds.push(noteId);
  writeAll(list);
}

export function unlinkNote(projectId, noteId) {
  const list = readAll();
  const p = list.find((x) => x.id === projectId);
  if (!p) return;
  p.linkedNoteIds = p.linkedNoteIds.filter((id) => id !== noteId);
  writeAll(list);
}

export function getProjectProgress(project) {
  if (project.tasks.length === 0) return 0;
  return Math.round((project.tasks.filter((t) => t.done).length / project.tasks.length) * 100);
}
