import { getStats } from "./progress.js";
import { isEnabled, getXP, getLevel, getAchievements } from "./gamification.js";

const container = document.getElementById("progressContent");

function statCard(value, label) {
  const card = document.createElement("div");
  card.className = "progress-stat-card";
  card.innerHTML = `<div class="progress-stat-value"></div><div class="progress-stat-label"></div>`;
  card.querySelector(".progress-stat-value").textContent = value;
  card.querySelector(".progress-stat-label").textContent = label;
  return card;
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

  const statsGrid = document.createElement("div");
  statsGrid.className = "progress-stats-grid";
  statsGrid.appendChild(statCard(stats.streak, "Day streak 🔥"));
  statsGrid.appendChild(statCard(stats.totalQuestions, "Questions attempted"));
  statsGrid.appendChild(statCard(stats.quizzesCompleted, "Quizzes completed"));
  statsGrid.appendChild(statCard(stats.avgScorePct === null ? "—" : `${stats.avgScorePct}%`, "Average quiz score"));
  statsGrid.appendChild(statCard(stats.flashcardsStudied, "Flashcards studied"));
  statsGrid.appendChild(statCard(stats.studyMinutes, "Study minutes"));
  statsGrid.appendChild(statCard(stats.notesCreated, "Notes created"));
  statsGrid.appendChild(statCard(stats.planTasksDone, "Plan tasks done"));
  container.appendChild(statsGrid);

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
    const achHeading = document.createElement("div");
    achHeading.className = "section-heading";
    achHeading.innerHTML = "<h2>Achievements</h2>";
    container.appendChild(achHeading);

    const grid = document.createElement("div");
    grid.className = "achievements-grid";
    getAchievements().forEach((a) => {
      const card = document.createElement("div");
      card.className = "achievement-card" + (a.earned ? " earned" : "");
      card.innerHTML = `<div class="achievement-icon"></div><div class="achievement-title"></div>`;
      card.querySelector(".achievement-icon").textContent = a.icon;
      card.querySelector(".achievement-title").textContent = a.title;
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }
}

export function initProgressPage() {
  renderProgressPage();
}
