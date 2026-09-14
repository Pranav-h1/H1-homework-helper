// Your Learning Brain — the view that renders what the Second Brain has worked out.
//
// This module owns no facts of its own. Everything on screen comes from secondBrain.js, and
// where that layer says "not enough data yet", this one says so plainly instead of drawing
// an empty chart that looks like a real zero.
import {
  getBrainState,
  getSignals,
  getMission,
  getEmergencyPlan,
  getTopicIntel,
  invalidateBrain,
} from "./secondBrain.js";
import { isDone, toggleTask, getCompletedCount } from "./missionStore.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { prefillChat } from "./chat.js";
import { getAllSubjects } from "./subjectsStore.js";
import { isEnabled as gamificationEnabled } from "./gamification.js";

const scoreRing = document.getElementById("brainScoreRing");
const scoreValue = document.getElementById("brainScoreValue");
const scoreCaption = document.getElementById("brainScoreCaption");
const scoreBreakdown = document.getElementById("brainScoreBreakdown");
const brainStats = document.getElementById("brainStats");
const brainEmpty = document.getElementById("brainEmpty");
const brainBody = document.getElementById("brainBody");

const missionList = document.getElementById("missionList");
const missionMeta = document.getElementById("missionMeta");
const missionBudget = document.getElementById("missionBudget");
const missionProgress = document.getElementById("missionProgress");

const signalsList = document.getElementById("brainSignalsList");
const topicsGrid = document.getElementById("brainTopicsGrid");
const topicsEmpty = document.getElementById("brainTopicsEmpty");

const cookedBtn = document.getElementById("cookedBtn");
const brainBossBtn = document.getElementById("brainBossBtn");
const cookedPanel = document.getElementById("cookedPanel");
const cookedMinutes = document.getElementById("cookedMinutes");
const cookedSubject = document.getElementById("cookedSubject");
const cookedTopic = document.getElementById("cookedTopic");
const cookedBuildBtn = document.getElementById("cookedBuildBtn");
const cookedCloseBtn = document.getElementById("cookedCloseBtn");
const cookedResult = document.getElementById("cookedResult");

const LEVEL_LABEL = { critical: "Urgent", high: "High", medium: "Medium", low: "Low" };

const KIND_ICON = {
  exam: "📅",
  overdue: "🔥",
  due_today: "⏰",
  plan_due: "🗓️",
  weak_topic: "📉",
  shaky_topic: "📊",
  stale_topic: "🕰️",
  slipping: "⚠️",
  cards_due: "🗂️",
  unstarted_deck: "📦",
  mistake_pattern: "🔁",
  streak_risk: "💤",
  daily_goal: "🎯",
  goal_gap: "🎯",
  cold_subject: "❄️",
};

const STATUS_LABEL = { weak: "Needs work", shaky: "Getting there", solid: "Solid", unknown: "Not tested yet" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A collapsible "why?" line. Every recommendation in this view carries one — the student
// should never have to take H1's word for it.
function whyToggle(reason) {
  const wrap = el("div", "brain-why");
  const btn = el("button", "brain-why-btn", "Why this?");
  btn.type = "button";
  btn.setAttribute("aria-expanded", "false");
  const body = el("p", "brain-why-body", reason);
  body.hidden = true;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    body.hidden = !body.hidden;
    btn.setAttribute("aria-expanded", String(!body.hidden));
    btn.textContent = body.hidden ? "Why this?" : "Hide";
  });
  wrap.appendChild(btn);
  wrap.appendChild(body);
  return wrap;
}

