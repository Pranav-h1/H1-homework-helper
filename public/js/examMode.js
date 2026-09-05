import { fetchExamPlan, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";
import { showToast } from "./toast.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";

const PLAN_KEY = "h1-exam-plans";

const examSetup = document.getElementById("examSetup");
const examSubjectInput = document.getElementById("examSubjectInput");
const examTopicsInput = document.getElementById("examTopicsInput");
const examDateInput = document.getElementById("examDateInput");
const examBuildBtn = document.getElementById("examBuildBtn");
const examCurrentWrap = document.getElementById("examCurrentWrap");
const examCountdown = document.getElementById("examCountdown");
const examPlanResult = document.getElementById("examPlanResult");
const examNewPlanBtn = document.getElementById("examNewPlanBtn");

function loadStore() {
  return safeGetJson(PLAN_KEY, { current: null, done: {} });
}

function saveStore(store) {
  safeSetJson(PLAN_KEY, store);
}

function daysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / 86400000);
  return diff;
}

function renderCurrentPlan() {
  const store = loadStore();
  if (!store.current) {
    examSetup.hidden = false;
    examCurrentWrap.hidden = true;
    return;
  }

  examSetup.hidden = true;
  examCurrentWrap.hidden = false;

  const remaining = daysUntil(store.current.examDate);
  const dateLabel = new Date(store.current.examDate + "T00:00:00").toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (remaining > 0) {
    examCountdown.textContent = `📅 ${remaining} day${remaining === 1 ? "" : "s"} until your ${store.current.subject || "exam"} exam (${dateLabel})`;
  } else if (remaining === 0) {
    examCountdown.textContent = `📅 Your ${store.current.subject || "exam"} exam is today! Good luck.`;
  } else {
    examCountdown.textContent = `Your ${store.current.subject || "exam"} exam date (${dateLabel}) has passed.`;
  }

  examPlanResult.innerHTML = "";
  store.current.plan.forEach((day) => {
    const card = document.createElement("div");
    card.className = "exam-day-card";
    const doneCount = day.tasks.filter((_, i) => store.done[`${store.current.id}::${day.day}::${i}`]).length;
    card.innerHTML = `
      <div class="exam-day-header">
        <strong>Day ${day.day} — ${day.focus}</strong>
        <span class="exam-day-progress"></span>
      </div>
      <div class="note-checklist"></div>`;
    card.querySelector(".exam-day-progress").textContent = `${doneCount}/${day.tasks.length} done`;
    const list = card.querySelector(".note-checklist");
    day.tasks.forEach((task, i) => {
      const key = `${store.current.id}::${day.day}::${i}`;
      const row = document.createElement("div");
      row.className = "checklist-item" + (store.done[key] ? " done" : "");
      row.innerHTML = `<input type="checkbox" ${store.done[key] ? "checked" : ""} /><span style="flex:1;font-size:13px"></span>`;
      row.querySelector("span").textContent = task;
      row.querySelector("input").addEventListener("change", (e) => {
        const s = loadStore();
        s.done[key] = e.target.checked;
        saveStore(s);
        row.classList.toggle("done", e.target.checked);
        card.querySelector(".exam-day-progress").textContent = `${day.tasks.filter((_, ii) => s.done[`${store.current.id}::${day.day}::${ii}`]).length}/${day.tasks.length} done`;
        if (e.target.checked) logEvent("plan_task_done", { title: task, source: "exam" });
      });
      list.appendChild(row);
    });
    examPlanResult.appendChild(card);
  });
}

async function buildPlan() {
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
    showToast("Exam Mode plans up to 30 days ahead — using 30 days.", "error", 3500);
    days = 30;
  }

  examBuildBtn.disabled = true;
  examBuildBtn.querySelector("span").textContent = "Building…";
  try {
    const plan = await fetchExamPlan(topics, days, subject ? mapSubject(subject) : appState.subject);
    const store = loadStore();
    store.current = {
      id: `exam_${Date.now()}`,
      subject,
      topics,
      examDate: dateStr,
      plan,
      createdAt: Date.now(),
    };
    saveStore(store);
    renderCurrentPlan();
    showToast("Exam plan ready!", "success");
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    examBuildBtn.disabled = false;
    examBuildBtn.querySelector("span").textContent = "Build Exam Plan";
  }
}

// Exam Mode's subject is a free-text field (e.g. "Biology"), while the AI backend only
// understands the app's fixed subject keys — fall back to the global subject selection.
function mapSubject(freeTextSubject) {
  const known = ["math", "science", "english", "hindi", "tamil"];
  const lower = freeTextSubject.toLowerCase();
  return known.find((k) => lower.includes(k)) || appState.subject;
}

examBuildBtn.addEventListener("click", buildPlan);

examNewPlanBtn.addEventListener("click", () => {
  const store = loadStore();
  store.current = null;
  saveStore(store);
  examSubjectInput.value = "";
  examTopicsInput.value = "";
  examDateInput.value = "";
  renderCurrentPlan();
});

export function initExamMode() {
  renderCurrentPlan();
}
