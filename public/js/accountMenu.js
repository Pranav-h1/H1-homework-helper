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
import { onUsageChange, refreshUsage, currentUsage, describeUsage, shortUsage, isLow } from "./aiUsage.js";

const el = {};
const GUEST_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg>';
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
  const left = shortUsage();
  if (!session.isAccountMode()) return left ? `Not signed in · ${left}` : "Not signed in";
  if (session.isOffline()) return "Offline · saved here";
  const s = sync.syncStatus();
  // Only a problem is worth a word here. A change waiting its few seconds to upload is normal,
  // and counting it out ("1 to save") while someone clicks around was just flicker.
  if (s.error === "offline") return "Offline · will sync";
  if (s.error) return "Couldn't save";
  if (s.syncing) return left ? `Saving… · ${left}` : "Saving…";
  // What people actually care about once their work is safe: how many questions they have left.
  return left ? `Synced · ${left}` : "Synced";
}

function render() {
  if (!el.sidebarBtn) return;
  const account = session.isAccountMode();
  const user = session.currentUser();
  const name = account && user ? user.username : "Guest";
  const status = statusLine();

  el.sidebarName.textContent = name;
  el.sidebarStatus.textContent = status;
  // A guest gets a person outline rather than a letter "G" — it reads as "nobody signed in",
  // not as someone called G.
  if (account) el.sidebarAvatar.textContent = initials(name);
  else el.sidebarAvatar.innerHTML = GUEST_ICON;
  el.sidebarBtn.setAttribute("aria-label", account ? `Account: ${name}, ${status}` : "Using H1 as a guest — open to sign in");
  el.sidebarAvatar.classList.toggle("is-guest", !account);
  el.sidebarBtn.classList.toggle("is-creator", Boolean(account && user && user.accountType === "lab"));

  el.menuName.textContent = account ? name : "Using H1 as a guest";
  el.menuSub.textContent = account
    ? user && user.accountType === "lab"
      ? "Creator account · no message limit"
      : "Signed in · synced to your account"
    : "Your work stays in this browser";
  el.menuAction.textContent = account ? "Sign out" : "Sign in or create an account";
  el.menuAction.classList.toggle("is-signin", !account);
  el.menuSettings.textContent = account ? "Account settings" : "Settings";
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
      // The allowance has its own panel right below, so this line only speaks up about saving
      // when something is actually wrong with it.
      const s = sync.syncStatus();
      const problem = s.error === "offline" ? " H1 is offline — changes are saved here and will sync." : s.error ? " Some changes couldn't be saved to your account yet." : "";
      el.accountSub.textContent = `Signed in. Your work syncs to every device you use.${problem}`;
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

  renderAllowance();
}

// How many AI messages are left. Shown to everyone, including people using H1 without an
// account, because the limit applies to them too and finding out by being refused is no way to
// learn it.
function renderAllowance() {
  if (!el.allowance) return;
  const state = currentUsage();
  if (!state) {
    el.allowance.hidden = true;
    return;
  }
  el.allowance.hidden = false;
  if (state.unlimited) {
    el.allowanceCount.textContent = "no limit";
    el.allowanceFill.style.width = "100%";
    el.allowance.classList.remove("is-low", "is-out");
    el.allowanceFill.classList.add("is-unlimited");
    el.allowanceNote.textContent = "This is H1's own account, so its messages aren't counted.";
    return;
  }
  el.allowanceFill.classList.remove("is-unlimited");
  const pct = state.limit ? Math.max(0, Math.min(100, Math.round((state.remaining / state.limit) * 100))) : 0;
  el.allowanceCount.textContent = `${state.remaining} of ${state.limit} left`;
  el.allowanceFill.style.width = `${pct}%`;
  el.allowance.classList.toggle("is-low", isLow(state) && state.remaining > 0);
  el.allowance.classList.toggle("is-out", state.remaining <= 0);
  el.allowanceNote.textContent = describeUsage(state);

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
  // The sign-in screen is what boot shows unless this browser session chose to carry on without
  // an account, so dropping that choice and reloading is the way back to it.
  session.leaveGuestMode();
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

async function refreshStorageUse() {
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
  el.allowance = $("accountAllowance");
  el.allowanceCount = $("allowanceCount");
  el.allowanceFill = $("allowanceFill");
  el.allowanceNote = $("allowanceNote");
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
    await refreshStorageUse();
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
  onUsageChange(render);
  refreshUsage();
  window.addEventListener("h1:session-lost", onSessionLost);
  render();
  refreshStorageUse();
  // The figures are only interesting when the person is looking at them.
  document.addEventListener("h1:view-changed", (event) => {
    if (event.detail !== "settings") return;
    refreshStorageUse();
    refreshUsage();
  });
}
