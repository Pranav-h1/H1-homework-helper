import { getStats } from "./progress.js";
import { isEnabled, getXP, getLevel, getAchievements } from "./gamification.js";
import { SUBJECT_LABELS } from "./state.js";
import { safeGet, safeSet } from "./storage.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalProgress,
  getDailyGoalMinutes,
  setDailyGoalMinutes,
} from "./goalsStore.js";
import { matchesCurrentSpace } from "./spacesStore.js";

const NAME_KEY = "h1-display-name";

const avatarEl = document.getElementById("profileAvatar");
const nameEl = document.getElementById("profileName");
const nameInput = document.getElementById("profileNameInput");
const levelCard = document.getElementById("profileLevelCard");
const statsGrid = document.getElementById("profileStatsGrid");
const favoriteSubjects = document.getElementById("profileFavoriteSubjects");
const achievementsPreview = document.getElementById("profileAchievementsPreview");
const dailyGoalInput = document.getElementById("profileDailyGoalInput");
const goalsList = document.getElementById("profileGoalsList");
const addGoalBtn = document.getElementById("profileAddGoalBtn");
const addGoalForm = document.getElementById("profileGoalForm");
const goalTitleInput = document.getElementById("profileGoalTitle");
const goalTypeInput = document.getElementById("profileGoalType");
const goalSubjectInput = document.getElementById("profileGoalSubject");
const goalMinutesInput = document.getElementById("profileGoalMinutes");
const goalDeadlineInput = document.getElementById("profileGoalDeadline");
const goalSaveBtn = document.getElementById("profileGoalSaveBtn");
const goalCancelBtn = document.getElementById("profileGoalCancelBtn");

function statCard(value, label) {
  const el = document.createElement("div");
  el.className = "progress-stat-card";
  el.innerHTML = `<div class="progress-stat-value"></div><div class="progress-stat-label"></div>`;
  el.querySelector(".progress-stat-value").textContent = value;
  el.querySelector(".progress-stat-label").textContent = label;
  return el;
}

function renderIdentity() {
  const name = safeGet(NAME_KEY, "Student");
  if (nameEl) nameEl.textContent = name;
  if (nameInput) nameInput.value = name === "Student" ? "" : name;
  if (avatarEl) avatarEl.textContent = name.trim().slice(0, 1).toUpperCase() || "S";
}

if (nameInput) {
  nameInput.addEventListener("change", () => {
    const value = nameInput.value.trim() || "Student";
    safeSet(NAME_KEY, value);
    renderIdentity();
  });
}

function renderLevel(stats) {
  if (!levelCard) return;
  if (!isEnabled()) {
    levelCard.hidden = true;
    return;
  }
  levelCard.hidden = false;
  const xp = getXP();
  const { level, nextThreshold, progressPct } = getLevel(xp);
  levelCard.innerHTML = `
    <div class="status-row"><span>Level ${level}</span><span></span></div>
    <div class="level-bar-track"><div class="level-bar-fill" style="width:${progressPct}%"></div></div>
    <div class="profile-streak-row">🔥 ${stats.streak} day streak</div>`;
  levelCard.querySelector(".status-row span:last-child").textContent = nextThreshold ? `${xp} / ${nextThreshold} XP` : `${xp} XP (max level)`;
}

function renderStats(stats) {
  if (!statsGrid) return;
  statsGrid.innerHTML = "";
  statsGrid.appendChild(statCard(stats.totalQuestions, "Questions asked"));
  statsGrid.appendChild(statCard(stats.quizzesCompleted, "Quizzes completed"));
  statsGrid.appendChild(statCard(stats.avgScorePct === null ? "—" : `${stats.avgScorePct}%`, "Avg quiz score"));
  statsGrid.appendChild(statCard(stats.studyMinutes, "Study minutes"));
  statsGrid.appendChild(statCard(stats.homeworkCompleted || 0, "Homework done"));
  statsGrid.appendChild(statCard(stats.notesCreated, "Notes created"));
}

function renderFavoriteSubjects(stats) {
  if (!favoriteSubjects) return;
  const top = stats.subjectStats.filter((s) => s.subject !== "general" && (s.questions > 0 || s.quizzes > 0)).slice(0, 3);
  favoriteSubjects.innerHTML = "";
  if (top.length === 0) {
    favoriteSubjects.innerHTML = '<p class="context-empty">Study a subject a few times to see your favorites here.</p>';
    return;
  }
  top.forEach((s) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.cursor = "default";
    chip.textContent = SUBJECT_LABELS[s.subject] || s.subject;
    favoriteSubjects.appendChild(chip);
  });
}

