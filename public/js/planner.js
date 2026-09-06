import { fetchStudyPlan, fetchExamPlan, friendlyErrorMessage } from "./api.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import {
  getGrouped,
  getExamGroups,
  createItem,
  updateItem,
  deleteItem,
  importStudyPlan,
  importExamPlan,
  migrateLegacyExamPlan,
} from "./plannerStore.js";

const examCenter = document.getElementById("plannerExamCenter");

const plannerLists = document.getElementById("plannerLists");
const plannerEmptyState = document.getElementById("plannerEmptyState");

const addItemBtn = document.getElementById("plannerAddItemBtn");
const addItemForm = document.getElementById("plannerAddItemForm");
const addItemTitle = document.getElementById("plannerItemTitle");
const addItemType = document.getElementById("plannerItemType");
const addItemSubject = document.getElementById("plannerItemSubject");
const addItemDeadline = document.getElementById("plannerItemDeadline");
const addItemNotes = document.getElementById("plannerItemNotes");
const addItemSaveBtn = document.getElementById("plannerItemSaveBtn");
const addItemCancelBtn = document.getElementById("plannerItemCancelBtn");

const studyPlanToggleBtn = document.getElementById("plannerStudyPlanToggleBtn");
const studyPlanForm = document.getElementById("plannerStudyPlanForm");
const studyPlanTopic = document.getElementById("plannerStudyTopic");
const studyPlanBuildBtn = document.getElementById("plannerStudyBuildBtn");

const examPlanToggleBtn = document.getElementById("plannerExamPlanToggleBtn");
const examPlanForm = document.getElementById("plannerExamPlanForm");
const examSubjectInput = document.getElementById("plannerExamSubject");
const examTopicsInput = document.getElementById("plannerExamTopics");
const examDateInput = document.getElementById("plannerExamDate");
const examBuildBtn = document.getElementById("plannerExamBuildBtn");

function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

function checkSvg() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
}

