import { safeGet, safeSet } from "./storage.js";
import { showToast } from "./toast.js";
import { getTodayAndUpcoming } from "./homeworkStore.js";
import { getGrouped } from "./plannerStore.js";

const ENABLED_KEY = "h1-deadline-reminders";
const LAST_CHECK_KEY = "h1-deadline-reminders-last-date";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let intervalId = null;

export function isEnabled() {
  return safeGet(ENABLED_KEY, "0") === "1";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dueTodayCount() {
  const homework = getTodayAndUpcoming(50).filter((t) => t.deadline === todayStr() || t.overdue);
  const planner = getGrouped();
  return homework.length + planner.overdue.length + planner.today.length;
}

function runCheck(force) {
  if (!isEnabled()) return;
  const today = todayStr();
  if (!force && safeGet(LAST_CHECK_KEY, "") === today) return;
  const count = dueTodayCount();
  if (count === 0) return;
  safeSet(LAST_CHECK_KEY, today);
  const message = `📌 You have ${count} item${count === 1 ? "" : "s"} due today or overdue.`;
  showToast(message, "success", 5000);
  if (window.Notification && Notification.permission === "granted") {
    try {
      new Notification("H1 — The Student OS", { body: message, icon: undefined });
    } catch {
      // Some browsers restrict Notification() outside a service worker — the in-app toast above still covers it.
    }
  }
}

export async function setEnabled(on) {
  safeSet(ENABLED_KEY, on ? "1" : "0");
  if (!on) {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    return true;
  }
  if (window.Notification && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignored — toasts still work without browser notification permission
    }
  }
  startChecking();
  runCheck(true);
  return true;
}

function startChecking() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => runCheck(false), CHECK_INTERVAL_MS);
}

export function initNotifications() {
  if (isEnabled()) {
    startChecking();
    runCheck(false);
  }
}
