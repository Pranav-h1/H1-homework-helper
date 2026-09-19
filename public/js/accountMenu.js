// The account's presence in the app: the button at the bottom of the sidebar, the menu it
// opens, and the Account section in Settings.
//
// It also owns what happens when a session ends while H1 is open — the person is told, once,
// and taken back to the sign-in screen, rather than left clicking around an app that can no
// longer save anything.
import * as session from "./session.js";
import * as api from "./accountApi.js";
import * as sync from "./cloudSync.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";
import { openFormDialog } from "./formDialog.js";
import { switchView } from "./nav.js";
import { checkPasswords } from "./authRules.js";

const el = {};
let usage = null;
let sessionEndedShown = false;

function $(id) {
  return document.getElementById(id);
}

function initials(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "G";
  return [...trimmed][0].toUpperCase();
}

function formatBytes(n) {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLine() {
  if (!session.isAccountMode()) return "On this device";
  if (session.isOffline()) return "Offline · saved here";
  const s = sync.syncStatus();
  if (s.error === "offline") return "Offline · will sync";
  if (s.error) return "Couldn't save";
  if (s.syncing) return "Saving…";
  if (s.pending) return `${s.pending} to save`;
  return "Synced";
}

function render() {
  if (!el.sidebarBtn) return;
  const account = session.isAccountMode();
  const user = session.currentUser();
  const name = account && user ? user.username : "Guest";
  const status = statusLine();

  el.sidebarName.textContent = name;
  el.sidebarStatus.textContent = status;
  el.sidebarAvatar.textContent = initials(name);
  el.sidebarBtn.setAttribute("aria-label", account ? `Account: ${name}, ${status}` : "Not signed in");
  el.sidebarAvatar.classList.toggle("is-guest", !account);

  el.menuName.textContent = name;
  el.menuSub.textContent = account
    ? user && user.accountType === "lab"
      ? "H1 Lab account"
      : "Signed in · synced to your account"
    : "Stored on this device";
  el.menuAction.textContent = account ? "Sign out" : "Sign in";
  el.menuSync.hidden = !account;

  // Settings → Account
  if (el.accountName) {
    el.accountName.textContent = name;
    el.accountAvatar.textContent = initials(name);
    el.accountPrimaryBtn.textContent = account ? "Sign out" : "Sign in";
    el.accountActions.hidden = !account;
    const unavailable = !session.accountsAvailable();
    el.accountPrimaryBtn.hidden = unavailable;
    if (unavailable) {
      el.accountSub.textContent = "Accounts aren't set up on this H1 server, so everything is stored on this device.";
    } else if (!account) {
      el.accountSub.textContent = "You're using H1 without an account. Everything is stored on this device only.";
    } else if (session.isOffline()) {
      el.accountSub.textContent = "Signed in. H1 can't reach the server right now, so changes are saved here and will sync when it's back.";
    } else {
      el.accountSub.textContent = `Signed in. Your work syncs to every device you use. ${status === "Synced" ? "Everything is saved." : status}`;
    }
    if (usage) {
      el.accountUsage.hidden = false;
      el.accountUsage.textContent = `Using ${formatBytes(usage.dataBytes)} of ${formatBytes(usage.dataQuota)} for your work, and ${formatBytes(usage.fileBytes)} of ${formatBytes(usage.fileQuota)} for attachments.`;
    } else {
      el.accountUsage.hidden = true;
    }
  }

  if (el.privacyText) {
    el.privacyText.textContent = account
      ? "While you're signed in, H1 keeps your conversations, notes, homework, documents, flashcards, quiz history and settings in your account so they're on every device you use. They're stored on H1's server, sent only over an encrypted connection, and are only readable by your account. Nothing is shared with anyone else, and the only thing sent to the AI is the message you ask it."
      : "H1 stores your conversations, notes, homework, documents, flashcards, quiz history and settings in this browser's local storage only. Nothing is uploaded except the text/image you send to the AI Tutor when you ask a question — and only the current message, not your other stored data.";
  }
}

function closeMenu() {
  if (!el.menu) return;
  el.menu.hidden = true;
  el.sidebarBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const open = el.menu.hidden;
  el.menu.hidden = !open;
  el.sidebarBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    const first = el.menu.querySelector(".account-menu-item:not([hidden])");
    if (first) first.focus();
  }
}

