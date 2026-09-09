import { getStats, getEvents } from "./progress.js";
import { isEnabled, getXP, getLevel } from "./gamification.js";
import { loadConversations, setActiveConversationId } from "./conversations.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { switchView } from "./nav.js";
import { getTodayAndUpcoming } from "./homeworkStore.js";
import { getGrouped as getPlannerGrouped, getExamGroups } from "./plannerStore.js";
import { startQuizWithTopic } from "./quiz.js";
import { getDailyGoalMinutes } from "./goalsStore.js";
import { getDecks, getDueCount } from "./flashcardDecks.js";
import { QUOTES } from "./quotesData.js";
import { showToast } from "./toast.js";

const heroStatStrip = document.getElementById("heroStatStrip");
const bentoContinue = document.getElementById("bentoContinue");
const bentoWeak = document.getElementById("bentoWeak");
const bentoDeadline = document.getElementById("bentoDeadline");
const bentoNote = document.getElementById("bentoNote");
const bentoQuiz = document.getElementById("bentoQuiz");
const bentoFocus = document.getElementById("bentoFocus");
const dailyInspirationText = document.getElementById("dailyInspirationText");
const dailyInspirationFavBtn = document.getElementById("dailyInspirationFavBtn");
const dailyInspirationCopyBtn = document.getElementById("dailyInspirationCopyBtn");
const dailyInspirationOpenBtn = document.getElementById("dailyInspirationOpenBtn");
const QUOTE_FAVORITES_KEY = "h1-quote-favorites";

function statPill(value, label) {
  const el = document.createElement("div");
  el.className = "hero-stat-pill";
  el.innerHTML = `<strong></strong><span></span>`;
  el.querySelector("strong").textContent = value;
  el.querySelector("span").textContent = label;
  return el;
}

function todayStudyMinutes() {
  const todayKey = new Date().toDateString();
  return getEvents()
    .filter((e) => e.type === "study_session" && new Date(e.ts).toDateString() === todayKey)
    .reduce((sum, e) => sum + (e.minutes || 0), 0);
}

function tileContent(eyebrow, title, sub, actionLabel) {
  return `
    <div class="bento-tile-eyebrow">${eyebrow}</div>
    <div class="bento-tile-title">${title}</div>
    ${sub ? `<div class="bento-tile-sub">${sub}</div>` : ""}
    ${actionLabel ? `<div class="bento-tile-action">${actionLabel} →</div>` : ""}`;
}

function renderHeroStrip(stats) {
  if (!heroStatStrip) return;
  heroStatStrip.innerHTML = "";
  if (isEnabled() && stats.hasAnyActivity) {
    const xp = getXP();
    const { level } = getLevel(xp);
    heroStatStrip.appendChild(statPill(`Lv ${level}`, `${xp} XP`));
  }
  heroStatStrip.appendChild(statPill(stats.streak, "Day streak 🔥"));
  const goalMinutes = getDailyGoalMinutes();
  const todayMinutes = todayStudyMinutes();
  heroStatStrip.appendChild(statPill(`${Math.min(todayMinutes, goalMinutes)}/${goalMinutes}`, "Today's goal (min)"));
}

function renderContinue() {
  if (!bentoContinue) return;
  const conversations = loadConversations();
  bentoContinue.onclick = null;
  if (conversations.length > 0) {
    const conv = conversations[0];
    bentoContinue.innerHTML = tileContent("💬 Continue studying", conv.title || "Untitled conversation", "Pick up right where you left off.", "Resume");
    bentoContinue.onclick = () => {
      setActiveConversationId(conv.id);
      switchView("chat");
      window.dispatchEvent(new CustomEvent("h1:conversation-selected"));
    };
  } else {
    bentoContinue.innerHTML = tileContent("💬 Get started", "Ask H1 your first question", "Type anything you're stuck on — H1 will walk you through it.", "Ask now");
    bentoContinue.onclick = () => switchView("chat");
  }
}

// Adaptive by design: revision that's actually due (real spaced-repetition data) outranks a
// generic "weak subject" suggestion, since it's a more concrete, time-sensitive action.
function renderWeak(stats) {
  if (!bentoWeak) return;
  const dueCount = getDecks().reduce((sum, d) => sum + getDueCount(d), 0);
  if (dueCount > 0) {
    bentoWeak.innerHTML = tileContent("🔁 Revision due", `${dueCount} flashcard${dueCount === 1 ? "" : "s"} ready to review`, "Spaced repetition works best on time.", "Review now");
    bentoWeak.onclick = () => switchView("flashcards");
    return;
  }
  if (stats.weakTopics.length > 0) {
    const t = stats.weakTopics[0];
    bentoWeak.innerHTML = tileContent("📉 Weak subject", t.topic, `You scored ${t.pct}% last time — worth another look.`, "Review");
    bentoWeak.onclick = () => {
      switchView("quiz");
      startQuizWithTopic(t.topic);
    };
  } else {
    bentoWeak.innerHTML = tileContent("📉 Weak subject", "Nothing weak yet", "Take a few quizzes and H1 will spot patterns here.", "Start a quiz");
    bentoWeak.onclick = () => switchView("quiz");
  }
}

