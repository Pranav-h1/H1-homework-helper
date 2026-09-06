import { safeGet, safeSet, safeGetJson, safeSetJson } from "./storage.js";
import { getEvents, getStats, getStreak } from "./progress.js";
import { showToast } from "./toast.js";

const SEEN_ACHIEVEMENTS_KEY = "h1-achievements-seen";

const ENABLED_KEY = "h1-gamification-enabled";
const XP_RULES = {
  question: 2,
  quiz_completed: 10,
  study_session: 15,
  plan_task_done: 5,
  note_created: 3,
  homework_completed: 8,
  document_created: 4,
  focus_break_completed: 3,
};
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
    // Older events (logged before the daily-cap guard existed) have no xpEligible flag —
    // treat those as eligible so past activity isn't retroactively devalued.
    if (e.xpEligible === false) return;
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
  { id: "first_question", title: "First Question", desc: "Ask H1 your first question.", icon: "🌱", check: (s) => s.totalQuestions >= 1 },
  { id: "quiz_starter", title: "Quiz Starter", desc: "Complete your first quiz.", icon: "📝", check: (s) => s.quizzesCompleted >= 1 },
  { id: "quiz_master", title: "Quiz Master", desc: "Complete 10 quizzes.", icon: "🏆", check: (s) => s.quizzesCompleted >= 10 },
  { id: "streak_3", title: "3 Day Streak", desc: "Study 3 days in a row.", icon: "✨", check: (s) => s.streak >= 3 },
  { id: "streak_7", title: "7 Day Streak", desc: "Study 7 days in a row.", icon: "🔥", check: (s) => s.streak >= 7 },
  { id: "hundred_questions", title: "100 Questions", desc: "Ask H1 100 questions.", icon: "💯", check: (s) => s.totalQuestions >= 100 },
  { id: "flashcard_starter", title: "Flashcard Starter", desc: "Study your first flashcard deck.", icon: "🗃️", check: (s) => s.flashcardsStudied >= 1 },
  { id: "flashcard_master", title: "Flashcard Master", desc: "Study 50 flashcards.", icon: "🗂️", check: (s) => s.flashcardsStudied >= 50 },
  { id: "study_session", title: "Study Session Complete", desc: "Finish a 10+ minute focus session.", icon: "⏱️", check: (s) => s.studyMinutes >= 10 },
  { id: "exam_ready", title: "Exam Ready", desc: "Complete 10 study plan tasks.", icon: "🎓", check: (s) => s.planTasksDone >= 10 },
  { id: "homework_hero", title: "Homework Hero", desc: "Complete 10 homework tasks.", icon: "🦸", check: (s) => (s.homeworkCompleted || 0) >= 10 },
  { id: "document_master", title: "Document Master", desc: "Add 5 documents to your library.", icon: "📚", check: (s) => (s.documentsCreated || 0) >= 5 },
  { id: "subject_explorer", title: "Subject Explorer", desc: "Study 3 different subjects.", icon: "🧭", check: (s) => (s.subjectsExplored || 0) >= 3 },
];

export function getAchievements() {
  const stats = getStats();
  return ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    desc: def.desc,
    icon: def.icon,
    earned: def.check(stats),
  }));
}

// Called whenever new activity is logged (see progress.js's "h1:activity-logged" event).
// Diffs newly-earned achievements against what's already been shown, toasts the new ones,
// and remembers them so the same unlock never toasts twice.
export function checkAndNotifyAchievements() {
  if (!isEnabled()) return;
  const seen = new Set(safeGetJson(SEEN_ACHIEVEMENTS_KEY, []));
  const earned = getAchievements().filter((a) => a.earned);
  const newlyEarned = earned.filter((a) => !seen.has(a.id));
  if (newlyEarned.length === 0) return;
  newlyEarned.forEach((a) => {
    showToast(`🏆 Achievement unlocked: ${a.title}`, "success", 4500);
    seen.add(a.id);
  });
  safeSetJson(SEEN_ACHIEVEMENTS_KEY, Array.from(seen));
}

export { getStreak };
