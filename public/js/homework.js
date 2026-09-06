import { SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";
import { createTask, updateTask, deleteTask, getTasks } from "./homeworkStore.js";
import { matchesCurrentSpace } from "./spacesStore.js";

const searchInput = document.getElementById("homeworkSearch");
const statusFilter = document.getElementById("homeworkStatusFilter");
const subjectFilter = document.getElementById("homeworkSubjectFilter");
const sortSelect = document.getElementById("homeworkSortSelect");
const addBtn = document.getElementById("homeworkAddBtn");
const form = document.getElementById("homeworkForm");
const titleInput = document.getElementById("hwTitleInput");
const subjectInput = document.getElementById("hwSubjectInput");
const deadlineInput = document.getElementById("hwDeadlineInput");
const priorityGroup = document.getElementById("hwPriorityGroup");
const difficultyGroup = document.getElementById("hwDifficultyGroup");
const minutesInput = document.getElementById("hwMinutesInput");
const notesInput = document.getElementById("hwNotesInput");
const saveBtn = document.getElementById("hwSaveBtn");
const cancelBtn = document.getElementById("hwCancelBtn");
const listEl = document.getElementById("homeworkList");
const emptyState = document.getElementById("homeworkEmptyState");

let editingId = null;
let priority = "medium";
let difficulty = "medium";

function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

priorityGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    priority = btn.dataset.value;
    syncSegmented(priorityGroup, priority);
  });
});
difficultyGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.value;
    syncSegmented(difficultyGroup, difficulty);
  });
});

function resetForm() {
  editingId = null;
  titleInput.value = "";
  subjectInput.value = "general";
  deadlineInput.value = "";
  minutesInput.value = "";
  notesInput.value = "";
  priority = "medium";
  difficulty = "medium";
  syncSegmented(priorityGroup, priority);
  syncSegmented(difficultyGroup, difficulty);
  saveBtn.textContent = "Add task";
}

function openFormForNew() {
  resetForm();
  form.hidden = false;
  titleInput.focus();
}

function openFormForEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  subjectInput.value = task.subject;
  deadlineInput.value = task.deadline;
  minutesInput.value = task.estimatedMinutes || "";
  notesInput.value = task.notes;
  priority = task.priority;
  difficulty = task.difficulty;
  syncSegmented(priorityGroup, priority);
  syncSegmented(difficultyGroup, difficulty);
  saveBtn.textContent = "Save changes";
  form.hidden = false;
  titleInput.focus();
}

addBtn.addEventListener("click", () => {
  if (!form.hidden && !editingId) {
    form.hidden = true;
    return;
  }
  openFormForNew();
});

cancelBtn.addEventListener("click", () => {
  form.hidden = true;
});

saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  if (!title) {
    showToast("Give this task a title.", "error");
    titleInput.focus();
    return;
  }
  const payload = {
    title,
    subject: subjectInput.value,
    deadline: deadlineInput.value,
    priority,
    difficulty,
    estimatedMinutes: minutesInput.value,
    notes: notesInput.value,
  };
  if (editingId) {
    updateTask(editingId, payload);
    showToast("Task updated.", "success");
  } else {
    createTask(payload);
    showToast("Task added.", "success");
  }
  form.hidden = true;
  renderList();
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function taskCard(task) {
  const today = todayStr();
  const overdue = task.status !== "done" && task.deadline && task.deadline < today;
  const card = document.createElement("div");
  card.className = "homework-card" + (task.status === "done" ? " done" : "") + (overdue ? " overdue" : "");
  card.innerHTML = `
    <div class="plan-checkbox${task.status === "done" ? " checked" : ""}"></div>
    <div class="homework-main">
      <div class="homework-title"></div>
      <div class="homework-meta"></div>
      <div class="homework-notes"></div>
    </div>
    <div class="homework-actions">
      <button type="button" class="icon-btn" aria-label="Edit">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
      </button>
      <button type="button" class="icon-btn" aria-label="Delete">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>`;
  card.querySelector(".homework-title").textContent = task.title;
  card.querySelector(".homework-notes").textContent = task.notes || "";

  const meta = card.querySelector(".homework-meta");
  const badges = [];
  badges.push(`<span class="homework-badge">${SUBJECT_LABELS[task.subject] || task.subject}</span>`);
  if (task.deadline) {
    const label = new Date(task.deadline + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
    badges.push(`<span class="homework-badge${overdue ? " overdue" : ""}">${overdue ? "Overdue " : "Due "}${label}</span>`);
  }
  badges.push(`<span class="homework-badge priority-${task.priority}">${task.priority} priority</span>`);
  if (task.estimatedMinutes) badges.push(`<span class="homework-badge">${task.estimatedMinutes} min</span>`);
  meta.innerHTML = badges.join("");

  const checkbox = card.querySelector(".plan-checkbox");
  checkbox.innerHTML =
    task.status === "done"
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : "";
  checkbox.addEventListener("click", () => {
    updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });
    renderList();
  });

  card.querySelectorAll(".homework-actions .icon-btn")[0].addEventListener("click", () => openFormForEdit(task));
  card.querySelectorAll(".homework-actions .icon-btn")[1].addEventListener("click", () => {
    confirmDanger("Delete this task?", `"${task.title}" will be removed.`, "Delete", () => {
      deleteTask(task.id);
      renderList();
      showToast("Task deleted.", "success", 1500);
    });
  });

  return card;
}

function renderList() {
  let tasks = getTasks().filter((t) => matchesCurrentSpace(t.spaceId));
  const query = searchInput.value.trim().toLowerCase();
  if (query) tasks = tasks.filter((t) => t.title.toLowerCase().includes(query) || t.notes.toLowerCase().includes(query));
  if (statusFilter.value === "open") tasks = tasks.filter((t) => t.status !== "done");
  if (statusFilter.value === "done") tasks = tasks.filter((t) => t.status === "done");
  if (subjectFilter.value !== "all") tasks = tasks.filter((t) => t.subject === subjectFilter.value);

  const sort = sortSelect.value;
  tasks = [...tasks].sort((a, b) => {
    if (sort === "deadline") return (a.deadline || "9999") .localeCompare(b.deadline || "9999");
    if (sort === "priority") {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }
    return b.createdAt - a.createdAt;
  });

  listEl.innerHTML = "";
  emptyState.hidden = tasks.length > 0;
  tasks.forEach((t, i) => {
    const card = taskCard(t);
    card.style.animationDelay = `${i * 30}ms`;
    listEl.appendChild(card);
  });
}

[searchInput, statusFilter, subjectFilter, sortSelect].forEach((el) => {
  el.addEventListener("input", renderList);
  el.addEventListener("change", renderList);
});

export function initHomework() {
  resetForm();
  renderList();
}

export function refreshHomework() {
  renderList();
}
