import { safeGet, safeSet, safeGetJson, safeSetJson } from "./storage.js";

const SPACES_KEY = "h1-spaces";
const CURRENT_KEY = "h1-current-space";
const ALL = "all";

// Content created before Spaces existed (or while viewing "All Spaces") has no space — it
// always shows under "All", never invented into a space it was never actually put in.
const listeners = [];

function uid() {
  return `space_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readSpaces() {
  return safeGetJson(SPACES_KEY, []);
}

function writeSpaces(list) {
  safeSetJson(SPACES_KEY, list);
  return list;
}

export function getSpaces({ includeArchived = false } = {}) {
  return readSpaces().filter((s) => includeArchived || !s.archived);
}

export function getSpace(id) {
  return readSpaces().find((s) => s.id === id) || null;
}

export function createSpace({ name, icon, color }) {
  const list = readSpaces();
  const record = {
    id: uid(),
    name: (name || "New Space").trim().slice(0, 40),
    icon: icon || "🗂️",
    color: color || "#7c5cff",
    favorite: false,
    archived: false,
    createdAt: Date.now(),
  };
  list.push(record);
  writeSpaces(list);
  return record;
}

export function renameSpace(id, name) {
  const list = readSpaces();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  s.name = name.trim().slice(0, 40) || s.name;
  writeSpaces(list);
}

export function setSpaceArchived(id, archived) {
  const list = readSpaces();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  s.archived = archived;
  writeSpaces(list);
  if (archived && getCurrentSpaceId() === id) setCurrentSpaceId(ALL);
}

export function toggleFavoriteSpace(id) {
  const list = readSpaces();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  s.favorite = !s.favorite;
  writeSpaces(list);
}

// Deleting a Space never deletes the content in it — items just fall back to "unassigned"
// (visible again under All Spaces), consistent with "do not fake isolated data".
export function deleteSpace(id) {
  writeSpaces(readSpaces().filter((s) => s.id !== id));
  if (getCurrentSpaceId() === id) setCurrentSpaceId(ALL);
}

export function getCurrentSpaceId() {
  return safeGet(CURRENT_KEY, ALL);
}

export function setCurrentSpaceId(id) {
  safeSet(CURRENT_KEY, id);
  listeners.forEach((cb) => cb(id));
}

export function onSpaceChange(cb) {
  listeners.push(cb);
}

export const ALL_SPACES_ID = ALL;

// Tag a new record with the space it was created in — "all" (no specific space active)
// stores null, so the record only ever shows under "All Spaces", never a space it wasn't
// actually created in.
export function currentSpaceTag() {
  const id = getCurrentSpaceId();
  return id === ALL ? null : id;
}

// Shared filter used by every list view: true if `spaceId` belongs in the currently active space.
export function matchesCurrentSpace(spaceId) {
  const current = getCurrentSpaceId();
  if (current === ALL) return true;
  return spaceId === current;
}
