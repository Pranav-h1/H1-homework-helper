import { getStats, getHeatmapDays, getWeeklyStats } from "./progress.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { isEnabled, getXP, getLevel, getAchievements } from "./gamification.js";
import { switchView } from "./nav.js";
import { getDecks, getDueCount } from "./flashcardDecks.js";
import { getMistakes, getMistakePatterns, deleteMistake } from "./mistakeBookStore.js";
import { getGrouped as getPlannerGrouped } from "./plannerStore.js";
import { startQuizWithTopic } from "./quiz.js";
import { confirmDanger } from "./modal.js";

const container = document.getElementById("progressContent");

function statCard(value, label) {
  const card = document.createElement("div");
  card.className = "progress-stat-card";
  card.innerHTML = `<div class="progress-stat-value"></div><div class="progress-stat-label"></div>`;
  card.querySelector(".progress-stat-value").textContent = value;
  card.querySelector(".progress-stat-label").textContent = label;
  return card;
}

// A real recommendation, derived from actually-stored data — never a fabricated "you should
// study X" with nothing behind it.
function buildRevisionCenter(stats) {
  const card = document.createElement("div");
  card.className = "bento-tile";
  card.style.background = "var(--accent-grad-soft)";
  card.style.borderColor = "rgba(124, 92, 255, 0.3)";
  card.style.marginBottom = "20px";

  const dueFlashcards = getDecks().reduce((sum, d) => sum + getDueCount(d), 0);
  const patterns = getMistakePatterns();
  const plannerOverdue = getPlannerGrouped().overdue.length;

  let rec;
  if (dueFlashcards > 0) {
    rec = { text: `You have ${dueFlashcards} flashcard${dueFlashcards === 1 ? "" : "s"} due for review.`, action: "Review now", run: () => switchView("flashcards") };
  } else if (stats.weakTopics.length > 0) {
    const t = stats.weakTopics[0];
    rec = { text: `Revisit "${t.topic}" — you scored ${t.pct}% there last time.`, action: "Quiz me", run: () => { switchView("quiz"); startQuizWithTopic(t.topic); } };
  } else if (patterns.length > 0) {
    rec = { text: `You've missed ${patterns[0].count} questions on "${patterns[0].topic}" — worth extra practice.`, action: "Practice it", run: () => { switchView("quiz"); startQuizWithTopic(patterns[0].topic); } };
  } else if (plannerOverdue > 0) {
    rec = { text: `You have ${plannerOverdue} overdue planner item${plannerOverdue === 1 ? "" : "s"}.`, action: "Catch up", run: () => switchView("planner") };
  } else {
    rec = { text: "You're all caught up! Try a fresh quiz to keep your knowledge sharp.", action: "Start a quiz", run: () => switchView("quiz") };
  }

  card.innerHTML = `
    <div class="bento-tile-eyebrow">🧭 Revision Center — what should I revise now?</div>
    <div class="bento-tile-title" style="margin-bottom:10px"></div>`;
  card.querySelector(".bento-tile-title").textContent = rec.text;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary";
  btn.textContent = rec.action;
  btn.addEventListener("click", rec.run);
  card.appendChild(btn);
  return card;
}

function buildHeatmap() {
  const wrap = document.createElement("div");
  wrap.className = "chart-card";
  wrap.innerHTML = '<h3 style="margin:0 0 10px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">Study heatmap (26 weeks)</h3>';
  const grid = document.createElement("div");
  grid.className = "heatmap-grid";
  const days = getHeatmapDays(26 * 7);
  const max = Math.max(1, ...days.map((d) => d.count));
  days.forEach((d) => {
    const cell = document.createElement("span");
    cell.className = "heatmap-cell";
    const intensity = d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4));
    cell.dataset.level = intensity;
    cell.title = `${d.date.toLocaleDateString([], { month: "short", day: "numeric" })}: ${d.count} activity`;
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);
  return wrap;
}

