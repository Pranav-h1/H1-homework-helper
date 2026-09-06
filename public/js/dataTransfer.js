const EXPORT_VERSION = 2;

// Every H1 localStorage key that represents real user data (not transient UI state).
// Values are round-tripped as raw strings (see exportData/importData below) so this works
// uniformly whether a key was written with storage.js's safeSet (plain string) or
// safeSetJson (JSON-encoded string) — no need to track which is which here.
const KNOWN_KEYS = [
  "h1-theme",
  "h1-device-preview",
  "h1-subject",
  "h1-enter-mode",
  "h1-auto-scroll",
  "h1-save-conversations",
  "h1-reduce-motion",
  "h1-ai-mode",
  "h1-ai-language",
  "h1-gamification-enabled",
  "h1-achievement-notifications",
  "h1-deadline-reminders",
  "h1-sidebar-collapsed",
  "h1-conversations",
  "h1-active-conversation",
  "h1-notes",
  "h1-recent-quizzes",
  "h1-flashcard-progress",
  "h1-flashcard-decks",
  "h1-homework-tasks",
  "h1-planner-items",
  "h1-documents",
  "h1-custom-subjects",
  "h1-progress-events",
  "h1-achievements-seen",
  "h1-goals",
  "h1-daily-goal-minutes",
  "h1-display-name",
  "h1-spaces",
  "h1-current-space",
  "h1-projects",
];

export function exportData() {
  const data = {};
  KNOWN_KEYS.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      // Stored verbatim as a string — the surrounding JSON.stringify(payload) below escapes
      // it correctly whether it's a plain value ("dark") or an already-JSON-encoded one.
      if (raw !== null) data[key] = raw;
    } catch {
      // skip keys that fail to read rather than corrupting the whole export
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
    const value = parsed.data[key];
    if (typeof value !== "string") continue;
    try {
      localStorage.setItem(key, value);
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
