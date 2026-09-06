import { safeGetJson, safeSetJson } from "./storage.js";
import { appState } from "./state.js";

const EVENTS_KEY = "h1-progress-events";
const MAX_EVENTS = 3000;
// A simple anti-exploit guard: low-effort events (e.g. sending trivial chat messages) stop
// earning XP after this many of that type on a single calendar day, per the "no infinite XP
// grinding" requirement. Real study actions (quizzes, sessions, homework) are unaffected.
const DAILY_XP_CAPS = { question: 40, note_created: 10 };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Every real, locally-observed study action gets logged here. Nothing in this file
// fabricates data — stats and streaks are always derived from what actually happened.
export function logEvent(type, data) {
  const events = safeGetJson(EVENTS_KEY, []);
  const subject = data && data.subject ? data.subject : appState.subject;
  const cap = DAILY_XP_CAPS[type];
  let xpEligible = true;
  if (cap) {
    const key = todayKey();
    const countToday = events.filter((e) => e.type === type && dayKey(e.ts) === key).length;
    xpEligible = countToday < cap;
  }
  events.push({ type, ts: Date.now(), subject, xpEligible, ...data });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  safeSetJson(EVENTS_KEY, events);
  // Decoupled signal (same pattern as h1:conversation-selected elsewhere) — lets gamification.js
  // react to new activity without progress.js needing to import it.
  window.dispatchEvent(new CustomEvent("h1:activity-logged"));
  return events;
}

export function getEvents() {
  return safeGetJson(EVENTS_KEY, []);
}