function buildMistakeBook() {
  const mistakes = getMistakes();
  if (mistakes.length === 0) return null;
  const wrap = document.createElement("div");
  wrap.className = "chart-card";
  wrap.innerHTML = '<h3 style="margin:0 0 4px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">Mistake book</h3>';

  const patterns = getMistakePatterns();
  if (patterns.length > 0) {
    const insight = document.createElement("p");
    insight.className = "view-sub";
    insight.style.margin = "0 0 12px";
    insight.textContent = `Pattern spotted: you often miss questions on "${patterns[0].topic}" (${patterns[0].count} times).`;
    wrap.appendChild(insight);
  }

  mistakes.slice(0, 8).forEach((m) => {
    const row = document.createElement("div");
    row.className = "practice-card";
    row.style.marginBottom = "8px";
    row.innerHTML = `
      <div class="practice-question"></div>
      <div class="practice-answer" style="border-top:none;padding-top:0">
        <strong>Your answer:</strong> <span class="mb-student"></span><br>
        <strong>Correct:</strong> <span class="mb-correct"></span>
      </div>`;
    row.querySelector(".practice-question").textContent = m.question;
    row.querySelector(".mb-student").textContent = m.studentAnswer;
    row.querySelector(".mb-correct").textContent = m.correctAnswer;
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn-sm";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => {
      confirmDanger("Remove this mistake?", "", "Remove", () => {
        deleteMistake(m.id);
        renderProgressPage();
      });
    });
    row.appendChild(delBtn);
    wrap.appendChild(row);
  });
  return wrap;
}

function buildWeeklyReview() {
  const wrap = document.createElement("div");
  wrap.className = "chart-card";
  wrap.innerHTML = `
    <h3 style="margin:0 0 10px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">📆 Weekly Review</h3>
    <button id="weeklyReviewBtn" class="btn btn-primary" type="button">Generate my weekly review</button>
    <div id="weeklyReviewResult" style="margin-top:14px"></div>`;

  wrap.querySelector("#weeklyReviewBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const resultEl = wrap.querySelector("#weeklyReviewResult");
    const week = getWeeklyStats();
    if (!week.hasAnyActivity) {
      resultEl.innerHTML = '<p class="context-empty">No activity in the last 7 days yet — do some studying, then check back.</p>';
      return;
    }
    btn.disabled = true;
    resultEl.innerHTML = '<div class="loading-row"><span class="spinner"></span><span>Writing your review…</span></div>';

    const summary = [
      `Study time: ${week.studyMinutes} minutes`,
      `Questions asked: ${week.questionsAsked}`,
      `Quizzes completed: ${week.quizzesCompleted}${week.quizAccuracyPct !== null ? ` (avg accuracy ${week.quizAccuracyPct}%)` : ""}`,
      `Homework completed: ${week.homeworkCompleted}`,
      `Notes created: ${week.notesCreated}`,
      `Strongest subject by time studied: ${week.strongestSubject ? SUBJECT_LABELS[week.strongestSubject] || week.strongestSubject : "not enough data"}`,
      `Current streak: ${week.streak} days`,
    ].join("\n");

    const prompt = `Here is a student's REAL activity data from the last 7 days in H1 — use ONLY these numbers, don't invent anything:\n\n${summary}\n\nWrite a short, encouraging weekly review with exactly three short sections: "What went well", "What needs attention", and "Recommended next week". Keep each section to 1-3 sentences.`;

    try {
      const reply = await sendChat([{ role: "user", content: prompt }], appState.subject);
      resultEl.innerHTML = `<div class="result-card"><p style="white-space:pre-wrap;margin:0"></p></div>`;
      resultEl.querySelector("p").textContent = reply;
    } catch (err) {
      resultEl.innerHTML = "";
      const errorCard = document.createElement("div");
      errorCard.className = "step-card";
      errorCard.style.borderColor = "var(--danger-border)";
      errorCard.innerHTML = `<div class="step-text" style="color:var(--danger)"></div>`;
      errorCard.querySelector(".step-text").textContent = friendlyErrorMessage(err);
      resultEl.appendChild(errorCard);
    } finally {
      btn.disabled = false;
    }
  });

  return wrap;
}

