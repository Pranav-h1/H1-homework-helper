// H1 Second Brain — the read-only intelligence layer.
//
// Everything here is DERIVED from data the student actually generated: the progress event
// log, the mistake book, flashcard scheduling state, planner items, homework tasks and
// goals. This module never writes, never migrates, and never invents a number. If there
// isn't enough real evidence for a claim, the claim isn't made — the relevant field comes
// back null and `hasEnoughData` says so, so the UI can say "not enough data yet" instead of
// showing a confident-looking zero.
//
// Every signal carries a plain-English `reason` describing exactly which observations
// produced it. That's deliberate: a student should always be able to ask "why is H1 telling
// me this?" and get an answer traceable to their own activity.
import { getEvents, getStats, getStreak, getWeeklyStats } from "./progress.js";
import { getActiveMistakes, getResolvedMistakes, getMistakePatterns } from "./mistakeBookStore.js";
import { getDecks, getDueCount, getMasteredCount, getTotalDueCount } from "./flashcardDecks.js";
import { getItems, getExamGroups, getGrouped } from "./plannerStore.js";
import { getTasks } from "./homeworkStore.js";
import { getGoals, getGoalProgress, getDailyGoalMinutes } from "./goalsStore.js";
import { getAllSubjects, getSubjectSummary } from "./subjectsStore.js";
import { getDocuments } from "./documentsStore.js";
import { loadConversations } from "./conversations.js";
import { getXP, getLevel } from "./gamification.js";
import { matchesCurrentSpace } from "./spacesStore.js";
import { SUBJECT_LABELS } from "./state.js";

const DAY_MS = 86400000;

// Accuracy bands. A topic only gets a band once there's enough evidence to justify one
// (see MIN_QUESTIONS_FOR_BAND) — otherwise its status is "unknown", not "weak".
const WEAK_PCT = 60;
const SOLID_PCT = 80;
// Exported so anything else that decides "is there enough evidence to judge this?" uses the
// same bar rather than inventing its own.
export const MIN_QUESTIONS_FOR_BAND = 4;
const MIN_ATTEMPTS_FOR_TREND = 4;

// Spaced-review thresholds. These are review *prompts*, not claims about memory decay:
// a topic scored well on three weeks ago is worth another look, and the reason text says
// exactly that rather than pretending to have measured forgetting.
const STALE_DAYS_SHAKY = 5;
const STALE_DAYS_SOLID = 12;

// How much real activity has to exist before the Brain will draw conclusions at all.
const MIN_EVENTS_FOR_INSIGHT = 5;

const LEVEL_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Whole days from a YYYY-MM-DD date string to today. Negative = already past.
function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / DAY_MS);
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / DAY_MS);
}

function subjectLabel(key) {
  if (!key) return "General";
  if (SUBJECT_LABELS[key]) return SUBJECT_LABELS[key];
  const custom = getAllSubjects().find((s) => s.key === key);
  return custom ? custom.label : key;
}

