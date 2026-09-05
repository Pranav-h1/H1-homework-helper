import { appState } from "./state.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";

const SUBJECT_LABELS = { general: "General", math: "Math", science: "Science", english: "English", hindi: "Hindi", tamil: "Tamil" };

const setupWrap = document.getElementById("studySetupWrap");
const runningWrap = document.getElementById("studyRunningWrap");
const taskInput = document.getElementById("studyTaskInput");
const durationGroup = document.getElementById("studyDuration");
const startBtn = document.getElementById("studyStartBtn");
const pauseBtn = document.getElementById("studyPauseBtn");
const stopBtn = document.getElementById("studyStopBtn");
const ring = document.getElementById("studyTimerRing");
const timeText = document.getElementById("studyTimerTime");
const timeLabel = document.getElementById("studyTimerLabel");
const metaTask = document.getElementById("studyMetaTask");
const metaSubject = document.getElementById("studyMetaSubject");

let durationMinutes = 10;
let totalSeconds = 0;
let remainingSeconds = 0;
let intervalId = null;
let paused = false;
let currentTask = "";

durationGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    durationMinutes = Number(btn.dataset.value);
    durationGroup.querySelectorAll(".segmented-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
});

function formatTime(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function tick() {
  if (paused) return;
  remainingSeconds -= 1;
  const elapsedPct = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  ring.style.setProperty("--pct", Math.min(100, elapsedPct));
  timeText.textContent = formatTime(Math.max(0, remainingSeconds));
  if (remainingSeconds <= 0) {
    finishSession(true);
  }
}

function startSession() {
  const task = taskInput.value.trim() || "Focus session";
  currentTask = task;
  totalSeconds = durationMinutes * 60;
  remainingSeconds = totalSeconds;
  paused = false;
  metaTask.textContent = task;
  metaSubject.textContent = SUBJECT_LABELS[appState.subject] || "General";
  timeText.textContent = formatTime(remainingSeconds);
  timeLabel.textContent = "remaining";
  ring.style.setProperty("--pct", 0);
  pauseBtn.textContent = "Pause";
  setupWrap.hidden = true;
  runningWrap.hidden = false;
  clearInterval(intervalId);
  intervalId = setInterval(tick, 1000);
}

function finishSession(completed) {
  clearInterval(intervalId);
  intervalId = null;
  runningWrap.hidden = true;
  setupWrap.hidden = false;

  const elapsedSeconds = totalSeconds - Math.max(0, remainingSeconds);
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes >= 1) {
    logEvent("study_session", { minutes: elapsedMinutes, task: currentTask, completed });
  }

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

stopBtn.addEventListener("click", () => finishSession(false));
startBtn.addEventListener("click", startSession);

export function initStudyMode() {
  // nothing to prime — setup form is ready by default
}