function renderEmptyState() {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-emoji">📊</div>
      <h2>No activity yet</h2>
      <p>Chat with H1, take a quiz, or start a study session — your progress will show up here.</p>
    </div>`;
}

export function renderProgressPage() {
  const stats = getStats();
  container.innerHTML = "";

  if (!stats.hasAnyActivity) {
    renderEmptyState();
    return;
  }

  if (isEnabled()) {
    const xp = getXP();
    const { level, nextThreshold, progressPct } = getLevel(xp);
    const levelCard = document.createElement("div");
    levelCard.className = "level-card";
    levelCard.innerHTML = `
      <div class="status-row"><span>Level ${level}</span><span></span></div>
      <div class="level-bar-track"><div class="level-bar-fill" style="width:${progressPct}%"></div></div>`;
    levelCard.querySelector(".status-row span:last-child").textContent = nextThreshold
      ? `${xp} / ${nextThreshold} XP`
      : `${xp} XP (max level)`;
    container.appendChild(levelCard);
  }

  container.appendChild(buildRevisionCenter(stats));
  container.appendChild(buildWeeklyReview());

  const statsGrid = document.createElement("div");
  statsGrid.className = "progress-stats-grid";
  statsGrid.appendChild(statCard(stats.streak, "Day streak 🔥"));
  statsGrid.appendChild(statCard(stats.totalQuestions, "Questions attempted"));
  statsGrid.appendChild(statCard(stats.quizzesCompleted, "Quizzes completed"));
  statsGrid.appendChild(statCard(stats.avgScorePct === null ? "—" : `${stats.avgScorePct}%`, "Average quiz score"));
  statsGrid.appendChild(statCard(stats.flashcardsStudied, "Flashcards studied"));
  statsGrid.appendChild(statCard(stats.studyMinutes, "Study minutes"));
  statsGrid.appendChild(statCard(stats.notesCreated, "Notes created"));
  statsGrid.appendChild(statCard(stats.homeworkCompleted || 0, "Homework completed"));
  statsGrid.appendChild(statCard(stats.documentsCreated || 0, "Documents added"));
  statsGrid.appendChild(statCard(stats.planTasksDone, "Plan tasks done"));
  container.appendChild(statsGrid);

  if (stats.subjectStats && stats.subjectStats.some((s) => s.questions > 0 || s.quizzes > 0)) {
    const subjectCard = document.createElement("div");
    subjectCard.className = "chart-card";
    subjectCard.innerHTML =
      '<h3 style="margin:0 0 4px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">By subject</h3>';
    stats.subjectStats
      .filter((s) => s.questions > 0 || s.quizzes > 0)
      .slice(0, 6)
      .forEach((s) => {
        const row = document.createElement("div");
        row.className = "weak-topic-row";
        row.innerHTML = `<span></span><span></span>`;
        row.querySelector("span:first-child").textContent = SUBJECT_LABELS[s.subject] || s.subject;
        row.querySelector("span:last-child").textContent = s.avgScorePct !== null ? `${s.avgScorePct}% avg` : `${s.questions} questions`;
        subjectCard.appendChild(row);
      });
    container.appendChild(subjectCard);
  }

  const chartCard = document.createElement("div");
  chartCard.className = "chart-card";
  const maxCount = Math.max(1, ...stats.last14Days.map((d) => d.count));
  chartCard.innerHTML = `<h3 style="margin:0 0 4px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">Last 14 days</h3><div class="bar-chart"></div>`;
  const bars = chartCard.querySelector(".bar-chart");
  stats.last14Days.forEach((d) => {
    const col = document.createElement("div");
    col.className = "bar-chart-col";
    const heightPct = Math.max(4, (d.count / maxCount) * 100);
    col.innerHTML = `<div class="bar-chart-bar" style="height:${heightPct}%" title="${d.count} activity"></div><span class="bar-chart-label"></span>`;
    col.querySelector(".bar-chart-label").textContent = d.label[0];
    bars.appendChild(col);
  });
  container.appendChild(chartCard);
  container.appendChild(buildHeatmap());

  const mistakeBook = buildMistakeBook();
  if (mistakeBook) container.appendChild(mistakeBook);

  if (stats.weakTopics.length > 0) {
    const weakCard = document.createElement("div");
    weakCard.className = "chart-card";
    weakCard.innerHTML = '<h3 style="margin:0 0 4px;font-size:13px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em">Weak topics</h3>';
    stats.weakTopics.forEach((t) => {
      const row = document.createElement("div");
      row.className = "weak-topic-row";
      row.innerHTML = `<span></span><span></span>`;
      row.querySelector("span:first-child").textContent = t.topic;
      row.querySelector("span:last-child").textContent = `${t.pct}%`;
      weakCard.appendChild(row);
    });
    container.appendChild(weakCard);
  }

  if (isEnabled()) {
    const achievements = getAchievements();
    const earnedCount = achievements.filter((a) => a.earned).length;
    const teaser = document.createElement("button");
    teaser.type = "button";
    teaser.className = "achievements-teaser";
    teaser.innerHTML = `
      <span class="achievements-teaser-icon">🏆</span>
      <span class="achievements-teaser-text">
        <strong>${earnedCount} / ${achievements.length} achievements unlocked</strong>
        <span>See all badges →</span>
      </span>`;
    teaser.addEventListener("click", () => switchView("achievements"));
    container.appendChild(teaser);
  }
}

export function initProgressPage() {
  renderProgressPage();
}