// Adaptive priority: a soon exam beats an overdue task beats a plain upcoming deadline —
// each branch only fires when that real condition actually exists.
function renderDeadline() {
  if (!bentoDeadline) return;
  const today = new Date().toISOString().slice(0, 10);

  const exams = getExamGroups().filter((e) => e.examDate >= today);
  if (exams.length > 0) {
    const exam = exams[0];
    const days = Math.max(0, Math.ceil((new Date(exam.examDate + "T00:00:00") - new Date()) / 86400000));
    bentoDeadline.innerHTML = tileContent(
      "📆 Exam coming up",
      exam.groupLabel,
      `${days} day${days === 1 ? "" : "s"} to go · ${exam.pct}% of prep done`,
      "Open Exam Center"
    );
    bentoDeadline.onclick = () => switchView("planner");
    return;
  }

  const homework = getTodayAndUpcoming(1);
  const planner = getPlannerGrouped();
  const plannerNext = [...planner.overdue, ...planner.today, ...planner.thisWeek][0];

  let winner = null;
  if (homework.length && plannerNext) {
    winner = homework[0].deadline <= plannerNext.deadline ? { kind: "homework", item: homework[0] } : { kind: "planner", item: plannerNext };
  } else if (homework.length) {
    winner = { kind: "homework", item: homework[0] };
  } else if (plannerNext) {
    winner = { kind: "planner", item: plannerNext };
  }

  if (!winner) {
    bentoDeadline.innerHTML = tileContent("📅 Upcoming", "No deadlines yet", "Add a homework task or plan to see it here.", "Add one");
    bentoDeadline.onclick = () => switchView("homework");
    return;
  }
  const label = new Date(winner.item.deadline + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
  const overdue = winner.item.deadline < today;
  bentoDeadline.innerHTML = tileContent(
    overdue ? "⚠️ Overdue" : "📅 Upcoming deadline",
    winner.item.title,
    `${overdue ? "Was due" : "Due"} ${label}`,
    "Open"
  );
  bentoDeadline.onclick = () => switchView(winner.kind === "homework" ? "homework" : "planner");
}

function renderNote() {
  if (!bentoNote) return;
  const notes = safeGetJson("h1-notes", []);
  if (notes.length > 0) {
    const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const n = sorted[0];
    const snippet = (n.body || "").replace(/\s+/g, " ").trim().slice(0, 80);
    bentoNote.innerHTML = tileContent("🗒️ Recent note", n.title || "Untitled note", snippet, "Open note");
  } else {
    bentoNote.innerHTML = tileContent("🗒️ Notes", "No notes yet", "Save what you learn as you go.", "Create a note");
  }
  bentoNote.onclick = () => switchView("notes");
}

function renderQuiz(stats) {
  if (!bentoQuiz) return;
  const topic = stats.weakTopics[0]?.topic;
  bentoQuiz.innerHTML = tileContent(
    "🎯 Recommended quiz",
    topic || "A quick general quiz",
    topic ? "Turn a weak spot into a strength." : "Test yourself while it's fresh.",
    "Start quiz"
  );
  bentoQuiz.onclick = () => {
    switchView("quiz");
    if (topic) startQuizWithTopic(topic);
  };
}

function renderFocus() {
  if (!bentoFocus) return;
  bentoFocus.innerHTML = `
    <div>
      <div class="bento-tile-eyebrow">⏱️ Focus</div>
      <div class="bento-tile-title">Start a distraction-free session</div>
    </div>
    <div class="bento-tile-action">Start focus →</div>`;
  bentoFocus.onclick = () => switchView("study-mode");
}

// Deterministic per calendar day (not re-randomized on every visit) — "Daily" means it
// actually rotates once a day, the same quote all day, same as a real daily-inspiration feed.
function renderDailyInspiration() {
  if (!dailyInspirationText) return;
  const dayIndex = Math.floor(Date.now() / 86400000);
  const quote = QUOTES[dayIndex % QUOTES.length];
  dailyInspirationText.textContent = `“${quote.text}”`;

  const isFavorited = () => new Set(safeGetJson(QUOTE_FAVORITES_KEY, [])).has(quote.id);
  dailyInspirationFavBtn.setAttribute("aria-pressed", String(isFavorited()));
  dailyInspirationFavBtn.onclick = () => {
    const set = new Set(safeGetJson(QUOTE_FAVORITES_KEY, []));
    if (set.has(quote.id)) set.delete(quote.id);
    else set.add(quote.id);
    safeSetJson(QUOTE_FAVORITES_KEY, [...set]);
    dailyInspirationFavBtn.setAttribute("aria-pressed", String(set.has(quote.id)));
  };
  dailyInspirationCopyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(quote.text);
      showToast("Quote copied!", "success", 1800);
    } catch {
      showToast("Couldn't copy that quote.", "error");
    }
  };
  dailyInspirationOpenBtn.onclick = () => switchView("quotes");
}

export function renderHomeWidget() {
  const stats = getStats();
  renderHeroStrip(stats);
  renderContinue();
  renderWeak(stats);
  renderDeadline();
  renderNote();
  renderQuiz(stats);
  renderFocus();
  renderDailyInspiration();
}

export function initHomeWidgets() {
  renderHomeWidget();
}

// Kept for main.js compatibility — the bento tiles above already fold in the
// "today & upcoming" content that used to live in a separate widget.
export function renderUpcomingWidget() {
  renderDeadline();
}