function pluralDays(n) {
  if (n === 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

// ---------------------------------------------------------------------------
// Memoisation
//
// A full derivation walks the event log several times. Nothing here mutates state, so the
// result is safe to reuse within a single render pass — but it must never go stale, so the
// cache is dropped the moment anything logs new activity.
// ---------------------------------------------------------------------------

let cache = null;
const CACHE_TTL_MS = 1500;

export function invalidateBrain() {
  cache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("h1:activity-logged", invalidateBrain);
  window.addEventListener("h1:space-changed", invalidateBrain);
  window.addEventListener("storage", invalidateBrain);
}

function memo(key, compute) {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) cache = { at: now, values: {} };
  if (!(key in cache.values)) cache.values[key] = compute();
  return cache.values[key];
}

// ---------------------------------------------------------------------------
// Topic intelligence
//
// A "topic" is any string the student's own activity attached to a quiz, a flashcard deck
// or a mistake-book entry. We never seed a topic list — if they've never studied it, the
// Brain doesn't know it exists.
// ---------------------------------------------------------------------------

export function getTopicIntel() {
  return memo("topics", () => {
    const events = getEvents();
    const topics = {};

    function ensure(name, subject) {
      const key = String(name).trim();
      if (!topics[key]) {
        topics[key] = {
          topic: key,
          subject: subject || "general",
          attempts: 0,
          correct: 0,
          total: 0,
          scores: [],
          lastQuizAt: null,
          lastStudiedAt: null,
          flashcardReps: 0,
          mistakes: 0,
          cardsDue: 0,
          cardsTotal: 0,
          cardsMastered: 0,
        };
      }
      // Keep the most recent non-general subject tag seen for this topic.
      if (subject && subject !== "general") topics[key].subject = subject;
      return topics[key];
    }

    events.forEach((e) => {
      if (!e.topic) return;
      if (e.type === "quiz_completed") {
        const t = ensure(e.topic, e.subject);
        const total = Number(e.total) || 0;
        const score = Number(e.score) || 0;
        t.attempts += 1;
        t.correct += score;
        t.total += total;
        if (total > 0) t.scores.push({ ts: e.ts, pct: Math.round((score / total) * 100) });
        if (!t.lastQuizAt || e.ts > t.lastQuizAt) t.lastQuizAt = e.ts;
        if (!t.lastStudiedAt || e.ts > t.lastStudiedAt) t.lastStudiedAt = e.ts;
      } else if (e.type === "flashcards_studied") {
        const t = ensure(e.topic, e.subject);
        t.flashcardReps += Number(e.count) || 0;
        if (!t.lastStudiedAt || e.ts > t.lastStudiedAt) t.lastStudiedAt = e.ts;
      }
    });

    // Active only: a mistake the student has drilled back to correct twice is no longer a
    // gap, and counting it would keep a fixed topic looking broken.
    getActiveMistakes().forEach((m) => {
      if (!m.topic) return;
      const t = ensure(m.topic, m.subject);
      t.mistakes += 1;
    });

    // Flashcard decks are keyed by topic too — fold their real scheduling state in so the
    // Brain knows what's actually due, not just what was quizzed.
    getDecks()
      .filter((d) => matchesCurrentSpace(d.spaceId))
      .forEach((deck) => {
        if (!deck.topic) return;
        const t = ensure(deck.topic, deck.subject);
        t.cardsDue += getDueCount(deck);
        t.cardsTotal += deck.cards.length;
        t.cardsMastered += getMasteredCount(deck);
        if (deck.lastReviewedAt && (!t.lastStudiedAt || deck.lastReviewedAt > t.lastStudiedAt)) {
          t.lastStudiedAt = deck.lastReviewedAt;
        }
      });

    const list = Object.values(topics).map((t) => {
      const accuracyPct = t.total > 0 ? Math.round((t.correct / t.total) * 100) : null;
      // A band is only honest once enough questions have been answered to mean something.
      // Two lucky questions is not evidence of mastery, and one unlucky one is not a weakness.
      const graded = t.total >= MIN_QUESTIONS_FOR_BAND && accuracyPct !== null;
      let status = "unknown";
      if (graded) {
        if (accuracyPct < WEAK_PCT) status = "weak";
        else if (accuracyPct < SOLID_PCT) status = "shaky";
        else status = "solid";
      }
      const confidence = !graded ? "low" : t.total >= 15 ? "high" : t.total >= 8 ? "medium" : "low";

      // Trend needs enough attempts to split in half without one quiz dominating.
      let trend = null;
      if (t.scores.length >= MIN_ATTEMPTS_FOR_TREND) {
        const ordered = [...t.scores].sort((a, b) => a.ts - b.ts);
        const mid = Math.floor(ordered.length / 2);
        const avg = (arr) => Math.round(arr.reduce((s, x) => s + x.pct, 0) / arr.length);
        const before = avg(ordered.slice(0, mid));
        const after = avg(ordered.slice(mid));
        const delta = after - before;
        if (Math.abs(delta) >= 10) trend = { direction: delta > 0 ? "improving" : "slipping", delta, before, after };
        else trend = { direction: "steady", delta, before, after };
      }

      const sinceStudied = daysSince(t.lastStudiedAt);
      const staleAfter = status === "solid" ? STALE_DAYS_SOLID : STALE_DAYS_SHAKY;
      const isStale = sinceStudied !== null && sinceStudied >= staleAfter;

      return {
        ...t,
        label: t.topic,
        subjectLabel: subjectLabel(t.subject),
        accuracyPct,
        graded,
        status,
        confidence,
        trend,
        daysSinceStudied: sinceStudied,
        isStale,
        // A single number the dashboard can sort and size nodes by. Only meaningful when
        // graded; ungraded topics sort by recency instead.
        strength: graded ? accuracyPct : null,
      };
    });

    list.sort((a, b) => {
      if (a.graded !== b.graded) return a.graded ? -1 : 1;
      if (a.graded) return a.accuracyPct - b.accuracyPct;
      return (b.lastStudiedAt || 0) - (a.lastStudiedAt || 0);
    });

    return {
      topics: list,
      graded: list.filter((t) => t.graded),
      weak: list.filter((t) => t.status === "weak"),
      shaky: list.filter((t) => t.status === "shaky"),
      solid: list.filter((t) => t.status === "solid"),
      unknown: list.filter((t) => t.status === "unknown"),
      stale: list.filter((t) => t.isStale && t.graded),
      hasEnoughData: list.some((t) => t.graded),
    };
  });
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

function signal(s) {
  return {
    minutes: 10,
    confidence: "medium",
    action: null,
    ...s,
    weight: (LEVEL_WEIGHT[s.level] || 1) * 100 + (s.bump || 0),
  };
}

// Deadlines and exams — the things with a clock on them always outrank everything else.
function deadlineSignals() {
  const out = [];
  const today = todayStr();

  getExamGroups().forEach((g) => {
    const days = daysUntilDate(g.examDate);
    if (days === null || days < 0) return;
    const remaining = g.total - g.done;
    const level = days <= 2 ? "critical" : days <= 7 ? "high" : "medium";
    const name = g.groupLabel || subjectLabel(g.subject);
    out.push(
      signal({
        id: `exam:${g.groupId}`,
        kind: "exam",
        level,
        bump: Math.max(0, 30 - days),
        title: `${name} exam ${days === 0 ? "is today" : `in ${pluralDays(days)}`}`,
        detail: `${g.done} of ${g.total} prep tasks done (${g.pct}%)`,
        reason: `Your exam plan for ${name} is dated ${g.examDate}, and ${remaining} of its ${g.total} prep tasks are still open.`,
        subject: g.subject,
        minutes: Math.min(45, Math.max(15, remaining * 10)),
        confidence: "high",
        action: { type: "view", view: "planner", label: "Open exam plan" },
      })
    );
  });

  getGoals()
    .filter((g) => g.type === "exam" && g.deadline && !g.done)
    .forEach((g) => {
      const days = daysUntilDate(g.deadline);
      if (days === null || days < 0) return;
      out.push(
        signal({
          id: `examgoal:${g.id}`,
          kind: "exam",
          level: days <= 2 ? "critical" : days <= 7 ? "high" : "medium",
          bump: Math.max(0, 30 - days),
          title: `${g.title} in ${pluralDays(days)}`,
          detail: subjectLabel(g.subject),
          reason: `You set this as an exam goal with a deadline of ${g.deadline}, and it isn't marked done.`,
          subject: g.subject,
          minutes: 25,
          confidence: "high",
          action: { type: "view", view: "planner", label: "Open goals" },
        })
      );
    });

  const overdueTasks = getTasks()
    .filter((t) => t.status !== "done" && t.deadline && t.deadline < today && matchesCurrentSpace(t.spaceId))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (overdueTasks.length > 0) {
    const worst = overdueTasks[0];
    const late = Math.abs(daysUntilDate(worst.deadline));
    const n = overdueTasks.length;
    out.push(
      signal({
        id: "hw:overdue",
        kind: "overdue",
        level: "critical",
        bump: Math.min(50, n * 5),
        title: n === 1 ? "1 homework task is overdue" : `${n} homework tasks are overdue`,
        detail: `Oldest: "${worst.title}" — ${pluralDays(late)} past its due date`,
        reason: `${n} task${n === 1 ? "" : "s"} in your homework list ${n === 1 ? "has" : "have"} a due date earlier than today and ${n === 1 ? "isn't" : "aren't"} marked done.`,
        subject: worst.subject,
        minutes: Math.min(40, overdueTasks.reduce((s, t) => s + (t.estimatedMinutes || 15), 0)),
        confidence: "high",
        action: { type: "view", view: "homework", label: "Open homework" },
      })
    );
  }

  const dueToday = getTasks().filter((t) => t.status !== "done" && t.deadline === today && matchesCurrentSpace(t.spaceId));
  if (dueToday.length > 0) {
    const n = dueToday.length;
    out.push(
      signal({
        id: "hw:today",
        kind: "due_today",
        level: "high",
        bump: n * 3,
        title: n === 1 ? "1 homework task is due today" : `${n} homework tasks are due today`,
        detail: dueToday.map((t) => t.title).slice(0, 3).join(", "),
        reason: `${n} homework task${n === 1 ? "" : "s"} in your list ${n === 1 ? "is" : "are"} dated ${today}.`,
        subject: dueToday[0].subject,
        minutes: Math.min(40, dueToday.reduce((s, t) => s + (t.estimatedMinutes || 15), 0)),
        confidence: "high",
        action: { type: "view", view: "homework", label: "Open homework" },
      })
    );
  }

  const grouped = getGrouped();
  const planNow = [...grouped.overdue, ...grouped.today];
  if (planNow.length > 0) {
    out.push(
      signal({
        id: "plan:now",
        kind: "plan_due",
        level: grouped.overdue.length > 0 ? "high" : "medium",
        bump: planNow.length * 2,
        title: `${planNow.length} study plan item${planNow.length === 1 ? "" : "s"} ${grouped.overdue.length > 0 ? "overdue or due today" : "due today"}`,
        detail: planNow.map((i) => i.title).slice(0, 3).join(", "),
        reason: `Your study planner has ${grouped.overdue.length} overdue and ${grouped.today.length} due-today item${grouped.today.length === 1 ? "" : "s"} still open.`,
        subject: planNow[0].subject,
        minutes: Math.min(45, planNow.reduce((s, i) => s + (i.estimatedMinutes || 15), 0)),
        confidence: "high",
        action: { type: "view", view: "planner", label: "Open planner" },
      })
    );
  }

  return out;
}

// What the student's own answers say about what they don't know yet.
function masterySignals() {
  const intel = getTopicIntel();
  const out = [];

  intel.weak.slice(0, 5).forEach((t) => {
    out.push(
      signal({
        id: `weak:${t.topic}`,
        kind: "weak_topic",
        level: t.accuracyPct < 40 ? "high" : "medium",
        bump: (100 - t.accuracyPct) / 2,
        title: `${t.topic} needs work`,
        detail: `${t.accuracyPct}% correct across ${t.attempts} quiz${t.attempts === 1 ? "" : "zes"}`,
        reason: `You've answered ${t.correct} of ${t.total} questions on ${t.topic} correctly across ${t.attempts} quiz${t.attempts === 1 ? "" : "zes"} — that's ${t.accuracyPct}%.`,
        topic: t.topic,
        subject: t.subject,
        minutes: 15,
        confidence: t.confidence,
        action: { type: "quiz", topic: t.topic, subject: t.subject, label: `Practise ${t.topic}` },
      })
    );
  });

  intel.shaky.slice(0, 3).forEach((t) => {
    out.push(
      signal({
        id: `shaky:${t.topic}`,
        kind: "shaky_topic",
        level: "medium",
        bump: SOLID_PCT - t.accuracyPct,
        title: `${t.topic} is nearly there`,
        detail: `${t.accuracyPct}% — one solid session from confident`,
        reason: `Your ${t.topic} accuracy is ${t.accuracyPct}% over ${t.total} questions: above the weak band but below ${SOLID_PCT}%.`,
        topic: t.topic,
        subject: t.subject,
        minutes: 12,
        confidence: t.confidence,
        action: { type: "quiz", topic: t.topic, subject: t.subject, label: `Practise ${t.topic}` },
      })
    );
  });

  intel.stale.slice(0, 4).forEach((t) => {
    // Don't double-report: a weak topic is already surfaced above with a stronger reason.
    if (t.status === "weak") return;
    out.push(
      signal({
        id: `stale:${t.topic}`,
        kind: "stale_topic",
        level: "low",
        bump: Math.min(60, t.daysSinceStudied),
        title: `You haven't revisited ${t.topic} in ${pluralDays(t.daysSinceStudied)}`,
        detail: t.accuracyPct !== null ? `You were at ${t.accuracyPct}% last time` : "Worth a refresher",
        reason: `Your last recorded ${t.topic} activity was ${pluralDays(t.daysSinceStudied)} ago. Leaving a gap this long is usually when things start to slip.`,
        topic: t.topic,
        subject: t.subject,
        minutes: 10,
        confidence: t.confidence,
        action: { type: "flashcards", topic: t.topic, subject: t.subject, label: `Review ${t.topic}` },
      })
    );
  });

  intel.topics
    .filter((t) => t.trend && t.trend.direction === "slipping")
    .slice(0, 2)
    .forEach((t) => {
      out.push(
        signal({
          id: `slipping:${t.topic}`,
          kind: "slipping",
          level: "high",
          bump: Math.abs(t.trend.delta),
          title: `${t.topic} is going backwards`,
          detail: `${t.trend.before}% → ${t.trend.after}% across ${t.attempts} attempts`,
          reason: `Averaging your first ${Math.floor(t.scores.length / 2)} ${t.topic} quizzes against the most recent ones, your score moved from ${t.trend.before}% to ${t.trend.after}%.`,
          topic: t.topic,
          subject: t.subject,
          minutes: 15,
          confidence: t.confidence,
          action: { type: "quiz", topic: t.topic, subject: t.subject, label: `Re-test ${t.topic}` },
        })
      );
    });

  return out;
}

// Review debt: cards the scheduler says are due, and mistakes that keep repeating.
function reviewSignals() {
  const out = [];
  const decks = getDecks().filter((d) => matchesCurrentSpace(d.spaceId));
  const dueTotal = decks.reduce((s, d) => s + getDueCount(d), 0);

  if (dueTotal > 0) {
    const topDeck = decks.map((d) => ({ d, due: getDueCount(d) })).sort((a, b) => b.due - a.due)[0];
    out.push(
      signal({
        id: "cards:due",
        kind: "cards_due",
        level: dueTotal >= 30 ? "high" : "medium",
        bump: Math.min(60, dueTotal),
        title: `${dueTotal} flashcard${dueTotal === 1 ? "" : "s"} due for review`,
        detail: `Most in "${topDeck.d.topic}" (${topDeck.due})`,
        reason: `Across ${decks.length} deck${decks.length === 1 ? "" : "s"}, ${dueTotal} card${dueTotal === 1 ? "" : "s"} ${dueTotal === 1 ? "has" : "have"} reached the review date the scheduler set.`,
        topic: topDeck.d.topic,
        subject: topDeck.d.subject,
        // Roughly four cards a minute, capped so a mission stays realistic.
        minutes: Math.min(20, Math.max(5, Math.round(dueTotal / 4))),
        confidence: "high",
        action: { type: "flashcards", topic: topDeck.d.topic, subject: topDeck.d.subject, label: "Review cards" },
      })
    );
  }

  const neverStudied = decks.filter((d) => !d.lastReviewedAt);
  if (neverStudied.length > 0) {
    const n = neverStudied.length;
    out.push(
      signal({
        id: "cards:untouched",
        kind: "unstarted_deck",
        level: "low",
        bump: n,
        title: `${n} deck${n === 1 ? "" : "s"} you've never studied`,
        detail: neverStudied.map((d) => d.topic).slice(0, 3).join(", "),
        reason: `${n} flashcard deck${n === 1 ? " has" : "s have"} no review recorded since being created.`,
        topic: neverStudied[0].topic,
        subject: neverStudied[0].subject,
        minutes: 10,
        confidence: "high",
        action: { type: "flashcards", topic: neverStudied[0].topic, subject: neverStudied[0].subject, label: "Start deck" },
      })
    );
  }

  // getMistakePatterns() groups by topic alone, so a pattern arrives with no subject on it.
  // Recover the subject from the entries themselves (most common wins) — without it, a
  // subject-filtered view has no way to tell a maths pattern from a Hindi one and shows both.
  const mistakes = getActiveMistakes();
  const subjectForTopic = (topic) => {
    const counts = {};
    mistakes.forEach((m) => {
      if ((m.topic || "General") !== topic || !m.subject) return;
      counts[m.subject] = (counts[m.subject] || 0) + 1;
    });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  };

  getMistakePatterns()
    .slice(0, 3)
    .forEach((p) => {
      out.push(
        signal({
          id: `pattern:${p.topic}`,
          kind: "mistake_pattern",
          level: p.count >= 4 ? "high" : "medium",
          bump: p.count * 6,
          title: `${p.topic} keeps catching you out`,
          detail: `${p.count} mistakes saved on this topic`,
          reason: `Your mistake book has ${p.count} separate entries filed under ${p.topic}. Repeated mistakes on one topic usually mean a gap underneath, not carelessness.`,
          topic: p.topic,
          subject: subjectForTopic(p.topic),
          minutes: 12,
          confidence: "high",
          action: { type: "mistakes", topic: p.topic, label: "Replay mistakes" },
        })
      );
    });

  return out;
}

// Habit signals — streaks and the daily goal. These are about consistency, not knowledge.
function habitSignals() {
  const out = [];
  const events = getEvents();
  const todayStart = startOfToday();
  const todayEvents = events.filter((e) => e.ts >= todayStart);
  const streak = getStreak();

  if (streak >= 2 && todayEvents.length === 0) {
    out.push(
      signal({
        id: "streak:risk",
        kind: "streak_risk",
        level: "medium",
        bump: Math.min(50, streak * 3),
        title: `Your ${streak}-day streak is at risk`,
        detail: "Nothing logged yet today",
        reason: `You've studied ${streak} days in a row, but no activity has been recorded today yet.`,
        minutes: 10,
        confidence: "high",
        action: { type: "view", view: "focus", label: "Start a session" },
      })
    );
  }

  const goalMinutes = getDailyGoalMinutes();
  const minutesToday = todayEvents.filter((e) => e.type === "study_session").reduce((s, e) => s + (e.minutes || 0), 0);
  if (minutesToday < goalMinutes) {
    const remaining = goalMinutes - minutesToday;
    out.push(
      signal({
        id: "goal:daily",
        kind: "daily_goal",
        level: "low",
        bump: 10,
        title: `${remaining} min left on today's goal`,
        detail: `${minutesToday} of ${goalMinutes} min done`,
        reason: `Your daily goal is ${goalMinutes} minutes of focused study, and ${minutesToday} minute${minutesToday === 1 ? "" : "s"} of focus sessions ${minutesToday === 1 ? "has" : "have"} been logged today.`,
        minutes: Math.min(30, remaining),
        confidence: "high",
        action: { type: "view", view: "focus", label: "Open focus timer" },
      })
    );
  }

  getGoals()
    .filter((g) => (g.type === "daily" || g.type === "weekly") && !g.done)
    .slice(0, 2)
    .forEach((g) => {
      const p = getGoalProgress(g);
      if (p.pct >= 100) return;
      out.push(
        signal({
          id: `goal:${g.id}`,
          kind: "goal_gap",
          level: "low",
          bump: p.pct / 10,
          title: `${g.title} — ${p.pct}%`,
          detail: `${p.current} of ${p.target} min`,
          reason: `This is a ${g.type} goal you created. Progress is measured from focus-session minutes actually logged in the period.`,
          subject: g.subject,
          minutes: Math.min(25, Math.max(5, p.target - p.current)),
          confidence: "high",
          action: { type: "view", view: "focus", label: "Work on it" },
        })
      );
    });

  return out;
}

// Loose ends left open elsewhere in H1.
function loopSignals() {
  const out = [];

  const cold = getAllSubjects()
    .map((s) => ({ subject: s, summary: getSubjectSummary(s.key) }))
    .filter((x) => x.summary.homeworkOpen > 0 && x.summary.questions === 0 && x.summary.quizzes === 0);
  if (cold.length > 0) {
    const x = cold[0];
    const n = x.summary.homeworkOpen;
    out.push(
      signal({
        id: `subject:cold:${x.subject.key}`,
        kind: "cold_subject",
        level: "low",
        bump: n,
        title: `${x.subject.label} has work but no study time`,
        detail: `${n} open task${n === 1 ? "" : "s"}, no quizzes or questions yet`,
        reason: `${x.subject.label} has ${n} open homework task${n === 1 ? "" : "s"} but no recorded questions, quizzes or study minutes.`,
        subject: x.subject.key,
        minutes: 15,
        confidence: "high",
        action: { type: "chat", subject: x.subject.key, label: `Ask about ${x.subject.label}` },
      })
    );
  }

  return out;
}

// The full, ordered signal list. Highest priority first.
export function getSignals() {
  return memo("signals", () => {
    const all = [...deadlineSignals(), ...masterySignals(), ...reviewSignals(), ...habitSignals(), ...loopSignals()];
    all.sort((a, b) => b.weight - a.weight);
    return all;
  });
}

// ---------------------------------------------------------------------------
// The Brain snapshot — everything the Learning Brain dashboard renders from.
// ---------------------------------------------------------------------------

export function getBrainState() {
  return memo("state", () => {
    const events = getEvents();
    const stats = getStats();
    const weekly = getWeeklyStats();
    const intel = getTopicIntel();
    const signals = getSignals();
    const xp = getXP();
    const decks = getDecks().filter((d) => matchesCurrentSpace(d.spaceId));
    const tasks = getTasks().filter((t) => matchesCurrentSpace(t.spaceId));
    const planItems = getItems().filter((i) => matchesCurrentSpace(i.spaceId));

    const hasEnoughData = events.length >= MIN_EVENTS_FOR_INSIGHT;
    const todayStart = startOfToday();
    const activeToday = events.some((e) => e.ts >= todayStart);

    // A single 0–100 "brain health" figure, but only from components there's real evidence
    // for. Each one states its own inputs so the UI can show the breakdown rather than an
    // unexplained score, and a component with no data is left out instead of counted as zero.
    const components = [];
    if (intel.graded.length > 0) {
      const avg = Math.round(intel.graded.reduce((s, t) => s + t.accuracyPct, 0) / intel.graded.length);
      components.push({
        key: "accuracy",
        label: "Accuracy",
        value: avg,
        reason: `Average accuracy across ${intel.graded.length} topic${intel.graded.length === 1 ? "" : "s"} with at least ${MIN_QUESTIONS_FOR_BAND} answered questions.`,
      });
    }
    const totalCards = decks.reduce((s, d) => s + d.cards.length, 0);
    if (totalCards > 0) {
      const due = decks.reduce((s, d) => s + getDueCount(d), 0);
      components.push({
        key: "review",
        label: "Review debt",
        value: Math.round(((totalCards - due) / totalCards) * 100),
        reason: `${totalCards - due} of your ${totalCards} flashcards are not currently due for review.`,
      });
    }
    const dated = tasks.filter((t) => t.deadline);
    if (dated.length > 0) {
      const today = todayStr();
      const late = dated.filter((t) => t.status !== "done" && t.deadline < today).length;
      components.push({
        key: "deadlines",
        label: "Deadlines",
        value: Math.round(((dated.length - late) / dated.length) * 100),
        reason: `${late} of your ${dated.length} dated homework task${dated.length === 1 ? " is" : "s are"} past due.`,
      });
    }
    if (events.length > 0) {
      const activeDays = new Set(
        events.filter((e) => e.ts >= Date.now() - 14 * DAY_MS).map((e) => new Date(e.ts).toDateString())
      ).size;
      components.push({
        key: "consistency",
        label: "Consistency",
        value: Math.round((activeDays / 14) * 100),
        reason: `You were active on ${activeDays} of the last 14 days.`,
      });
    }
    const score = components.length > 0 ? Math.round(components.reduce((s, c) => s + c.value, 0) / components.length) : null;

    return {
      hasEnoughData,
      eventCount: events.length,
      minEventsForInsight: MIN_EVENTS_FOR_INSIGHT,
      score,
      scoreComponents: components,
      streak: stats.streak,
      activeToday,
      level: getLevel(xp),
      stats,
      weekly,
      topics: intel,
      signals,
      counts: {
        decks: decks.length,
        cards: totalCards,
        cardsDue: getTotalDueCount(),
        openHomework: tasks.filter((t) => t.status !== "done").length,
        planOpen: planItems.filter((i) => !i.done).length,
        mistakes: getActiveMistakes().length,
        mistakesResolved: getResolvedMistakes().length,
        documents: getDocuments().length,
        conversations: loadConversations().length,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Today's Mission
//
// A short, ordered plan built from the highest-priority real signals that fits inside a
// time budget. It is generated, not stored — if the underlying signals change (a task gets
// done, a quiz gets taken), the mission changes with them.
// ---------------------------------------------------------------------------

// One task per kind keeps a mission varied — five "practise topic X" steps is not a plan.
const MISSION_KIND_LIMIT = { weak_topic: 2, stale_topic: 1, shaky_topic: 1 };

// How many extra "if you get through that" steps to offer past the stated time budget.
const MISSION_STRETCH_LIMIT = 2;

export function getMission({ minutes } = {}) {
  const budget = Number(minutes) > 0 ? Number(minutes) : getDailyGoalMinutes();
  const signals = getSignals();
  const state = getBrainState();

  if (!state.hasEnoughData) {
    return {
      ready: false,
      budget,
      tasks: [],
      stretch: [],
      totalMinutes: 0,
      reason: `H1 needs a bit more to go on — ${state.eventCount} of ${MIN_EVENTS_FOR_INSIGHT} study actions recorded so far. Ask a question, take a quiz or finish a task and your first mission will build itself.`,
    };
  }

  const used = {};
  const tasks = [];
  const stretch = [];
  let spent = 0;

  const toTask = (s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    detail: s.detail,
    why: s.reason,
    minutes: s.minutes,
    level: s.level,
    topic: s.topic || null,
    subject: s.subject || null,
    action: s.action,
    // XP for the mission tick itself. The underlying work still earns its own XP through
    // the normal event log — this is a small bonus for following the plan, not a parallel
    // currency, and it is only granted once per task per day (see missionStore).
    xp: s.level === "critical" ? 25 : s.level === "high" ? 20 : s.level === "medium" ? 15 : 10,
  });

  signals.forEach((s) => {
    if (spent >= budget) return;
    const limit = MISSION_KIND_LIMIT[s.kind] ?? 1;
    if ((used[s.kind] || 0) >= limit) return;
    // Allow a slight overshoot rather than leaving the plan short, but never on the first
    // task — a single oversized step would otherwise blow the whole budget.
    if (spent > 0 && spent + s.minutes > budget + 5) return;
    used[s.kind] = (used[s.kind] || 0) + 1;
    tasks.push(toTask(s));
    spent += s.minutes;
  });

  // One honest 30-minute task can fill a 30-minute budget on its own, which leaves a plan of
  // exactly one line. Rather than shrink the estimate to pad the list out — that would be
  // lying about how long the work takes — the next couple of priorities are offered
  // separately as "if you get through that", clearly outside the time they said they had.
  const chosen = new Set(tasks.map((t) => t.id));
  signals.forEach((s) => {
    if (stretch.length >= MISSION_STRETCH_LIMIT || chosen.has(s.id)) return;
    const limit = MISSION_KIND_LIMIT[s.kind] ?? 1;
    if ((used[s.kind] || 0) >= limit) return;
    used[s.kind] = (used[s.kind] || 0) + 1;
    chosen.add(s.id);
    stretch.push({ ...toTask(s), stretch: true });
  });

  return {
    ready: tasks.length > 0,
    budget,
    tasks,
    stretch,
    totalMinutes: spent,
    reason:
      tasks.length > 0
        ? `Built from your ${signals.length} active signal${signals.length === 1 ? "" : "s"}, highest priority first, trimmed to about ${budget} minutes.`
        : "Nothing is pressing right now — no overdue work, nothing due for review, and no weak topics on record. Good place to be.",
  };
}

// ---------------------------------------------------------------------------
// "I'm Cooked" — the emergency plan
//
// For when there isn't time to do it properly. Same signals, ruthlessly filtered to what's
// actually about to matter, and time-boxed into ordered blocks that add up to the minutes
// the student says they have left.
// ---------------------------------------------------------------------------

const EMERGENCY_KINDS = ["exam", "overdue", "due_today", "plan_due", "weak_topic", "slipping", "mistake_pattern", "cards_due", "shaky_topic"];

export function getEmergencyPlan({ minutes = 60, subject = null, topic = null } = {}) {
  const budget = Math.max(10, Math.round(Number(minutes) || 60));
  const state = getBrainState();
  let signals = getSignals().filter((s) => EMERGENCY_KINDS.includes(s.kind));

  if (subject && subject !== "all") signals = signals.filter((s) => !s.subject || s.subject === subject);
  if (topic) {
    const needle = topic.trim().toLowerCase();
    const focused = signals.filter((s) => (s.topic || "").toLowerCase().includes(needle));
    if (focused.length > 0) signals = focused;
  }

  if (signals.length === 0) {
    return {
      ready: false,
      budget,
      blocks: [],
      totalMinutes: 0,
      subject,
      topic,
      note: state.hasEnoughData
        ? "There's nothing urgent on record for that filter — no deadline, no weak topic, no review backlog. If you're panicking about something H1 hasn't seen yet, run a quiz on it and it'll show up here."
        : `H1 doesn't have enough of your activity yet (${state.eventCount} of ${MIN_EVENTS_FOR_INSIGHT} actions) to triage anything. Take a quick quiz on what you're worried about and try again.`,
    };
  }

  // Split the budget proportionally to signal weight, rounded into 5-minute blocks. The
  // last block absorbs whatever is left so the plan always totals exactly the budget.
  const picked = signals.slice(0, Math.max(2, Math.min(6, Math.round(budget / 12))));
  const weightSum = picked.reduce((s, x) => s + x.weight, 0);
  let remaining = budget;
  const blocks = picked.map((s, i) => {
    const isLast = i === picked.length - 1;
    const share = isLast ? remaining : Math.max(5, Math.round(((s.weight / weightSum) * budget) / 5) * 5);
    const mins = Math.max(0, Math.min(remaining, share));
    remaining -= mins;
    return {
      order: i + 1,
      minutes: mins,
      kind: s.kind,
      title: s.title,
      detail: s.detail,
      why: s.reason,
      topic: s.topic || null,
      subject: s.subject || null,
      action: s.action,
      level: s.level,
    };
  });

  const kept = blocks.filter((b) => b.minutes > 0).map((b, i) => ({ ...b, order: i + 1 }));
  return {
    ready: kept.length > 0,
    budget,
    subject,
    topic,
    blocks: kept,
    totalMinutes: kept.reduce((s, b) => s + b.minutes, 0),
    note: `Ordered by what costs you most if you skip it. Times are a split of your ${budget} minutes weighted by urgency — not a promise you'll finish everything.`,
  };
}

// ---------------------------------------------------------------------------
// AI context
//
// A compact briefing on the student's real H1 state, prepended to an outgoing chat message
// so the tutor can answer "what should I study?" or "how am I doing in maths?" from actual
// data instead of guessing. Kept well under the request size budget, and honest: a section
// with no real data is omitted rather than padded with zeroes.
// ---------------------------------------------------------------------------

const AI_CONTEXT_MAX_CHARS = 2600;

export function buildAiContext({ maxChars = AI_CONTEXT_MAX_CHARS } = {}) {
  const state = getBrainState();
  if (!state.hasEnoughData) return "";

  const lines = [];
  const s = state.stats;

  lines.push(
    `Study streak: ${state.streak} day${state.streak === 1 ? "" : "s"}${state.activeToday ? " (active today)" : " (nothing logged yet today)"}.`
  );
  lines.push(`Lifetime: ${s.totalQuestions} questions asked, ${s.quizzesCompleted} quizzes, ${s.studyMinutes} focus minutes, ${s.notesCreated} notes.`);
  if (s.avgScorePct !== null) lines.push(`Overall quiz accuracy: ${s.avgScorePct}%.`);
  if (state.score !== null) {
    lines.push(`H1 brain score: ${state.score}/100 (${state.scoreComponents.map((c) => `${c.label} ${c.value}`).join(", ")}).`);
  }

  const weak = state.topics.weak.slice(0, 5);
  if (weak.length > 0) {
    lines.push(`Weakest topics (real quiz accuracy): ${weak.map((t) => `${t.topic} ${t.accuracyPct}% over ${t.total} questions`).join("; ")}.`);
  }
  const solid = state.topics.solid.slice(0, 4);
  if (solid.length > 0) lines.push(`Strong topics: ${solid.map((t) => `${t.topic} ${t.accuracyPct}%`).join("; ")}.`);
  const stale = state.topics.stale.slice(0, 4);
  if (stale.length > 0) lines.push(`Not reviewed recently: ${stale.map((t) => `${t.topic} (${t.daysSinceStudied}d ago)`).join("; ")}.`);

  const subjectBits = getAllSubjects()
    .map((sub) => ({ sub, sum: getSubjectSummary(sub.key) }))
    .filter((x) => x.sum.hasActivity)
    .slice(0, 8)
    .map(({ sub, sum }) => {
      const parts = [];
      if (sum.questions) parts.push(`${sum.questions}q`);
      if (sum.quizzes) parts.push(`${sum.quizzes} quizzes`);
      if (sum.avgScorePct !== null) parts.push(`${sum.avgScorePct}%`);
      if (sum.studyMinutes) parts.push(`${sum.studyMinutes}min`);
      if (sum.homeworkOpen) parts.push(`${sum.homeworkOpen} open hw`);
      return `${sub.label}: ${parts.join(", ")}`;
    });
  if (subjectBits.length > 0) lines.push(`Subjects: ${subjectBits.join(" | ")}.`);

  const exams = getExamGroups()
    .map((g) => ({ g, days: daysUntilDate(g.examDate) }))
    .filter((x) => x.days !== null && x.days >= 0)
    .slice(0, 3);
  if (exams.length > 0) {
    lines.push(
      `Upcoming exams: ${exams
        .map((x) => `${x.g.groupLabel || subjectLabel(x.g.subject)} in ${x.days} day${x.days === 1 ? "" : "s"} (${x.g.pct}% prepped)`)
        .join("; ")}.`
    );
  }

  const today = todayStr();
  const openTasks = getTasks()
    .filter((t) => t.status !== "done" && matchesCurrentSpace(t.spaceId))
    .sort((a, b) => (a.deadline || "9999-99-99").localeCompare(b.deadline || "9999-99-99"))
    .slice(0, 5);
  if (openTasks.length > 0) {
    lines.push(
      `Open homework: ${openTasks
        .map((t) => `"${t.title}"${t.deadline ? ` due ${t.deadline}${t.deadline < today ? " (OVERDUE)" : ""}` : ""}`)
        .join("; ")}.`
    );
  }

  if (state.counts.cardsDue > 0) {
    lines.push(`Flashcards due for review: ${state.counts.cardsDue} across ${state.counts.decks} deck(s).`);
  }

  const patterns = getMistakePatterns().slice(0, 4);
  if (patterns.length > 0) lines.push(`Repeated mistakes: ${patterns.map((p) => `${p.topic} (${p.count})`).join("; ")}.`);

  const top = state.signals.slice(0, 3);
  if (top.length > 0) lines.push(`H1's current priorities for them: ${top.map((x) => x.title).join("; ")}.`);

  let body = lines.join("\n");
  if (body.length > maxChars) body = body.slice(0, maxChars - 3) + "...";

  return (
    "[H1 student context — real data from this student's own H1 account, not an example. " +
    "Use it to make your answer specific to them. Don't read it back as a list unless they ask, " +
    "and never state a figure that isn't in here.]\n" +
    body +
    "\n\n---\n\n"
  );
}

// A fingerprint of the facts in the briefing that actually change what advice is right:
// which topics are weak, what's due, what's coming up.
//
// Deliberately excludes the drifting counters — questions asked, streak, focus minutes, the
// brain score. Those tick on nearly every action (asking a question is itself a logged
// event), so including them would make the briefing look "changed" every single turn and
// defeat the point of only sending it when something meaningful moved.
export function getContextSignature() {
  const state = getBrainState();
  if (!state.hasEnoughData) return "";
  const parts = [
    state.topics.weak.map((t) => `${t.topic}:${t.accuracyPct}`).join(","),
    state.topics.shaky.map((t) => `${t.topic}:${t.accuracyPct}`).join(","),
    state.topics.solid.map((t) => t.topic).join(","),
    state.topics.stale.map((t) => t.topic).join(","),
    getExamGroups().map((g) => `${g.groupId}:${g.examDate}:${g.pct}`).join(","),
    getTasks()
      .filter((t) => t.status !== "done" && matchesCurrentSpace(t.spaceId))
      .map((t) => `${t.id}:${t.deadline}`)
      .join(","),
    // Bucketed: a single card falling due shouldn't trigger a resend, a batch should.
    `cards:${Math.floor(state.counts.cardsDue / 10)}`,
    getMistakePatterns().map((p) => `${p.topic}:${p.count}`).join(","),
    state.signals.slice(0, 3).map((s) => s.id).join(","),
  ];
  return parts.join("|");
}

// A short one-line version for places that only need a headline (dock, home widget).
export function getHeadline() {
  const state = getBrainState();
  if (!state.hasEnoughData) {
    return { text: "Study a little and H1 starts learning how you learn.", level: "low", reason: null, action: null };
  }
  const top = state.signals[0];
  if (!top) return { text: "Nothing pressing — you're on top of everything H1 can see.", level: "low", reason: null, action: null };
  return { text: top.title, level: top.level, reason: top.reason, action: top.action };
}
