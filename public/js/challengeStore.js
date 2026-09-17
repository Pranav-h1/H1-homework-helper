// Coding challenge progress: attempts, solves, hints, and a history of every run of the tests.
//
// Everything here is a record of something that happened. XP for a challenge is derived from
// the logged solve (see gamification.js), and a solve that came after viewing the solution
// earns none — it still counts as solved, and it's still in the history.
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { difficultyInfo } from "./pythonChallenges.js";

const KEY = "h1-code-challenges";
const MAX_HISTORY = 300;

function readAll() {
  const raw = safeGetJson(KEY, null);
  const out = { challenges: {}, history: [] };
  if (!raw || typeof raw !== "object") return out;
  if (raw.challenges && typeof raw.challenges === "object") out.challenges = raw.challenges;
  if (Array.isArray(raw.history)) out.history = raw.history;
  return out;
}

function writeAll(state) {
  safeSetJson(KEY, state);
  return state;
}

export function getChallengeState(id) {
  const e = readAll().challenges[id] || {};
  return {
    attempts: Number(e.attempts) || 0,
    failedAttempts: Number(e.failedAttempts) || 0,
    bestPassed: Number(e.bestPassed) || 0,
    solvedAt: e.solvedAt || null,
    solvedWithSolution: Boolean(e.solvedWithSolution),
    hintsShown: Number(e.hintsShown) || 0,
    solutionViewedAt: e.solutionViewedAt || null,
    code: typeof e.code === "string" ? e.code : null,
    lastAttemptAt: e.lastAttemptAt || null,
  };
}

export function saveChallengeDraft(id, code) {
  const state = readAll();
  const e = state.challenges[id] || {};
  e.code = String(code || "").slice(0, 60000);
  state.challenges[id] = e;
  writeAll(state);
}

export function resetChallengeCode(id) {
  const state = readAll();
  const e = state.challenges[id];
  if (!e) return;
  delete e.code;
  writeAll(state);
}

export function noteChallengeProgress(id, { hintsShown, solutionViewed } = {}) {
  const state = readAll();
  const e = state.challenges[id] || {};
  if (typeof hintsShown === "number") e.hintsShown = Math.max(Number(e.hintsShown) || 0, hintsShown);
  if (solutionViewed && !e.solutionViewedAt) e.solutionViewedAt = Date.now();
  state.challenges[id] = e;
  writeAll(state);
}

// Called every time the tests run.
export function recordChallengeAttempt(challenge, checks) {
  const state = readAll();
  const e = state.challenges[challenge.id] || {};
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const allPassed = total > 0 && passed === total;
  const now = Date.now();
  const firstResult = !e.firstResultLogged;

  e.attempts = (Number(e.attempts) || 0) + 1;
  e.bestPassed = Math.max(Number(e.bestPassed) || 0, passed);
  e.lastAttemptAt = now;
  if (!allPassed && !e.solvedAt) e.failedAttempts = (Number(e.failedAttempts) || 0) + 1;

  // Same rule as lessons: only the first run of the tests is a scored result, so re-running
  // until everything's green can't inflate recorded accuracy.
  if (firstResult) {
    e.firstResultLogged = true;
    logEvent("quiz_completed", {
      topic: `${challenge.title} (${challenge.topic})`,
      score: passed,
      total,
      difficulty: challenge.difficulty === "hard" ? "hard" : challenge.difficulty === "medium" ? "medium" : "easy",
      subject: "coding",
      source: "code_challenge",
    });
  }

  const justSolved = allPassed && !e.solvedAt;
  let xp = 0;
  if (justSolved) {
    e.solvedAt = now;
    e.solvedWithSolution = Boolean(e.solutionViewedAt);
    xp = e.solvedWithSolution ? 0 : difficultyInfo(challenge.difficulty).xp;
    logEvent("challenge_solved", {
      challenge: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      usedSolution: e.solvedWithSolution,
      attempts: e.attempts,
      subject: "coding",
    });
  }

  state.challenges[challenge.id] = e;
  state.history.push({ id: challenge.id, at: now, passed: passed, total, solved: allPassed });
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
  writeAll(state);

  return { passed, total, allPassed, justSolved, xp, firstResult, attempts: e.attempts, failedAttempts: Number(e.failedAttempts) || 0 };
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Consecutive days, ending today or yesterday, on which at least one challenge was solved for
// the first time. A streak that ended two days ago is over, and is reported as zero.
function solveStreak(solveTimes) {
  if (!solveTimes.length) return 0;
  const days = new Set(solveTimes.map(dayKey));
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor.getTime()))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getChallengeStats(challenges) {
  const state = readAll();
  const byDifficulty = {};
  let solved = 0;
  let xp = 0;
  const solveTimes = [];
  challenges.forEach((c) => {
    const e = state.challenges[c.id] || {};
    const d = (byDifficulty[c.difficulty] = byDifficulty[c.difficulty] || { solved: 0, total: 0 });
    d.total++;
    if (e.solvedAt) {
      solved++;
      d.solved++;
      solveTimes.push(e.solvedAt);
      if (!e.solvedWithSolution) xp += difficultyInfo(c.difficulty).xp;
    }
  });
  const attempts = Object.values(state.challenges).reduce((n, e) => n + (Number(e.attempts) || 0), 0);
  return {
    solved,
    total: challenges.length,
    xp,
    attempts,
    streak: solveStreak(solveTimes),
    byDifficulty,
    recent: state.history.slice(-8).reverse(),
  };
}

export function clearChallengeProgress() {
  writeAll({ challenges: {}, history: [] });
}