// --- actions ---------------------------------------------------------------------------
async function doSignOut() {
  const pending = sync.pendingKeys().length;
  const result = await session.signOut();
  if (result.ok) {
    showToast("Signed out.", "success");
    setTimeout(() => window.location.reload(), 400);
    return;
  }
  // Something hasn't reached the account yet. Rather than choosing for them, say so.
  confirmDanger(
    "Sign out with unsaved changes?",
    `${pending === 1 ? "One change hasn't" : `${pending} changes haven't`} reached your account yet — usually because H1 can't reach the server. If you sign out now, that work stays on this device and goes up the next time you sign in here.`,
    "Sign out anyway",
    async () => {
      await session.signOut({ force: true });
      showToast("Signed out. Your unsent work is still on this device.", "success");
      setTimeout(() => window.location.reload(), 600);
    }
  );
}

function goToSignIn() {
  // The sign-in screen is what boot shows when this device hasn't chosen to stay a guest, so
  // clearing that choice and reloading is the way back to it.
  try {
    localStorage.removeItem("h1-device-mode");
  } catch {
    // It still appears if this can't be written — the screen is shown whenever there's no
    // session and no explicit guest choice.
  }
  window.location.reload();
}

async function changePassword() {
  await openFormDialog({
    title: "Change password",
    message: "Your other devices will be signed out. This one stays signed in.",
    fields: [
      { name: "currentPassword", label: "Current password", type: "password", autocomplete: "current-password", maxLength: 128 },
      { name: "newPassword", label: "New password", type: "password", autocomplete: "new-password", maxLength: 128 },
      { name: "confirmPassword", label: "Confirm new password", type: "password", autocomplete: "new-password", maxLength: 128 },
    ],
    confirmLabel: "Change password",
    busyLabel: "Changing…",
    validate: (v) => {
      if (!v.currentPassword) return { field: "currentPassword", message: "Enter your current password." };
      const problem = checkPasswords(v.newPassword, v.confirmPassword);
      if (problem) return { field: problem.field === "password" ? "newPassword" : problem.field, message: problem.message };
      return null;
    },
    onSubmit: async (v) => {
      await api.changePassword(v.currentPassword, v.newPassword, v.confirmPassword);
      showToast("Password changed. Your other devices were signed out.", "success");
    },
  });
}

function signOutEverywhere() {
  confirmDanger("Sign out on every device?", "You'll need to sign in again here and anywhere else you use H1.", "Sign out everywhere", async () => {
    try {
      await sync.flush({ timeoutMs: 8000 });
      await api.signOutEverywhere();
    } catch {
      // Even if that failed, this device is about to reload and ask for a sign-in.
    }
    session.forgetAfterDelete();
    showToast("Signed out everywhere.", "success");
    setTimeout(() => window.location.reload(), 500);
  });
}

async function deleteAccount() {
  const user = session.currentUser();
  await openFormDialog({
    title: "Delete your account",
    message: `This permanently deletes ${user ? user.username : "your account"} and everything in it — conversations, notes, homework, flashcards, progress — on every device. It can't be undone. Export your data first if you want to keep a copy.`,
    danger: true,
    fields: [{ name: "password", label: "Your password", type: "password", autocomplete: "current-password", maxLength: 128 }],
    confirmLabel: "Delete forever",
    busyLabel: "Deleting…",
    validate: (v) => (v.password ? null : { field: "password", message: "Enter your password to confirm." }),
    onSubmit: async (v) => {
      await api.deleteAccount(v.password);
      session.forgetAfterDelete();
      showToast("Your account was deleted.", "success");
      setTimeout(() => window.location.reload(), 700);
    },
  });
}

async function refreshUsage() {
  if (!session.isAccountMode() || session.isOffline()) {
    usage = null;
    return;
  }
  try {
    const info = await api.getAccount();
    usage = info.usage;
  } catch {
    usage = null;
  }
  render();
}

// A session that ended while H1 was open. Said once, clearly, with the work that's still on the
// device left alone.
function onSessionLost(event) {
  if (sessionEndedShown) return;
  sessionEndedShown = true;
  const reason = event && event.detail && event.detail.reason;
  confirmDanger(
    reason === "expired" ? "Your session has expired" : "You've been signed out",
    "Sign in again to keep your work syncing. Anything saved since then is still on this device and will go up when you sign back in.",
    "Sign in",
    () => goToSignIn()
  );
  render();
}

export function initAccountMenu() {
  el.sidebarBtn = $("sidebarAccountBtn");
  el.sidebarName = $("sidebarAccountName");
  el.sidebarStatus = $("sidebarAccountStatus");
  el.sidebarAvatar = $("sidebarAccountAvatar");
  el.menu = $("sidebarAccountMenu");
  el.menuName = $("accountMenuName");
  el.menuSub = $("accountMenuSub");
  el.menuAction = $("accountMenuAction");
  el.menuSync = $("accountMenuSync");
  el.menuSettings = $("accountMenuSettings");
  el.accountName = $("accountName");
  el.accountSub = $("accountSub");
  el.accountAvatar = $("accountAvatar");
  el.accountPrimaryBtn = $("accountPrimaryBtn");
  el.accountActions = $("accountActions");
  el.accountUsage = $("accountUsage");
  el.privacyText = $("privacyText");
  if (!el.sidebarBtn) return;

  el.sidebarBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  document.addEventListener("click", (event) => {
    if (!el.menu.hidden && !el.menu.contains(event.target) && event.target !== el.sidebarBtn) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.menu.hidden) {
      closeMenu();
      el.sidebarBtn.focus();
    }
  });

  el.menuSettings.addEventListener("click", () => {
    closeMenu();
    switchView("settings");
    const section = $("accountSection");
    if (section) section.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  el.menuSync.addEventListener("click", async () => {
    closeMenu();
    showToast("Syncing…");
    await sync.push();
    await sync.checkRemote();
    await refreshUsage();
    showToast(sync.syncStatus().pending ? "Some changes are still waiting to sync." : "Everything is saved to your account.", sync.syncStatus().pending ? "warning" : "success");
  });
  el.menuAction.addEventListener("click", () => {
    closeMenu();
    if (session.isAccountMode()) doSignOut();
    else goToSignIn();
  });

  if (el.accountPrimaryBtn) {
    el.accountPrimaryBtn.addEventListener("click", () => (session.isAccountMode() ? doSignOut() : goToSignIn()));
    $("accountPasswordBtn").addEventListener("click", changePassword);
    $("accountLogoutAllBtn").addEventListener("click", signOutEverywhere);
    $("accountDeleteBtn").addEventListener("click", deleteAccount);
  }

  session.onSessionChange(render);
  sync.onSyncState(render);
  window.addEventListener("h1:session-lost", onSessionLost);
  render();
  refreshUsage();
  // The figure is only interesting when the person is looking at it.
  document.addEventListener("h1:view-changed", (event) => {
    if (event.detail === "settings") refreshUsage();
  });
}