function renderAchievementsPreview() {
  if (!achievementsPreview) return;
  const achievements = getAchievements();
  const earned = achievements.filter((a) => a.earned);
  achievementsPreview.innerHTML = "";
  if (earned.length === 0) {
    achievementsPreview.innerHTML = '<p class="context-empty">No badges unlocked yet — they\'ll show up here.</p>';
    return;
  }
  earned.slice(0, 6).forEach((a) => {
    const badge = document.createElement("div");
    badge.className = "achievement-card earned";
    badge.style.padding = "12px 6px";
    badge.innerHTML = `<div class="achievement-icon"></div><div class="achievement-title"></div>`;
    badge.querySelector(".achievement-icon").textContent = a.icon;
    badge.querySelector(".achievement-title").textContent = a.title;
    achievementsPreview.appendChild(badge);
  });
}

function goalTypeLabel(type) {
  return { daily: "Daily goal", weekly: "Weekly goal", subject: "Subject goal", exam: "Exam goal" }[type] || type;
}

function renderGoals() {
  if (!goalsList) return;
  const goals = getGoals().filter((g) => matchesCurrentSpace(g.spaceId));
  goalsList.innerHTML = "";
  if (goals.length === 0) {
    goalsList.innerHTML = '<p class="context-empty">No goals yet — add one below.</p>';
    return;
  }
  goals.forEach((g) => {
    const progress = getGoalProgress(g);
    const row = document.createElement("div");
    row.className = "plan-task" + (g.done ? " done" : "");
    const needsCheckbox = g.type === "subject" || g.type === "exam";
    row.innerHTML = `
      ${needsCheckbox ? `<div class="plan-checkbox${g.done ? " checked" : ""}"></div>` : `<div style="width:24px;text-align:center;font-size:11px;color:var(--text-faint);padding-top:4px">${progress.pct}%</div>`}
      <div style="flex:1;min-width:0">
        <div class="plan-task-group"></div>
        <div class="plan-task-title"></div>
        <div class="plan-task-minutes"></div>
      </div>
      <button type="button" class="icon-btn" aria-label="Delete">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`;
    row.querySelector(".plan-task-group").textContent = goalTypeLabel(g.type);
    row.querySelector(".plan-task-title").textContent = g.title;
    row.querySelector(".plan-task-minutes").textContent =
      g.type === "daily" || g.type === "weekly" ? `${progress.current}/${progress.target} min` : SUBJECT_LABELS[g.subject] || g.subject;
    if (needsCheckbox) {
      row.querySelector(".plan-checkbox").addEventListener("click", () => {
        updateGoal(g.id, { done: !g.done });
        renderGoals();
      });
    }
    row.querySelector(".icon-btn").addEventListener("click", () => {
      confirmDanger("Delete this goal?", `"${g.title}" will be removed.`, "Delete", () => {
        deleteGoal(g.id);
        renderGoals();
      });
    });
    goalsList.appendChild(row);
  });
}

if (dailyGoalInput) {
  dailyGoalInput.value = getDailyGoalMinutes();
  dailyGoalInput.addEventListener("change", () => {
    setDailyGoalMinutes(Number(dailyGoalInput.value) || 20);
    showToast("Daily goal updated.", "success", 1500);
  });
}

if (addGoalBtn) {
  addGoalBtn.addEventListener("click", () => {
    addGoalForm.hidden = !addGoalForm.hidden;
  });
}
if (goalCancelBtn) goalCancelBtn.addEventListener("click", () => (addGoalForm.hidden = true));
if (goalSaveBtn) {
  goalSaveBtn.addEventListener("click", () => {
    const title = goalTitleInput.value.trim();
    if (!title) {
      showToast("Give this goal a title.", "error");
      return;
    }
    createGoal({
      title,
      type: goalTypeInput.value,
      subject: goalSubjectInput.value,
      targetMinutes: goalMinutesInput.value,
      deadline: goalDeadlineInput.value,
    });
    goalTitleInput.value = "";
    addGoalForm.hidden = true;
    renderGoals();
    showToast("Goal added.", "success");
  });
}

export function renderProfile() {
  const stats = getStats();
  renderIdentity();
  renderLevel(stats);
  renderStats(stats);
  renderFavoriteSubjects(stats);
  renderAchievementsPreview();
  renderGoals();
}

export function initProfile() {
  renderProfile();
}
