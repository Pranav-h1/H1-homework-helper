import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";
import { getTodayAndUpcoming } from "./homeworkStore.js";

const setupWrap = document.getElementById("studySetupWrap");
const runningWrap = document.getElementById("studyRunningWrap");
const taskInput = document.getElementById("studyTaskInput");
const taskSuggestions = document.getElementById("studyTaskSuggestions");
const durationGroup = document.getElementById("studyDuration");
const breakToggle = document.getElementById("studyAutoBreakToggle");
const startBtn = document.getElementById("studyStartBtn");
const pauseBtn = document.getElementById("studyPauseBtn");
const stopBtn = document.getElementById("studyStopBtn");
const ring = document.getElementById("studyTimerRing");
const timeText = document.getElementById("studyTimerTime");
const timeLabel = document.getElementById("studyTimerLabel");
const metaTask = document.getElementById("studyMetaTask");
const metaSubject = document.getElementById("studyMetaSubject");
const cycleRow = document.getElementById("studyCycleRow");

const BREAK_MINUTES = 5;

let durationMinutes = 10;
let totalSeconds = 0;
let remainingSeconds = 0;
let intervalId = null;
let paused = false;
let currentTask = "";
let onBreak = false;
let autoBreakEnabled = true;

durationGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    durationMinutes = Number(btn.dataset.value);
    durationGroup.querySelectorAll(".segmented-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
});

function wireToggle(el, onChange) {
  function apply(on) {
    el.classList.toggle("on", on);
    el.setAttribute("aria-checked", String(on));
  }
  let on = true;
  apply(on);
  el.addEventListener("click", () => {
    on = !on;
    apply(on);
    onChange(on);
  });
}
wireToggle(breakToggle, (on) => {
  autoBreakEnabled = on;
});

function renderSuggestions() {
  const tasks = getTodayAndUpcoming(5);
  taskSuggestions.innerHTML = "";
  taskSuggestions.hidden = tasks.length === 0;
  tasks.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = t.title;
    chip.addEventListener("click", () => {
      taskInput.value = t.title;
    });
    taskSuggestions.appendChild(chip);
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function tick() {
  if (paused) return;
  remainingSeconds -= 1;
  const elapsedPct = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  ring.style.setProperty("--pct", Math.min(100, elapsedPct));
  timeText.textContent = formatTime(Math.max(0, remainingSeconds));
  if (remainingSeconds <= 0) {
    if (onBreak) finishBreak();
    else finishSession(true);
  }
}

function startSession() {
  const task = taskInput.value.trim() || "Focus session";
  currentTask = task;
  onBreak = false;
  totalSeconds = durationMinutes * 60;
  remainingSeconds = totalSeconds;
  paused = false;
  metaTask.textContent = task;
  metaSubject.textContent = SUBJECT_LABELS[appState.subject] || "General";
  timeText.textContent = formatTime(remainingSeconds);
  timeLabel.textContent = "remaining";
  ring.classList.remove("on-break");
  ring.style.setProperty("--pct", 0);
  pauseBtn.textContent = "Pause";
  cycleRow.innerHTML = '<span class="focus-cycle-badge active">Focus</span><span class="focus-cycle-badge">Break</span>';
  setupWrap.hidden = true;
  runningWrap.hidden = false;
  clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
}

function startBreak() {
  onBreak = true;
  totalSeconds = BREAK_MINUTES * 60;
  remainingSeconds = totalSeconds;
  paused = false;
  metaTask.textContent = "Break time";
  timeLabel.textContent = "remaining";
  ring.classList.add("on-break");
  ring.style.setProperty("--pct", 0);
  pauseBtn.textContent = "Pause";
  cycleRow.innerHTML = '<span class="focus-cycle-badge">Focus</span><span class="focus-cycle-badge active">Break</span>';
  clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
}

function finishBreak() {
  clearInterval(intervalId);
  intervalId = null;
  runningWrap.hidden = true;
  setupWrap.hidden = false;
  onBreak = false;
  logEvent("focus_break_completed", { minutes: BREAK_MINUTES });
  showToast("Break's over — ready for another focus session? 🙂", "success", 4000);
}

function finishSession(completed) {
  clearInterval(intervalId);
  intervalId = null;

  const elapsedSeconds = totalSeconds - Math.max(0, remainingSeconds);
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes >= 1) {
    logEvent("study_session", { minutes: elapsedMinutes, task: currentTask, completed });
  }

  if (completed && autoBreakEnabled) {
    showToast("Focus session complete — starting a 5 min break 🎉", "success", 3500);
    startBreak();
    return;
  }

  runningWrap.hidden = true;
  setupWrap.hidden = false;
  renderSuggestions();

  if (completed) {
    showToast("Focus session complete — nice work! 🎉", "success", 4000);
  } else if (elapsedMinutes >= 1) {
    showToast(`Session ended — ${elapsedMinutes} min logged.`, "success", 3000);
  }
}

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  timeLabel.textContent = paused ? "paused" : "remaining";
});

stopBtn.addEventListener("click", () => {
  if (onBreak) {
    clearInterval(intervalId);
    intervalId = null;
    runningWrap.hidden = true;
    setupWrap.hidden = false;
    onBreak = false;
    renderSuggestions();
    return;
  }
  finishSession(false);
});
startBtn.addEventListener("click", startSession);

export function initStudyMode() {
  renderSuggestions();
}