export function clearEvents() {
  safeSetJson(EVENTS_KEY, []);
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getStreak() {
  const events = getEvents();
  if (events.length === 0) return 0;
  const days = new Set(events.map((e) => dayKey(e.ts)));
  const cursor = new Date();
  if (!days.has(dayKey(cursor.getTime()))) {
    // No activity yet today — don't break the streak until yesterday also misses.
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// GitHub-style activity heatmap data — real event counts per day, oldest first.
export function getHeatmapDays(days = 182) {
  const events = getEvents();
  const counts = {};
  events.forEach((e) => {
    const key = dayKey(e.ts);
    counts[key] = (counts[key] || 0) + 1;
  });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    out.push({ date: d, key, count: counts[key] || 0 });
  }
  return out;
}

// Real subject -> topic relationships, derived only from quizzes actually taken — no
// fabricated edges. Each topic node carries the average score seen for it.
export function getKnowledgeGraphData() {
  const quizEvents = getEvents().filter((e) => e.type === "quiz_completed" && e.topic);
  const bySubject = {};
  quizEvents.forEach((e) => {
    const subject = e.subject || "general";
    if (!bySubject[subject]) bySubject[subject] = {};
    if (!bySubject[subject][e.topic]) bySubject[subject][e.topic] = { correct: 0, total: 0, count: 0 };
    const t = bySubject[subject][e.topic];
    t.correct += e.score || 0;
    t.total += e.total || 0;
    t.count += 1;
  });
  return Object.entries(bySubject).map(([subject, topics]) => ({
    subject,
    topics: Object.entries(topics).map(([topic, t]) => ({
      topic,
      avgPct: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
      count: t.count,
    })),
  }));
}

// Real, this-week-only numbers for the Weekly Review — computed the same honest way as
// getStats(), just scoped to the last 7 days instead of all time.
export function getWeeklyStats() {
  const weekAgo = Date.now() - 7 * 86400000;
  const events = getEvents().filter((e) => e.ts >= weekAgo);
  const quizEvents = events.filter((e) => e.type === "quiz_completed");
  const totalCorrect = quizEvents.reduce((sum, e) => sum + (e.score || 0), 0);
  const totalQuizQ = quizEvents.reduce((sum, e) => sum + (e.total || 0), 0);
  const subjectMinutes = {};
  events
    .filter((e) => e.type === "study_session")
    .forEach((e) => {
      const s = e.subject || "general";
      subjectMinutes[s] = (subjectMinutes[s] || 0) + (e.minutes || 0);
    });
  const strongest = Object.entries(subjectMinutes).sort((a, b) => b[1] - a[1])[0];

  return {
    studyMinutes: events.filter((e) => e.type === "study_session").reduce((sum, e) => sum + (e.minutes || 0), 0),
    questionsAsked: events.filter((e) => e.type === "question").length,
    quizzesCompleted: quizEvents.length,
    quizAccuracyPct: totalQuizQ > 0 ? Math.round((totalCorrect / totalQuizQ) * 100) : null,
    homeworkCompleted: events.filter((e) => e.type === "homework_completed").length,
    notesCreated: events.filter((e) => e.type === "note_created").length,
    strongestSubject: strongest ? strongest[0] : null,
    streak: getStreak(),
    hasAnyActivity: events.length > 0,
  };
}

export function getStats() {
  const events = getEvents();
  const quizEvents = events.filter((e) => e.type === "quiz_completed");
  const questionEvents = events.filter((e) => e.type === "question");
  const flashcardEvents = events.filter((e) => e.type === "flashcards_studied");
  const sessionEvents = events.filter((e) => e.type === "study_session");
  const noteEvents = events.filter((e) => e.type === "note_created");
  const planTaskEvents = events.filter((e) => e.type === "plan_task_done");
  const homeworkEvents = events.filter((e) => e.type === "homework_completed");
  const documentEvents = events.filter((e) => e.type === "document_created");
  const focusBreakEvents = events.filter((e) => e.type === "focus_break_completed");

  // Each quiz/practice question already logs its own "question" event, so this must not
  // also add quizEvents' totals — that would double-count every quiz question.
  const totalQuestions = questionEvents.length;
  const totalCorrect = quizEvents.reduce((sum, e) => sum + (e.score || 0), 0);
  const totalQuizQuestions = quizEvents.reduce((sum, e) => sum + (e.total || 0), 0);
  const avgScorePct = totalQuizQuestions > 0 ? Math.round((totalCorrect / totalQuizQuestions) * 100) : null;
  const flashcardsStudied = flashcardEvents.reduce((sum, e) => sum + (e.count || 0), 0);
  const studyMinutes = sessionEvents.reduce((sum, e) => sum + (e.minutes || 0), 0);

  const weakTopicsMap = {};
  quizEvents.forEach((e) => {
    if (!e.topic || !e.total) return;
    const pct = (e.score / e.total) * 100;
    if (pct < 70) {
      if (!weakTopicsMap[e.topic] || weakTopicsMap[e.topic].pct > pct) {
        weakTopicsMap[e.topic] = { topic: e.topic, pct: Math.round(pct) };
      }
    }
  });

  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    const count = events.filter((e) => dayKey(e.ts) === key).length;
    last14.push({ label: d.toLocaleDateString([], { weekday: "short" }), count });
  }

  // Per-subject breakdown — every logged event carries a subject (see logEvent), so this is
  // derived from real activity, never fabricated.
  const subjectMap = {};
  events.forEach((e) => {
    const subject = e.subject || "general";
    if (!subjectMap[subject]) {
      subjectMap[subject] = { subject, questions: 0, quizzes: 0, correct: 0, quizTotal: 0, studyMinutes: 0, notes: 0 };
    }
    const s = subjectMap[subject];
    if (e.type === "question") s.questions += 1;
    if (e.type === "quiz_completed") {
      s.quizzes += 1;
      s.correct += e.score || 0;
      s.quizTotal += e.total || 0;
    }
    if (e.type === "study_session") s.studyMinutes += e.minutes || 0;
    if (e.type === "note_created") s.notes += 1;
  });
  const subjectStats = Object.values(subjectMap)
    .map((s) => ({ ...s, avgScorePct: s.quizTotal > 0 ? Math.round((s.correct / s.quizTotal) * 100) : null }))
    .sort((a, b) => b.questions + b.quizzes * 5 - (a.questions + a.quizzes * 5));
  const subjectsExplored = subjectStats.filter((s) => s.subject !== "general" && (s.questions > 0 || s.quizzes > 0)).length;
  const strongestSubject = subjectStats.filter((s) => s.avgScorePct !== null).sort((a, b) => b.avgScorePct - a.avgScorePct)[0] || null;

  return {
    totalQuestions,
    quizzesCompleted: quizEvents.length,
    avgScorePct,
    flashcardsStudied,
    studyMinutes,
    notesCreated: noteEvents.length,
    planTasksDone: planTaskEvents.length,
    homeworkCompleted: homeworkEvents.length,
    documentsCreated: documentEvents.length,
    focusBreaksCompleted: focusBreakEvents.length,
    streak: getStreak(),
    weakTopics: Object.values(weakTopicsMap).sort((a, b) => a.pct - b.pct).slice(0, 6),
    last14Days: last14,
    subjectStats,
    subjectsExplored,
    strongestSubject,
    hasAnyActivity: events.length > 0,
  };
}