// Turns a signal's declared action into something that actually happens. secondBrain.js
// stays free of UI imports by describing intent only; the mapping lives here.
function runAction(action) {
  if (!action) return;
  // Note the single argument: both helpers take (topic, sourceText), and passing a subject
  // key as the second would be read as source material and generate a quiz about the word
  // "math". One argument prefills the topic and leaves the student on the setup screen.
  if (action.type === "quiz" && action.topic) {
    switchView("quiz");
    startQuizWithTopic(action.topic);
    return;
  }
  if (action.type === "flashcards" && action.topic) {
    switchView("flashcards");
    startFlashcardsWithTopic(action.topic);
    return;
  }
  if (action.type === "mistakes") {
    switchView("progress");
    showToast("Your mistake book is here — open a mistake to practise it again.", "success", 3000);
    return;
  }
  if (action.type === "chat") {
    switchView("chat");
    prefillChat(`Help me get started on ${action.label ? action.label.replace(/^Ask about /, "") : "this"}.`);
    return;
  }
  if (action.type === "view" && action.view) switchView(action.view);
}

function actionButton(action) {
  if (!action) return null;
  const btn = el("button", "btn btn-ghost brain-btn-sm", action.label || "Open");
  btn.type = "button";
  btn.addEventListener("click", () => runAction(action));
  return btn;
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function renderScore(state) {
  if (state.score === null) {
    scoreValue.textContent = "—";
    scoreRing.style.setProperty("--brain-score", "0");
    scoreCaption.textContent = "No score yet — take a quiz or add some homework and it'll appear.";
    scoreBreakdown.innerHTML = "";
    return;
  }
  scoreValue.textContent = String(state.score);
  scoreRing.style.setProperty("--brain-score", String(state.score));
  scoreCaption.textContent =
    state.score >= 80 ? "You're in good shape." : state.score >= 55 ? "Solid, with a few gaps to close." : "There's real ground to make up — the plan below is where to start.";

  scoreBreakdown.innerHTML = "";
  state.scoreComponents.forEach((c) => {
    const row = el("div", "brain-score-row");
    const head = el("div", "brain-score-row-head");
    head.appendChild(el("span", "brain-score-label", c.label));
    head.appendChild(el("span", "brain-score-value", `${c.value}`));
    const bar = el("div", "brain-score-bar");
    const fill = el("div", "brain-score-fill");
    fill.style.width = `${Math.max(2, c.value)}%`;
    bar.appendChild(fill);
    row.appendChild(head);
    row.appendChild(bar);
    row.appendChild(whyToggle(c.reason));
    scoreBreakdown.appendChild(row);
  });
}

function renderStats(state) {
  brainStats.innerHTML = "";
  const cards = [
    { label: "Day streak", value: state.streak, hint: state.activeToday ? "Active today" : "Nothing logged today yet" },
    { label: "Level", value: state.level.level, hint: `${state.level.xp} XP` },
    { label: "Topics tracked", value: state.topics.topics.length, hint: `${state.topics.graded.length} with enough data to score` },
    { label: "Cards due", value: state.counts.cardsDue, hint: `${state.counts.decks} deck${state.counts.decks === 1 ? "" : "s"}` },
    { label: "Open homework", value: state.counts.openHomework, hint: `${state.counts.planOpen} plan item${state.counts.planOpen === 1 ? "" : "s"}` },
    { label: "Mistakes saved", value: state.counts.mistakes, hint: "In your mistake book" },
  ];
  cards.forEach((c) => {
    const tile = el("div", "brain-stat");
    tile.appendChild(el("div", "brain-stat-value", String(c.value)));
    tile.appendChild(el("div", "brain-stat-label", c.label));
    tile.appendChild(el("div", "brain-stat-hint", c.hint));
    brainStats.appendChild(tile);
  });
}

// ---------------------------------------------------------------------------
// Today's Mission
// ---------------------------------------------------------------------------

function renderMission() {
  const minutes = Number(missionBudget.value) || undefined;
  const mission = getMission({ minutes });
  missionList.innerHTML = "";
  missionMeta.textContent = mission.reason;

  if (!mission.ready) {
    missionList.appendChild(el("p", "brain-empty-line", mission.tasks.length === 0 && mission.reason ? "" : ""));
    missionProgress.textContent = "";
    const note = el("p", "brain-empty-line", "Nothing to plan yet.");
    missionList.appendChild(note);
    return;
  }

  let doneCount = 0;
  const buildRow = (task) => {
    const done = isDone(task.id);
    if (done && !task.stretch) doneCount += 1;

    const row = el("div", `mission-task${done ? " done" : ""}${task.stretch ? " stretch" : ""}`);
    row.dataset.level = task.level;

    const check = el("button", "mission-check");
    check.type = "button";
    check.setAttribute("role", "checkbox");
    check.setAttribute("aria-checked", String(done));
    check.setAttribute("aria-label", `Mark "${task.title}" done`);
    check.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    check.addEventListener("click", () => {
      const result = toggleTask(task.id, task.xp);
      if (result.awardedXp > 0 && gamificationEnabled()) {
        showToast(`+${result.awardedXp} XP — step done.`, "success", 2000);
      }
      invalidateBrain();
      renderMission();
      renderScore(getBrainState());
    });

    const main = el("div", "mission-task-main");
    const head = el("div", "mission-task-head");
    head.appendChild(el("span", "mission-task-icon", KIND_ICON[task.kind] || "•"));
    head.appendChild(el("span", "mission-task-title", task.title));
    main.appendChild(head);
    if (task.detail) main.appendChild(el("p", "mission-task-detail", task.detail));
    main.appendChild(whyToggle(task.why));

    const side = el("div", "mission-task-side");
    side.appendChild(el("span", "mission-time", `${task.minutes} min`));
    const btn = actionButton(task.action);
    if (btn) side.appendChild(btn);

    row.appendChild(check);
    row.appendChild(main);
    row.appendChild(side);
    missionList.appendChild(row);
  };

  mission.tasks.forEach(buildRow);

  // Beyond the stated budget, so it's labelled rather than folded in — the times above are
  // real estimates and padding them out to fill a list would misrepresent the work.
  if (mission.stretch && mission.stretch.length > 0) {
    missionList.appendChild(el("p", "mission-divider", "If you get through that"));
    mission.stretch.forEach(buildRow);
  }

  missionProgress.textContent = `${doneCount} of ${mission.tasks.length} done · about ${mission.totalMinutes} min`;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

function renderSignals() {
  const signals = getSignals();
  signalsList.innerHTML = "";
  if (signals.length === 0) {
    signalsList.appendChild(el("p", "brain-empty-line", "Nothing standing out right now — no overdue work, no weak topics on record, nothing due for review."));
    return;
  }
  signals.forEach((s) => {
    const card = el("div", "brain-signal");
    card.dataset.level = s.level;
    const head = el("div", "brain-signal-head");
    head.appendChild(el("span", "brain-signal-icon", KIND_ICON[s.kind] || "•"));
    const titleWrap = el("div", "brain-signal-titles");
    titleWrap.appendChild(el("span", "brain-signal-title", s.title));
    if (s.detail) titleWrap.appendChild(el("span", "brain-signal-detail", s.detail));
    head.appendChild(titleWrap);
    const badge = el("span", "brain-level-badge", LEVEL_LABEL[s.level] || s.level);
    badge.dataset.level = s.level;
    head.appendChild(badge);
    card.appendChild(head);
    card.appendChild(whyToggle(s.reason));
    const btn = actionButton(s.action);
    if (btn) {
      const foot = el("div", "brain-signal-foot");
      foot.appendChild(btn);
      if (s.confidence === "low") {
        foot.appendChild(el("span", "brain-confidence", "Low confidence — based on only a few answers"));
      }
      card.appendChild(foot);
    }
    signalsList.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Topic map
// ---------------------------------------------------------------------------

function topicCard(t) {
  const card = el("div", "brain-topic");
  card.dataset.status = t.status;
  const head = el("div", "brain-topic-head");
  head.appendChild(el("span", "brain-topic-name", t.topic));
  head.appendChild(el("span", "brain-topic-pct", t.accuracyPct === null ? "—" : `${t.accuracyPct}%`));
  card.appendChild(head);

  const bar = el("div", "brain-topic-bar");
  const fill = el("div", "brain-topic-fill");
  fill.style.width = t.accuracyPct === null ? "0%" : `${Math.max(2, t.accuracyPct)}%`;
  bar.appendChild(fill);
  card.appendChild(bar);

  const meta = [];
  meta.push(t.subjectLabel);
  if (t.attempts > 0) meta.push(`${t.attempts} quiz${t.attempts === 1 ? "" : "zes"}`);
  if (t.total > 0) meta.push(`${t.total} questions`);
  if (t.daysSinceStudied !== null) meta.push(t.daysSinceStudied === 0 ? "studied today" : `${t.daysSinceStudied}d ago`);
  if (t.cardsDue > 0) meta.push(`${t.cardsDue} cards due`);
  if (t.mistakes > 0) meta.push(`${t.mistakes} mistakes`);
  card.appendChild(el("p", "brain-topic-meta", meta.join(" · ")));

  const tags = el("div", "brain-topic-tags");
  const status = el("span", "brain-topic-tag", STATUS_LABEL[t.status]);
  status.dataset.status = t.status;
  tags.appendChild(status);
  if (t.trend && t.trend.direction !== "steady") {
    const trend = el("span", "brain-topic-tag", `${t.trend.direction === "improving" ? "↑" : "↓"} ${t.trend.before}% → ${t.trend.after}%`);
    trend.dataset.trend = t.trend.direction;
    tags.appendChild(trend);
  }
  if (!t.graded) {
    tags.appendChild(el("span", "brain-topic-tag", `Needs ${4 - t.total} more question${4 - t.total === 1 ? "" : "s"} to score`));
  }
  card.appendChild(tags);

  const actions = el("div", "brain-topic-actions");
  const quizBtn = el("button", "btn btn-ghost brain-btn-sm", "Quiz me");
  quizBtn.type = "button";
  quizBtn.addEventListener("click", () => runAction({ type: "quiz", topic: t.topic, subject: t.subject }));
  const cardsBtn = el("button", "btn btn-ghost brain-btn-sm", "Flashcards");
  cardsBtn.type = "button";
  cardsBtn.addEventListener("click", () => runAction({ type: "flashcards", topic: t.topic, subject: t.subject }));
  actions.appendChild(quizBtn);
  actions.appendChild(cardsBtn);
  card.appendChild(actions);

  return card;
}

function renderTopics() {
  const intel = getTopicIntel();
  topicsGrid.innerHTML = "";
  if (intel.topics.length === 0) {
    topicsEmpty.hidden = false;
    topicsEmpty.textContent = "No topics yet. Every quiz you take and every deck you make adds one here — H1 doesn't guess at subjects you haven't studied.";
    return;
  }
  topicsEmpty.hidden = true;
  intel.topics.forEach((t) => topicsGrid.appendChild(topicCard(t)));
}

// ---------------------------------------------------------------------------
// "I'm Cooked"
// ---------------------------------------------------------------------------

function populateCookedSubjects() {
  if (!cookedSubject) return;
  const current = cookedSubject.value;
  cookedSubject.innerHTML = "";
  const all = el("option", null, "Everything");
  all.value = "all";
  cookedSubject.appendChild(all);
  getAllSubjects().forEach((s) => {
    const opt = el("option", null, s.label);
    opt.value = s.key;
    cookedSubject.appendChild(opt);
  });
  if (current) cookedSubject.value = current;
}

function renderCooked() {
  const minutes = Number(cookedMinutes.value) || 60;
  const subject = cookedSubject.value === "all" ? null : cookedSubject.value;
  const topic = cookedTopic.value.trim() || null;
  const plan = getEmergencyPlan({ minutes, subject, topic });

  cookedResult.innerHTML = "";

  if (!plan.ready) {
    cookedResult.appendChild(el("p", "brain-empty-line", plan.note));
    return;
  }

  const header = el("div", "cooked-summary");
  header.appendChild(el("strong", null, `${plan.totalMinutes} minutes, ${plan.blocks.length} block${plan.blocks.length === 1 ? "" : "s"}`));
  header.appendChild(el("p", "cooked-note", plan.note));
  cookedResult.appendChild(header);

  plan.blocks.forEach((b) => {
    const row = el("div", "cooked-block");
    row.dataset.level = b.level;
    const num = el("div", "cooked-block-num", String(b.order));
    const main = el("div", "cooked-block-main");
    main.appendChild(el("div", "cooked-block-title", b.title));
    if (b.detail) main.appendChild(el("p", "cooked-block-detail", b.detail));
    main.appendChild(whyToggle(b.why));
    const side = el("div", "cooked-block-side");
    side.appendChild(el("span", "mission-time", `${b.minutes} min`));
    const btn = actionButton(b.action);
    if (btn) side.appendChild(btn);
    row.appendChild(num);
    row.appendChild(main);
    row.appendChild(side);
    cookedResult.appendChild(row);
  });
}

function openCooked() {
  cookedPanel.hidden = false;
  cookedBtn.setAttribute("aria-expanded", "true");
  renderCooked();
  cookedMinutes.focus();
}

function closeCooked() {
  cookedPanel.hidden = true;
  cookedBtn.setAttribute("aria-expanded", "false");
  cookedBtn.focus();
}

// ---------------------------------------------------------------------------

export function renderBrain() {
  invalidateBrain();
  const state = getBrainState();

  const enough = state.hasEnoughData;
  brainEmpty.hidden = enough;
  brainBody.hidden = !enough;

  if (!enough) {
    brainEmpty.innerHTML = "";
    brainEmpty.appendChild(el("div", "brain-empty-icon", "🧠"));
    brainEmpty.appendChild(el("h2", null, "H1 is still getting to know you"));
    brainEmpty.appendChild(
      el(
        "p",
        null,
        `Your Learning Brain is built entirely from what you actually do in H1 — quizzes you take, mistakes you save, homework you set, cards you review. So far it has ${state.eventCount} of the ${state.minEventsForInsight} actions it needs before it will say anything about how you're doing. It won't guess in the meantime.`
      )
    );
    const row = el("div", "brain-empty-actions");
    const quizBtn = el("button", "btn btn-primary", "Take a quiz");
    quizBtn.type = "button";
    quizBtn.addEventListener("click", () => switchView("quiz"));
    const hwBtn = el("button", "btn btn-ghost", "Add homework");
    hwBtn.type = "button";
    hwBtn.addEventListener("click", () => switchView("homework"));
    const askBtn = el("button", "btn btn-ghost", "Ask H1 something");
    askBtn.type = "button";
    askBtn.addEventListener("click", () => switchView("chat"));
    row.appendChild(quizBtn);
    row.appendChild(hwBtn);
    row.appendChild(askBtn);
    brainEmpty.appendChild(row);
    return;
  }

  renderScore(state);
  renderStats(state);
  renderMission();
  renderSignals();
  renderTopics();
  if (!cookedPanel.hidden) renderCooked();
}

export function initBrain() {
  if (!brainBody) return;
  populateCookedSubjects();

  missionBudget.addEventListener("change", renderMission);

  if (brainBossBtn) brainBossBtn.addEventListener("click", () => switchView("boss"));
  cookedBtn.addEventListener("click", () => (cookedPanel.hidden ? openCooked() : closeCooked()));
  cookedCloseBtn.addEventListener("click", closeCooked);
  cookedBuildBtn.addEventListener("click", renderCooked);
  cookedMinutes.addEventListener("change", renderCooked);
  cookedSubject.addEventListener("change", renderCooked);
  cookedTopic.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      renderCooked();
    }
  });
  cookedPanel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCooked();
  });

  // Anything logged anywhere in H1 can change what the Brain should be saying, so re-derive
  // rather than let the view drift out of sync with the data behind it.
  window.addEventListener("h1:activity-logged", () => {
    if (!document.getElementById("view-brain").hidden) renderBrain();
  });
}

export { getCompletedCount };
