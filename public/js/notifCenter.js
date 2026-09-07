// A real notification center — every row is computed fresh from actual stored data each time
// the panel opens, never a persisted log that could drift out of sync or accumulate fake
// "unread" state. The badge count is simply "how many real things need attention right now".
import { switchView } from "./nav.js";
import { getGrouped as getPlannerGrouped, getExamGroups } from "./plannerStore.js";
import { getTodayAndUpcoming } from "./homeworkStore.js";
import { getTotalDueCount } from "./flashcardDecks.js";
import { getMistakePatterns } from "./mistakeBookStore.js";

const btn = document.getElementById("notifCenterBtn");
const popover = document.getElementById("notifCenterPopover");
const list = document.getElementById("notifCenterList");
const badge = document.getElementById("notifCenterBadge");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr).getTime() - new Date(todayStr()).getTime()) / 86400000);
}

// Every entry here reflects something real and currently true — nothing is invented, and
// nothing is shown "because it might be interesting" (see H1's no-fake-features rule).
function buildNotifications() {
  const items = [];

  const planner = getPlannerGrouped();
  if (planner.overdue.length > 0) {
    items.push({
      icon: "⏰",
      title: `${planner.overdue.length} overdue planner item${planner.overdue.length === 1 ? "" : "s"}`,
      sub: planner.overdue[0].title,
      view: "planner",
    });
  }
  if (planner.today.length > 0) {
    items.push({
      icon: "📅",
      title: `${planner.today.length} planner item${planner.today.length === 1 ? "" : "s"} due today`,
      sub: planner.today[0].title,
      view: "planner",
    });
  }

  // getTodayAndUpcoming() already excludes completed tasks (status === "done").
  const homework = getTodayAndUpcoming(50).filter((t) => t.overdue || t.deadline === todayStr());
  if (homework.length > 0) {
    items.push({
      icon: "📘",
      title: `${homework.length} homework task${homework.length === 1 ? "" : "s"} due today or overdue`,
      sub: homework[0].title,
      view: "homework",
    });
  }

  const dueFlashcards = getTotalDueCount();
  if (dueFlashcards > 0) {
    items.push({
      icon: "🗂️",
      title: `${dueFlashcards} flashcard${dueFlashcards === 1 ? "" : "s"} due for review`,
      sub: "Spaced-repetition review is ready.",
      view: "flashcards",
    });
  }

  const nearExam = getExamGroups().find((e) => e.examDate >= todayStr() && daysUntil(e.examDate) <= 7);
  if (nearExam) {
    const days = daysUntil(nearExam.examDate);
    items.push({
      icon: "🎯",
      title: `${nearExam.groupLabel || "Exam"} in ${days} day${days === 1 ? "" : "s"}`,
      sub: `${nearExam.pct}% of prep tasks done`,
      view: "planner",
    });
  }

  const patterns = getMistakePatterns();
  if (patterns.length > 0) {
    items.push({
      icon: "🧠",
      title: `Recurring mistakes on "${patterns[0].topic}"`,
      sub: `Missed ${patterns[0].count} times — worth revisiting.`,
      view: "progress",
    });
  }

  return items;
}

function render() {
  const items = buildNotifications();
  badge.hidden = items.length === 0;
  badge.textContent = String(items.length);

  list.innerHTML = "";
  if (items.length === 0) {
    list.innerHTML = '<div class="notif-center-empty">You\'re all caught up! 🎉</div>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "notif-row";
    row.innerHTML = `<span class="notif-row-icon"></span><span class="notif-row-text"><span class="notif-row-title"></span><span class="notif-row-sub"></span></span>`;
    row.querySelector(".notif-row-icon").textContent = item.icon;
    row.querySelector(".notif-row-title").textContent = item.title;
    row.querySelector(".notif-row-sub").textContent = item.sub;
    row.addEventListener("click", () => {
      switchView(item.view);
      closePopover();
    });
    list.appendChild(row);
  });
}

function openPopover() {
  render();
  popover.hidden = false;
  btn.setAttribute("aria-expanded", "true");
}

function closePopover() {
  popover.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}

btn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (popover.hidden) openPopover();
  else closePopover();
});
popover.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => closePopover());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !popover.hidden) closePopover();
});

export function initNotifCenter() {
  render();
}

// Refreshed whenever the student switches views, so the badge count stays honest without
// polling — cheap since it's just a handful of localStorage reads.
export function refreshNotifCenter() {
  if (!popover.hidden) render();
  else {
    const items = buildNotifications();
    badge.hidden = items.length === 0;
    badge.textContent = String(items.length);
  }
}
