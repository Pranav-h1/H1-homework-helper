import { getStats } from "./progress.js";
import { isEnabled, getXP, getLevel } from "./gamification.js";
import { loadConversations, setActiveConversationId } from "./conversations.js";
import { safeGetJson } from "./storage.js";
import { switchView } from "./nav.js";

const widget = document.getElementById("homeProgressWidget");

function miniCard(value, label, wide) {
  const card = document.createElement("div");
  card.className = "progress-mini-card" + (wide ? " wide" : "");
  card.innerHTML = `<span class="progress-mini-value"></span><span class="progress-mini-label"></span>`;
  card.querySelector(".progress-mini-value").textContent = value;
  card.querySelector(".progress-mini-label").textContent = label;
  return card;
}

function recommendNextAction(stats) {
  if (!stats.hasAnyActivity) return { text: "Ask H1 your first question to get started", view: "chat" };
  if (stats.weakTopics.length > 0) return { text: `Review "${stats.weakTopics[0].topic}" — you scored low there last time`, view: "quiz" };
  if (stats.streak === 0) return { text: "Keep your streak going — do something in H1 today", view: "chat" };
  return { text: "Try a quick quiz to keep your knowledge fresh", view: "quiz" };
}

export function renderHomeWidget() {
  const stats = getStats();
  widget.innerHTML = "";

  if (isEnabled() && stats.hasAnyActivity) {
    const xp = getXP();
    const { level } = getLevel(xp);
    widget.appendChild(miniCard(`Lv ${level}`, `${xp} XP`));
  }
  widget.appendChild(miniCard(stats.streak, "Day streak 🔥"));
  widget.appendChild(miniCard(stats.quizzesCompleted, "Quizzes done"));
  widget.appendChild(miniCard(stats.studyMinutes, "Study minutes"));

  const rec = recommendNextAction(stats);
  const recBtn = document.createElement("button");
  recBtn.type = "button";
  recBtn.className = "recommend-card wide";
  recBtn.style.gridColumn = "1 / -1";
  recBtn.innerHTML = `<span style="font-size:18px">💡</span><span></span>`;
  recBtn.querySelector("span:last-child").textContent = rec.text;
  recBtn.addEventListener("click", () => switchView(rec.view));
  widget.appendChild(recBtn);

  const conversations = loadConversations();
  const recentQuizzes = safeGetJson("h1-recent-quizzes", []);

  if (conversations.length > 0) {
    const conv = conversations[0];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recommend-card";
    card.style.gridColumn = "span 1";
    card.innerHTML = `<span style="font-size:16px">💬</span><span></span>`;
    card.querySelector("span:last-child").textContent = `Continue: ${conv.title}`;
    card.addEventListener("click", () => {
      setActiveConversationId(conv.id);
      switchView("chat");
      window.dispatchEvent(new CustomEvent("h1:conversation-selected"));
    });
    widget.appendChild(card);
  }

  if (recentQuizzes.length > 0) {
    const q = recentQuizzes[0];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recommend-card";
    card.innerHTML = `<span style="font-size:16px">📝</span><span></span>`;
    card.querySelector("span:last-child").textContent = `Last quiz: ${q.topic} (${q.score}/${q.total})`;
    card.addEventListener("click", () => switchView("quiz"));
    widget.appendChild(card);
  }
}

export function initHomeWidgets() {
  renderHomeWidget();
}
