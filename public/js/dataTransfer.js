import { safeGet, safeSet, safeRemove, listKeys } from "./storage.js";

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
  "h1-ai-knows-me",
  "h1-reduce-motion",
  "h1-motion",
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
  "h1-mission-state",
  "h1-code-progress",
  "h1-code-projects",
  "h1-code-challenges",
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
    // Stored verbatim as a string — the surrounding JSON.stringify(payload) below escapes
    // it correctly whether it's a plain value ("dark") or an already-JSON-encoded one.
    // Reads go through the storage layer, so an export taken while signed in contains that
    // account's work and never another account's.
    const raw = safeGet(key, null);
    if (raw !== null) data[key] = raw;
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
    safeSet(key, value);
    importedKeys.push(key);
  }

  if (importedKeys.length === 0) {
    return { ok: false, error: "The file didn't contain any recognizable H1 data." };
  }
  return { ok: true, importedKeys };
}

// "Reset everything". What that means depends on how H1 is being used, and it says so either
// way rather than quietly doing something different:
//   • Guest    — removes this device's H1 data. Another account's cached copy on the same
//                device is not touched, and neither are device settings like the theme cache.
//   • Account  — removes the account's data, which means everywhere, because the removals are
//                synced like any other change. Waiting for that to reach the server before
//                reloading is the difference between a reset and data that reappears.
export async function clearAllH1Data() {
  const keys = listKeys();
  keys.forEach((key) => safeRemove(key));
  try {
    const { clearAllFiles } = await import("./fileStore.js");
    await clearAllFiles();
  } catch {
    // Attachments couldn't be cleared; the rest of the reset still happened.
  }
  try {
    const { isAccountMode } = await import("./session.js");
    if (isAccountMode()) {
      const sync = await import("./cloudSync.js");
      await sync.flush({ timeoutMs: 12000 });
    }
  } catch {
    // Offline: the removals are queued and go up with the next sync.
  }
  return keys.length;
}
