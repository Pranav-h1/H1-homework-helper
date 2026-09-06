import { getItems as getPlannerItems, updateItem as updatePlannerItem } from "./plannerStore.js";
import { getTasks as getHomeworkTasks, updateTask as updateHomeworkTask } from "./homeworkStore.js";
import { getEvents } from "./progress.js";
import { switchView } from "./nav.js";

const monthLabel = document.getElementById("calendarMonthLabel");
const grid = document.getElementById("calendarGrid");
const agenda = document.getElementById("calendarAgenda");
const prevBtn = document.getElementById("calendarPrevBtn");
const nextBtn = document.getElementById("calendarNextBtn");
const todayBtn = document.getElementById("calendarTodayBtn");

let cursor = new Date();
cursor.setDate(1);
let selectedDate = new Date().toISOString().slice(0, 10);

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildDayIndex() {
  const index = {};
  function add(dateStr, entry) {
    if (!dateStr) return;
    if (!index[dateStr]) index[dateStr] = [];
    index[dateStr].push(entry);
  }
  getPlannerItems().forEach((item) => {
    if (item.deadline) add(item.deadline, { kind: item.type === "exam" ? "exam" : item.type === "study" ? "study" : "plan", label: item.title, source: "planner", id: item.id, done: item.done, item });
  });
  getHomeworkTasks().forEach((task) => {
    if (task.deadline) add(task.deadline, { kind: "homework", label: task.title, source: "homework", id: task.id, done: task.status === "done", item: task });
  });
  getEvents()
    .filter((e) => e.type === "study_session" && e.minutes)
    .forEach((e) => {
      add(dateKey(new Date(e.ts)), { kind: "study", label: `Focus session (${e.minutes} min)`, source: "session" });
    });
  return index;
}

function renderMonth() {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  monthLabel.textContent = cursor.toLocaleDateString([], { month: "long", year: "numeric" });

  const dayIndex = buildDayIndex();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  grid.innerHTML = "";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((w) => {
    const el = document.createElement("div");
    el.className = "calendar-weekday";
    el.textContent = w;
    grid.appendChild(el);
  });

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const cellDate = new Date(year, month, dayNum);
    const key = dateKey(cellDate);
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (dayNum < 1 || dayNum > daysInMonth) cell.classList.add("other-month");
    if (key === todayKey) cell.classList.add("today");
    if (key === selectedDate) cell.classList.add("selected");
    cell.innerHTML = `<span class="calendar-day-num"></span><span class="calendar-day-dot-row"></span>`;
    cell.querySelector(".calendar-day-num").textContent = cellDate.getDate();
    const dotRow = cell.querySelector(".calendar-day-dot-row");
    (dayIndex[key] || []).slice(0, 4).forEach((entry) => {
      const dot = document.createElement("span");
      dot.className = `calendar-dot ${entry.kind}`;
      dotRow.appendChild(dot);
    });
    cell.addEventListener("click", () => {
      selectedDate = key;
      renderMonth();
      renderAgenda(dayIndex[key] || [], cellDate);
    });
    grid.appendChild(cell);
  }

  renderAgenda(dayIndex[selectedDate] || [], new Date(selectedDate + "T00:00:00"));
}

function renderAgenda(entries, date) {
  agenda.innerHTML = "";
  const heading = document.createElement("div");
  heading.className = "planner-group-heading";
  heading.textContent = date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  agenda.appendChild(heading);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "view-sub";
    empty.textContent = "Nothing scheduled for this day.";
    agenda.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "plan-task" + (entry.done ? " done" : "");
    const icon = { exam: "📆", homework: "📘", study: "⏱️", plan: "🗓️" }[entry.kind] || "🗓️";
    row.innerHTML = `<div style="font-size:18px">${icon}</div><div style="flex:1;min-width:0"><div class="plan-task-title"></div></div>`;
    row.querySelector(".plan-task-title").textContent = entry.label;
    if (entry.source === "planner" || entry.source === "homework") {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        if (entry.source === "planner") {
          updatePlannerItem(entry.id, { done: !entry.done });
          switchView("planner");
        } else {
          updateHomeworkTask(entry.id, { status: entry.done ? "todo" : "done" });
          switchView("homework");
        }
      });
    }
    agenda.appendChild(row);
  });
}

prevBtn.addEventListener("click", () => {
  cursor.setMonth(cursor.getMonth() - 1);
  renderMonth();
});
nextBtn.addEventListener("click", () => {
  cursor.setMonth(cursor.getMonth() + 1);
  renderMonth();
});
todayBtn.addEventListener("click", () => {
  cursor = new Date();
  cursor.setDate(1);
  selectedDate = dateKey(new Date());
  renderMonth();
});

export function initCalendar() {
  renderMonth();
}

export function refreshCalendar() {
  renderMonth();
}
