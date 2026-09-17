// One read-only summary of a student's coding progress, for the places outside Code Lab that
// want to mention it: the AI Tutor's briefing, the Home dashboard, search.
//
// Everything comes from the stores that record what actually happened; nothing is estimated.
import { TRACKS, getTrack } from "./codeCurriculum.js";
import { PY_LEVELS } from "./pythonCurriculum.js";
import { getLessonState, getTrackProgress } from "./codeProgressStore.js";
import { CHALLENGES, DIFFICULTIES } from "./pythonChallenges.js";
import { getChallengeStats } from "./challengeStore.js";

export function getCodingSummary() {
  const tracks = TRACKS.map((t) => {
    const lessons = getTrack(t.id);
    const p = getTrackProgress(lessons);
    const started = lessons.some((l) => {
      const s = getLessonState(l.id);
      return s.attempts > 0 || s.completedAt || s.code;
    });
    return { id: t.id, label: t.label, icon: t.icon, done: p.done, total: p.total, pct: p.pct, started };
  });

  const pyLessons = getTrack("py");
  const py = tracks.find((t) => t.id === "py");
  const next = pyLessons.find((l) => !getLessonState(l.id).completedAt) || null;
  const levels = PY_LEVELS.map((lv) => {
    const inLevel = pyLessons.filter((l) => l.level === lv.id);
    const p = getTrackProgress(inLevel);
    return { id: lv.id, title: lv.title, done: p.done, total: p.total };
  });
  const levelsComplete = levels.filter((l) => l.total > 0 && l.done === l.total).length;

  const ch = getChallengeStats(CHALLENGES);
  const lessonsDone = tracks.reduce((n, t) => n + t.done, 0);

  return {
    tracks,
    python: {
      done: py ? py.done : 0,
      total: py ? py.total : 0,
      pct: py ? py.pct : 0,
      started: Boolean(py && py.started),
      levels,
      levelsComplete,
      next: next ? { id: next.id, title: next.title, level: next.level } : null,
    },
    challenges: {
      solved: ch.solved,
      total: ch.total,
      attempts: ch.attempts,
      streak: ch.streak,
      xp: ch.xp,
      byDifficulty: DIFFICULTIES.map((d) => ({ id: d.id, label: d.label, ...(ch.byDifficulty[d.id] || { solved: 0, total: 0 }) })),
    },
    lessonsDone,
    hasActivity: lessonsDone > 0 || ch.attempts > 0 || tracks.some((t) => t.started),
  };
}

// The lines the AI Tutor's briefing gets. Empty when there's nothing real to say.
export function codingContextLines() {
  const s = getCodingSummary();
  if (!s.hasActivity) return [];
  const lines = [];
  const started = s.tracks.filter((t) => t.started || t.done);
  if (started.length) {
    lines.push(`Code Lab lessons: ${started.map((t) => `${t.label} ${t.done}/${t.total}`).join(", ")}.`);
  }
  if (s.python.started && s.python.next) {
    lines.push(`Next Python lesson: Level ${s.python.next.level} "${s.python.next.title}".`);
  }
  if (s.challenges.attempts > 0) {
    const bits = s.challenges.byDifficulty.filter((d) => d.solved).map((d) => `${d.label} ${d.solved}/${d.total}`);
    lines.push(`Coding challenges solved: ${s.challenges.solved}/${s.challenges.total}${bits.length ? ` (${bits.join(", ")})` : ""}.`);
  }
  return lines;
}

export function codingSignature() {
  const s = getCodingSummary();
  return `${s.lessonsDone}:${s.challenges.solved}`;
}
