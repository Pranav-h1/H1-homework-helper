// Code Lab progress: which lessons are done, and the code the student actually wrote.
//
// Their code is saved per lesson and never discarded, so coming back to a finished lesson
// shows what they wrote rather than resetting them to the starter.
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";

const KEY = "h1-code-progress";

function readAll() {
  const raw = safeGetJson(KEY, null);
  if (!raw || typeof raw !== "object") return { lessons: {} };
  return { lessons: raw.lessons && typeof raw.lessons === "object" ? raw.lessons : {} };
}

function writeAll(state) {
  safeSetJson(KEY, state);
  return state;
}

export function getLessonState(lessonId) {
  const entry = readAll().lessons[lessonId] || {};
  return {
    attempts: Number(entry.attempts) || 0,
    completedAt: entry.completedAt || null,
    code: entry.code || null,
    firstResultLogged: Boolean(entry.firstResultLogged),
    bestPassed: Number(entry.bestPassed) || 0,
    // Added with the Python course. Older entries simply don't have them yet.
    hintsShown: Number(entry.hintsShown) || 0,
    solutionViewedAt: entry.solutionViewedAt || null,
    exampleRunAt: entry.exampleRunAt || null,
    quiz: entry.quiz && typeof entry.quiz === "object" ? entry.quiz : {},
  };
}

// Small facts about how a lesson went: how many hints were opened, whether the solution was
// looked at, whether the example was tried. Each only ever moves forward — a hint once seen
// stays seen — so the record can't be tidied into something that didn't happen.
export function noteLessonProgress(lessonId, { hintsShown, solutionViewed, exampleRun } = {}) {
  const state = readAll();
  const entry = state.lessons[lessonId] || {};
  if (typeof hintsShown === "number") entry.hintsShown = Math.max(Number(entry.hintsShown) || 0, hintsShown);
  if (solutionViewed && !entry.solutionViewedAt) entry.solutionViewedAt = Date.now();
  if (exampleRun && !entry.exampleRunAt) entry.exampleRunAt = Date.now();
  state.lessons[lessonId] = entry;
  writeAll(state);
}

// A lesson's mini quiz. The first answer to each question is the one kept — it's the honest
// measure of whether the idea landed — and once every question has an answer the result is
// logged once, like any other quiz.
export function recordQuizAnswer(lesson, index, choice) {
  const state = readAll();
  const entry = state.lessons[lesson.id] || {};
  const quiz = entry.quiz && typeof entry.quiz === "object" ? entry.quiz : {};
  const questions = lesson.quiz || [];
  const q = questions[index];
  if (!q) return null;
  const already = quiz[index] !== undefined;
  if (!already) quiz[index] = choice;
  entry.quiz = quiz;

  const answeredAll = questions.every((_, i) => quiz[i] !== undefined);
  const score = questions.filter((qq, i) => quiz[i] === qq.answer).length;
  let justFinished = false;
  if (answeredAll && !entry.quizLoggedAt) {
    entry.quizLoggedAt = Date.now();
    justFinished = true;
    logEvent("quiz_completed", {
      topic: lesson.title,
      score,
      total: questions.length,
      difficulty: "easy",
      subject: "coding",
      source: "code_lesson_quiz",
    });
  }
  state.lessons[lesson.id] = entry;
  writeAll(state);
  return { choice: quiz[index], correct: quiz[index] === q.answer, already, answeredAll, score, total: questions.length, justFinished };
}

export function isComplete(lessonId) {
  return Boolean(getLessonState(lessonId).completedAt);
}

export function saveDraft(lessonId, code) {
  const state = readAll();
  const entry = state.lessons[lessonId] || {};
  entry.code = code;
  state.lessons[lessonId] = entry;
  writeAll(state);
}

export function resetLesson(lessonId) {
  const state = readAll();
  const entry = state.lessons[lessonId];
  if (!entry) return;
  // Only the saved code goes back to the starter. Completion and the first-attempt result
  // are a record of something that actually happened, so they stay.
  delete entry.code;
  state.lessons[lessonId] = entry;
  writeAll(state);
}

// Called every time the student presses Check.
//
// The *first* attempt on a lesson is logged as a scored result, and only the first: a lesson
// can be re-checked endlessly, so logging every attempt would let anyone grind their recorded
// accuracy up to 100% by pressing a button. First-attempt-only is the honest measurement of
// "did you get this right", and it's the one the Learning Brain reads.
export function recordAttempt(lesson, checkResults) {
  const state = readAll();
  const entry = state.lessons[lesson.id] || { attempts: 0 };
  const passed = checkResults.filter((c) => c.passed).length;
  const total = checkResults.length;
  const allPassed = total > 0 && passed === total;

  entry.attempts = (Number(entry.attempts) || 0) + 1;
  entry.bestPassed = Math.max(Number(entry.bestPassed) || 0, passed);

  const isFirstResult = !entry.firstResultLogged;
  if (isFirstResult) {
    entry.firstResultLogged = true;
    logEvent("quiz_completed", {
      topic: lesson.title,
      score: passed,
      total,
      difficulty: "medium",
      subject: "coding",
      source: "code_lesson",
    });
  }

  const justCompleted = allPassed && !entry.completedAt;
  if (justCompleted) {
    entry.completedAt = Date.now();
    logEvent("lesson_completed", {
      lesson: lesson.id,
      title: lesson.title,
      track: lesson.track,
      subject: "coding",
      withSolution: Boolean(entry.solutionViewedAt),
    });
  }

  state.lessons[lesson.id] = entry;
  writeAll(state);
  return { passed, total, allPassed, justCompleted, firstResult: isFirstResult, attempts: entry.attempts };
}

export function getTrackProgress(lessons) {
  const done = lessons.filter((l) => isComplete(l.id)).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

// Lesson n opens once n-1 is complete. Each exercise builds on the previous concept, so
// starting at Grid before Selectors sets someone up to fail at something never taught.
export function isUnlocked(lessons, index) {
  if (index <= 0) return true;
  return isComplete(lessons[index - 1].id);
}

export function getOverallProgress(allLessons) {
  const done = allLessons.filter((l) => isComplete(l.id)).length;
  return { done, total: allLessons.length, pct: allLessons.length ? Math.round((done / allLessons.length) * 100) : 0 };
}

export function clearCodeProgress() {
  writeAll({ lessons: {} });
}
