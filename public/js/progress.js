import { safeGetJson, safeSetJson } from "./storage.js";

const EVENTS_KEY = "h1-progress-events";
const MAX_EVENTS = 3000;

// Every real, locally-observed study action gets logged here. Nothing in this file
// fabricates data — stats and streaks are always derived from what actually happened.
export function logEvent(type, data) {
  const events = safeGetJson(EVENTS_KEY, []);
  events.push({ type, ts: Date.now(), ...data });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  safeSetJson(EVENTS_KEY, events);
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

export function getStats() {
  const events = getEvents();
  const quizEvents = events.filter((e) => e.type === "quiz_completed");
  const questionEvents = events.filter((e) => e.type === "question");
  const flashcardEvents = events.filter((e) => e.type === "flashcards_studied");
  const sessionEvents = events.filter((e) => e.type === "study_session");
  const noteEvents = events.filter((e) => e.type === "note_created");
  const planTaskEvents = events.filter((e) => e.type === "plan_task_done");

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

  return {
    totalQuestions,
    quizzesCompleted: quizEvents.length,
    avgScorePct,
    flashcardsStudied,
    studyMinutes,
    notesCreated: noteEvents.length,
    planTasksDone: planTaskEvents.length,
    streak: getStreak(),
    weakTopics: Object.values(weakTopicsMap).sort((a, b) => a.pct - b.pct).slice(0, 6),
    last14Days: last14,
    hasAnyActivity: events.length > 0,
  };
}
