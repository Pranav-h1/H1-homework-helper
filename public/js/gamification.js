import { safeGet, safeSet } from "./storage.js";
import { getEvents, getStats, getStreak } from "./progress.js";

const ENABLED_KEY = "h1-gamification-enabled";
const XP_RULES = { question: 2, quiz_completed: 10, study_session: 15, plan_task_done: 5, note_created: 3 };
const LEVEL_THRESHOLDS = [0, 50, 120, 220, 350, 520, 750, 1050, 1450, 2000];

export function isEnabled() {
  return safeGet(ENABLED_KEY, "1") !== "0";
}

export function setEnabled(value) {
  safeSet(ENABLED_KEY, value ? "1" : "0");
}

export function getXP() {
  const events = getEvents();
  let xp = 0;
  events.forEach((e) => {
    if (e.type === "quiz_completed") {
      xp += XP_RULES.quiz_completed + (e.score || 0) * XP_RULES.question;
    } else if (XP_RULES[e.type]) {
      xp += XP_RULES[e.type];
    }
  });
  return xp;
}

export function getLevel(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const progressPct = nextThreshold ? Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100) : 100;
  return { level, xp, nextThreshold, progressPct: Math.min(100, Math.max(0, progressPct)) };
}

const ACHIEVEMENT_DEFS = [
  { id: "first_question", title: "First Question", icon: "🌱", check: (s) => s.totalQuestions >= 1 },
  { id: "quiz_starter", title: "Quiz Starter", icon: "📝", check: (s) => s.quizzesCompleted >= 1 },
  { id: "streak_7", title: "7 Day Streak", icon: "🔥", check: (s) => s.streak >= 7 },
  { id: "hundred_questions", title: "100 Questions", icon: "💯", check: (s) => s.totalQuestions >= 100 },
  { id: "flashcard_master", title: "Flashcard Master", icon: "🗂️", check: (s) => s.flashcardsStudied >= 50 },
  { id: "study_session", title: "Study Session", icon: "⏱️", check: (s) => s.studyMinutes >= 10 },
  { id: "exam_ready", title: "Exam Ready", icon: "🎓", check: (s) => s.planTasksDone >= 10 },
];

export function getAchievements() {
  const stats = getStats();
  return ACHIEVEMENT_DEFS.map((def) => ({ id: def.id, title: def.title, icon: def.icon, earned: def.check(stats) }));
}

export { getStreak };
