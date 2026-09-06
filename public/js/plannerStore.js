import { safeGet, safeSet, safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { currentSpaceTag, matchesCurrentSpace } from "./spacesStore.js";

const ITEMS_KEY = "h1-planner-items";
const MIGRATED_KEY = "h1-planner-migrated-exam-v1";
const LEGACY_EXAM_KEY = "h1-exam-plans";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readItems() {
  return safeGetJson(ITEMS_KEY, []);
}

function writeItems(items) {
  safeSetJson(ITEMS_KEY, items);
  return items;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// item: { type: 'exam'|'study'|'goal'|'homework', title, subject, deadline, notes,
//         estimatedMinutes, groupId, groupLabel, dayLabel, source }
export function createItem(item) {
  const items = readItems();
  const record = {
    id: uid("plan"),
    type: ["exam", "study", "goal", "homework"].includes(item.type) ? item.type : "goal",
    title: (item.title || "").trim(),
    subject: item.subject || "general",
    deadline: item.deadline || "",
    notes: (item.notes || "").trim(),
    estimatedMinutes: Number.isFinite(Number(item.estimatedMinutes)) ? Math.max(0, Math.round(Number(item.estimatedMinutes))) : 0,
    groupId: item.groupId || null,
    groupLabel: item.groupLabel || "",
    dayLabel: item.dayLabel || "",
    source: item.source === "ai" ? "ai" : "manual",
    done: false,
    spaceId: currentSpaceTag(),
    createdAt: Date.now(),
    completedAt: null,
  };
  items.unshift(record);
  writeItems(items);
  return record;
}

export function updateItem(id, patch) {
  const items = readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const wasDone = items[idx].done;
  items[idx] = { ...items[idx], ...patch };
  if (items[idx].done && !wasDone) {
    items[idx].completedAt = Date.now();
    logEvent("plan_task_done", { title: items[idx].title, subject: items[idx].subject, source: items[idx].type });
  } else if (!items[idx].done && wasDone) {
    items[idx].completedAt = null;
  }
  writeItems(items);
  return items[idx];
}

export function deleteItem(id) {
  writeItems(readItems().filter((i) => i.id !== id));
}

export function deleteGroup(groupId) {
  writeItems(readItems().filter((i) => i.groupId !== groupId));
}

export function getItems() {
  return readItems();
}

export function clearAllItems() {
  writeItems([]);
}

export function importStudyPlan(topic, minutes, subject, tasks) {
  const groupId = uid("group");
  const groupLabel = `Study plan: ${topic}`;
  const spaceId = currentSpaceTag();
  const items = readItems();
  tasks.forEach((t) => {
    items.unshift({
      id: uid("plan"),
      type: "study",
      title: t.title,
      subject: subject || "general",
      deadline: todayStr(),
      notes: t.description || "",
      estimatedMinutes: t.minutes || 0,
      groupId,
      groupLabel,
      dayLabel: "",
      source: "ai",
      done: false,
      spaceId,
      createdAt: Date.now(),
      completedAt: null,
    });
  });
  writeItems(items);
  return groupId;
}

export function importExamPlan(subject, topics, examDate, days, planDays) {
  const groupId = uid("group");
  const groupLabel = `Exam prep: ${subject || topics}`;
  const spaceId = currentSpaceTag();
  const items = readItems();
  planDays.forEach((day) => {
    const deadline = addDays(examDate, day.day - days);
    day.tasks.forEach((taskText) => {
      items.unshift({
        id: uid("plan"),
        type: "exam",
        title: taskText,
        subject: subject || "general",
        deadline,
        notes: "",
        estimatedMinutes: 0,
        groupId,
        groupLabel,
        dayLabel: `Day ${day.day} — ${day.focus}`,
        source: "ai",
        done: false,
        spaceId,
        createdAt: Date.now(),
        completedAt: null,
      });
    });
  });
  writeItems(items);
  return groupId;
}

// One-time migration so anyone with an existing Exam Mode plan doesn't lose it when the
// Study Planner replaces the old separate Exam Mode view.
export function migrateLegacyExamPlan() {
  if (safeGet(MIGRATED_KEY, "0") === "1") return;
  safeSet(MIGRATED_KEY, "1");
  const legacy = safeGetJson(LEGACY_EXAM_KEY, null);
  if (!legacy || !legacy.current || !Array.isArray(legacy.current.plan)) return;
  const { subject, topics, examDate, plan, id } = legacy.current;
  const days = plan.length;
  const doneMap = legacy.done || {};
  const groupId = uid("group");
  const groupLabel = `Exam prep: ${subject || topics || "Exam"}`;
  const items = readItems();
  plan.forEach((day) => {
    const deadline = examDate ? addDays(examDate, day.day - days) : todayStr();
    day.tasks.forEach((taskText, i) => {
      const wasDone = Boolean(doneMap[`${id}::${day.day}::${i}`]);
      items.unshift({
        id: uid("plan"),
        type: "exam",
        title: taskText,
        subject: subject || "general",
        deadline,
        notes: "",
        estimatedMinutes: 0,
        groupId,
        groupLabel,
        dayLabel: `Day ${day.day} — ${day.focus}`,
        source: "ai",
        done: wasDone,
        createdAt: Date.now(),
        completedAt: wasDone ? Date.now() : null,
      });
    });
  });
  writeItems(items);
}

// Groups exam-prep planner items back into their originating exam plans, with a real
// countdown and completion percentage derived from the tasks actually created for it.
export function getExamGroups() {
  const items = readItems().filter((i) => i.type === "exam" && i.groupId && matchesCurrentSpace(i.spaceId));
  const byGroup = {};
  items.forEach((item) => {
    if (!byGroup[item.groupId]) {
      byGroup[item.groupId] = { groupId: item.groupId, groupLabel: item.groupLabel, subject: item.subject, examDate: item.deadline, total: 0, done: 0 };
    }
    const g = byGroup[item.groupId];
    g.total += 1;
    if (item.done) g.done += 1;
    if (item.deadline > g.examDate) g.examDate = item.deadline;
  });
  return Object.values(byGroup)
    .map((g) => ({ ...g, pct: g.total > 0 ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((a, b) => a.examDate.localeCompare(b.examDate));
}

export function getGrouped() {
  const items = readItems().filter((i) => !i.done && matchesCurrentSpace(i.spaceId));
  const today = todayStr();
  const weekEnd = addDays(today, 7);
  const overdue = [];
  const dueToday = [];
  const thisWeek = [];
  const upcoming = [];
  const noDate = [];
  items.forEach((item) => {
    if (!item.deadline) {
      noDate.push(item);
    } else if (item.deadline < today) {
      overdue.push(item);
    } else if (item.deadline === today) {
      dueToday.push(item);
    } else if (item.deadline <= weekEnd) {
      thisWeek.push(item);
    } else {
      upcoming.push(item);
    }
  });
  const byDate = (a, b) => a.deadline.localeCompare(b.deadline);
  return {
    overdue: overdue.sort(byDate),
    today: dueToday,
    thisWeek: thisWeek.sort(byDate),
    upcoming: upcoming.sort(byDate),
    noDate,
  };
}
