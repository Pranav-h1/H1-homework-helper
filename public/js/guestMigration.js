// Bringing work that was saved on this device, before signing in, into an account.
//
// The rules this follows, deliberately:
//   • Nothing is ever uploaded without being asked for. Signing in on a shared or school
//     computer must not push whatever the last person left behind into your account.
//   • Nothing is deleted. The guest copy stays exactly where it was, so if the answer was
//     wrong it can be brought in later, and using H1 as a guest again still works.
//   • Running it twice doesn't duplicate anything: values are merged by item id, so a note
//     that's already in the account stays one note.
import { listGuestKeys, readGuestValue, getNamespace } from "./storage.js";
import { adoptValue } from "./cloudSync.js";
import { isAccountMode } from "./session.js";
import { openFormDialog } from "./formDialog.js";
import { showToast } from "./toast.js";

// What each store is called when we tell someone what's about to be copied.
const LABELS = [
  ["h1-conversations", "conversation", "conversations"],
  ["h1-notes", "note", "notes"],
  ["h1-homework-tasks", "homework task", "homework tasks"],
  ["h1-documents", "document", "documents"],
  ["h1-flashcard-decks", "flashcard deck", "flashcard decks"],
  ["h1-planner-items", "planner item", "planner items"],
  ["h1-projects", "project", "projects"],
  ["h1-code-projects", "Code Lab project", "Code Lab projects"],
  ["h1-spaces", "Space", "Spaces"],
  ["h1-quiz-history", "quiz result", "quiz results"],
  ["h1-mistakes", "saved mistake", "saved mistakes"],
];

function flagKey() {
  return `h1sync:${getNamespace()}:guest-import`;
}

function alreadyHandled() {
  try {
    return Boolean(localStorage.getItem(flagKey()));
  } catch {
    return true;
  }
}

function markHandled(how) {
  try {
    localStorage.setItem(flagKey(), how);
  } catch {
    // Worst case it asks again next time, which is safe.
  }
}

function countItems(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
  } catch {
    // A plain setting.
  }
  return raw ? 1 : 0;
}

// What's actually sitting in guest storage, described the way a person would describe it.
export function guestDataSummary() {
  const keys = listGuestKeys();
  if (!keys.length) return null;
  const parts = [];
  let total = 0;
  for (const [key, one, many] of LABELS) {
    if (!keys.includes(key)) continue;
    const n = countItems(readGuestValue(key));
    if (!n) continue;
    total += n;
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  const otherKeys = keys.filter((k) => !LABELS.some(([labelKey]) => labelKey === k));
  if (!parts.length && !otherKeys.length) return null;
  return { keys, parts, total, otherCount: otherKeys.length };
}

export async function importGuestData() {
  const keys = listGuestKeys();
  let copied = 0;
  for (const key of keys) {
    const raw = readGuestValue(key);
    if (raw === null) continue;
    if (adoptValue(key, raw)) copied++;
  }
  let files = 0;
  try {
    const { importGuestFiles } = await import("./fileStore.js");
    files = await importGuestFiles();
  } catch {
    // Attachments couldn't be copied; everything else still was.
  }
  markHandled("imported");
  return { copied, files };
}

function describe(summary) {
  const list = summary.parts.slice(0, 4).join(", ");
  const extra = summary.parts.length > 4 ? `, and more` : "";
  if (!list) return "There's work saved on this device from before you signed in.";
  return `This device has ${list}${extra} saved from before you signed in.`;
}

// Asked once per account, on the first sign-in on this device. Declining is remembered, and the
// same thing stays available in Settings → Data, so "not now" never means "never".
export async function offerGuestDataImport() {
  if (!isAccountMode() || alreadyHandled()) return;
  const summary = guestDataSummary();
  if (!summary || (!summary.total && !summary.otherCount)) {
    markHandled("nothing");
    return;
  }

  const answer = await openFormDialog({
    title: "Bring your earlier work with you?",
    message: `${describe(summary)} Copying it adds it to your account, so it's on every device you sign in on. It stays on this device either way, and nothing is overwritten.`,
    fields: [],
    confirmLabel: "Copy into my account",
    cancelLabel: "Not now",
    busyLabel: "Copying…",
    onSubmit: async () => {
      const { copied, files } = await importGuestData();
      showToast(copied ? `Copied your earlier work into your account${files ? ` (including ${files} attachment${files === 1 ? "" : "s"})` : ""}.` : "Nothing new to copy.", "success");
      setTimeout(() => window.location.reload(), 900);
    },
  });

  if (answer === null) {
    markHandled("declined");
    showToast("Left on this device. You can copy it in later from Settings → Data.");
  }
}

// The Settings → Data entry point, available whenever there's guest work to bring in.
export async function importGuestDataFromSettings() {
  const summary = guestDataSummary();
  if (!summary) {
    showToast("There's no on-device work to bring in.");
    return;
  }
  await openFormDialog({
    title: "Copy on-device work into your account",
    message: `${describe(summary)} It'll be merged with what's already in your account — nothing is overwritten or removed.`,
    fields: [],
    confirmLabel: "Copy into my account",
    busyLabel: "Copying…",
    onSubmit: async () => {
      const { copied, files } = await importGuestData();
      showToast(copied ? `Copied ${copied} item${copied === 1 ? "" : "s"}${files ? ` and ${files} attachment${files === 1 ? "" : "s"}` : ""}.` : "Nothing new to copy.", "success");
      setTimeout(() => window.location.reload(), 900);
    },
  });
}
