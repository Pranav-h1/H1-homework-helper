import { getAchievements } from "./gamification.js";

const container = document.getElementById("achievementsContent");

export function renderAchievements() {
  const achievements = getAchievements();
  const earned = achievements.filter((a) => a.earned).length;
  const pct = Math.round((earned / achievements.length) * 100);

  container.innerHTML = "";

  const summary = document.createElement("div");
  summary.className = "achievements-summary";
  summary.innerHTML = `
    <div class="achievements-summary-ring" style="--pct:${pct}">
      <div class="achievements-summary-inner"></div>
    </div>
    <div>
      <h2 style="margin:0 0 4px;font-size:18px">${earned} of ${achievements.length} unlocked</h2>
      <p class="view-sub" style="margin:0">Every badge here is earned from something you actually did in H1.</p>
    </div>`;
  summary.querySelector(".achievements-summary-inner").textContent = `${pct}%`;
  container.appendChild(summary);

  const grid = document.createElement("div");
  grid.className = "achievements-grid";
  grid.style.marginTop = "18px";
  achievements.forEach((a) => {
    const card = document.createElement("div");
    card.className = "achievement-card" + (a.earned ? " earned" : "");
    card.innerHTML = `<div class="achievement-icon"></div><div class="achievement-title"></div><div class="achievement-desc"></div>`;
    card.querySelector(".achievement-icon").textContent = a.icon;
    card.querySelector(".achievement-title").textContent = a.title;
    card.querySelector(".achievement-desc").textContent = a.desc || "";
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

export function initAchievements() {
  renderAchievements();
}
