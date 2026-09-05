const EXPORT_VERSION = 1;

// Every H1 localStorage key that represents real user data (not transient UI state).
const KNOWN_KEYS = [
  "h1-theme",
  "h1-device-preview",
  "h1-subject",
  "h1-enter-mode",
  "h1-auto-scroll",
  "h1-save-conversations",
  "h1-reduce-motion",
  "h1-ai-mode",
  "h1-gamification-enabled",
  "h1-conversations",
  "h1-active-conversation",
  "h1-notes",
  "h1-recent-quizzes",
  "h1-quiz-history",
  "h1-flashcard-progress",
  "h1-study-plan-done",
  "h1-exam-plans",
  "h1-progress-events",
];

export function exportData() {
  const data = {};
  KNOWN_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {
      // skip keys that fail to read/parse rather than corrupting the whole export
    }
  });

  const payload = { app: "h1-homework-helper", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `h1-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Returns { ok: true, importedKeys } or { ok: false, error }.
export function importData(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  if (!parsed || typeof parsed !== "object" || parsed.app !== "h1-homework-helper" || !parsed.data || typeof parsed.data !== "object") {
    return { ok: false, error: "That doesn't look like an H1 export file." };
  }

  const importedKeys = [];
  for (const key of KNOWN_KEYS) {
    if (!(key in parsed.data)) continue;
    try {
      localStorage.setItem(key, JSON.stringify(parsed.data[key]));
      importedKeys.push(key);
    } catch {
      // skip a single bad key rather than failing the whole import
    }
  }

  if (importedKeys.length === 0) {
    return { ok: false, error: "The file didn't contain any recognizable H1 data." };
  }
  return { ok: true, importedKeys };
}