function formatDeadline(deadline) {
  if (!deadline) return "";
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderRow(item) {
  const row = document.createElement("div");
  row.className = "plan-task" + (item.done ? " done" : "");
  row.innerHTML = `
    <div class="plan-checkbox${item.done ? " checked" : ""}"></div>
    <div style="flex:1;min-width:0">
      ${item.groupLabel ? `<div class="plan-task-group"></div>` : ""}
      <div class="plan-task-title"></div>
      <div class="plan-task-minutes"></div>
      <div class="plan-task-desc"></div>
    </div>
    <button type="button" class="icon-btn" aria-label="Delete">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>`;
  if (item.groupLabel) row.querySelector(".plan-task-group").textContent = item.dayLabel ? `${item.groupLabel} · ${item.dayLabel}` : item.groupLabel;
  row.querySelector(".plan-task-title").textContent = item.title;
  const parts = [];
  if (item.deadline) parts.push(formatDeadline(item.deadline));
  parts.push(SUBJECT_LABELS[item.subject] || item.subject);
  if (item.estimatedMinutes) parts.push(`${item.estimatedMinutes} min`);
  row.querySelector(".plan-task-minutes").textContent = parts.join(" · ");
  row.querySelector(".plan-task-desc").textContent = item.notes || "";
  const checkbox = row.querySelector(".plan-checkbox");
  checkbox.innerHTML = item.done ? checkSvg() : "";
  checkbox.addEventListener("click", () => {
    updateItem(item.id, { done: !item.done });
    renderAll();
  });
  row.querySelector("button.icon-btn").addEventListener("click", () => {
    deleteItem(item.id);
    renderAll();
    showToast("Removed from planner.", "success", 1500);
  });
  return row;
}

function renderGroup(label, items) {
  if (items.length === 0) return null;
  const wrap = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "planner-group-heading";
  heading.textContent = label;
  wrap.appendChild(heading);
  const list = document.createElement("div");
  list.className = "homework-list";
  items.forEach((item, i) => {
    const row = renderRow(item);
    row.style.animationDelay = `${i * 40}ms`;
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function daysUntilDate(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function renderExamCenter() {
  if (!examCenter) return;
  const exams = getExamGroups();
  examCenter.innerHTML = "";
  if (exams.length === 0) {
    examCenter.hidden = true;
    return;
  }
  examCenter.hidden = false;
  const heading = document.createElement("div");
  heading.className = "section-heading";
  heading.innerHTML = "<h2>📆 Exam Center</h2>";
  examCenter.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "bento";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
  grid.style.gridTemplateAreas = "none";
  exams.forEach((exam) => {
    const days = daysUntilDate(exam.examDate);
    const card = document.createElement("div");
    card.className = "bento-tile";
    card.innerHTML = `
      <div class="bento-tile-eyebrow"></div>
      <div class="bento-tile-title"></div>
      <div class="bento-tile-sub"></div>
      <div class="level-bar-track" style="margin-top:10px"><div class="level-bar-fill" style="width:${exam.pct}%"></div></div>`;
    card.querySelector(".bento-tile-eyebrow").textContent = SUBJECT_LABELS[exam.subject] || exam.subject;
    card.querySelector(".bento-tile-title").textContent = exam.groupLabel;
    card.querySelector(".bento-tile-sub").textContent =
      (days > 0 ? `${days} day${days === 1 ? "" : "s"} to go` : days === 0 ? "Exam is today!" : "Exam date passed") + ` · ${exam.done}/${exam.total} tasks done (${exam.pct}%)`;
    grid.appendChild(card);
  });
  examCenter.appendChild(grid);
}

function renderAll() {
  renderExamCenter();
  const grouped = getGrouped();
  const total = grouped.overdue.length + grouped.today.length + grouped.thisWeek.length + grouped.upcoming.length + grouped.noDate.length;
  plannerEmptyState.hidden = total > 0;
  plannerLists.innerHTML = "";
  if (total === 0) return;
  [
    ["Overdue", grouped.overdue],
    ["Today", grouped.today],
    ["This week", grouped.thisWeek],
    ["Upcoming", grouped.upcoming],
    ["No date", grouped.noDate],
  ].forEach(([label, items]) => {
    const el = renderGroup(label, items);
    if (el) plannerLists.appendChild(el);
  });
}

addItemBtn.addEventListener("click", () => {
  addItemForm.hidden = !addItemForm.hidden;
  if (!addItemForm.hidden) addItemTitle.focus();
});

addItemCancelBtn.addEventListener("click", () => {
  addItemForm.hidden = true;
});

addItemSaveBtn.addEventListener("click", () => {
  const title = addItemTitle.value.trim();
  if (!title) {
    showToast("Give this item a title.", "error");
    addItemTitle.focus();
    return;
  }
  createItem({
    title,
    type: addItemType.value,
    subject: addItemSubject.value,
    deadline: addItemDeadline.value,
    notes: addItemNotes.value,
  });
  addItemTitle.value = "";
  addItemNotes.value = "";
  addItemDeadline.value = "";
  addItemForm.hidden = true;
  renderAll();
  showToast("Added to your planner.", "success");
});

const studyMinutesGroup = document.getElementById("plannerStudyMinutesGroup");
let studyMinutes = 30;
studyMinutesGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    studyMinutes = Number(btn.dataset.value);
    syncSegmented(studyMinutesGroup, btn.dataset.value);
  });
});

studyPlanToggleBtn.addEventListener("click", () => {
  studyPlanForm.hidden = !studyPlanForm.hidden;
  examPlanForm.hidden = true;
});

examPlanToggleBtn.addEventListener("click", () => {
  examPlanForm.hidden = !examPlanForm.hidden;
  studyPlanForm.hidden = true;
});

studyPlanBuildBtn.addEventListener("click", async () => {
  const topic = studyPlanTopic.value.trim();
  if (!topic) {
    showToast("Enter a topic to build a study plan.", "error");
    studyPlanTopic.focus();
    return;
  }
  studyPlanBuildBtn.disabled = true;
  studyPlanBuildBtn.querySelector("span").textContent = "Building…";
  try {
    const plan = await fetchStudyPlan(topic, studyMinutes, appState.subject);
    importStudyPlan(topic, studyMinutes, appState.subject, plan);
    studyPlanTopic.value = "";
    studyPlanForm.hidden = true;
    renderAll();
    showToast("Study plan added to your planner!", "success");
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    studyPlanBuildBtn.disabled = false;
    studyPlanBuildBtn.querySelector("span").textContent = "Build plan";
  }
});

function daysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function mapSubject(freeTextSubject) {
  const known = ["math", "science", "english", "hindi", "tamil"];
  const lower = freeTextSubject.toLowerCase();
  return known.find((k) => lower.includes(k)) || appState.subject;
}

examBuildBtn.addEventListener("click", async () => {
  const subject = examSubjectInput.value.trim();
  const topics = examTopicsInput.value.trim();
  const dateStr = examDateInput.value;
  if (!topics) {
    showToast("List at least one chapter or topic.", "error");
    examTopicsInput.focus();
    return;
  }
  if (!dateStr) {
    showToast("Pick your exam date.", "error");
    examDateInput.focus();
    return;
  }
  let days = daysUntil(dateStr);
  if (days < 1) days = 1;
  if (days > 30) {
    showToast("Study Planner covers up to 30 days ahead — using 30 days.", "error", 3500);
    days = 30;
  }
  examBuildBtn.disabled = true;
  examBuildBtn.querySelector("span").textContent = "Building…";
  try {
    const plan = await fetchExamPlan(topics, days, subject ? mapSubject(subject) : appState.subject);
    importExamPlan(subject || topics, topics, dateStr, days, plan);
    examSubjectInput.value = "";
    examTopicsInput.value = "";
    examDateInput.value = "";
    examPlanForm.hidden = true;
    renderAll();
    showToast("Exam prep plan added to your planner!", "success");
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    examBuildBtn.disabled = false;
    examBuildBtn.querySelector("span").textContent = "Build exam plan";
  }
});

export function initPlanner() {
  migrateLegacyExamPlan();
  renderAll();
}

export function refreshPlanner() {
  renderAll();
}
