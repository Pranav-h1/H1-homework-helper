// Who H1 is running as, on this device, right now.
//
// H1 has two honest modes and never blurs them:
//
//   Guest    — everything stays on this device, exactly as H1 worked before accounts existed.
//              No account, nothing uploaded.
//   Account  — signed in. Work is kept with the account and follows the person to their other
//              devices.
//
// The mode is decided at boot, before a single feature module loads, because it determines
// which set of stored data H1 opens. Nothing here proves identity: the browser holds no
// credential, and the server works out who a request is from by its session cookie alone.
import * as api from "./accountApi.js";
import { setNamespace } from "./storage.js";
import * as sync from "./cloudSync.js";

const MODE_KEY = "h1-device-mode";
const LAST_ACCOUNT_KEY = "h1-device-account";

const state = {
  mode: "guest",
  user: null,
  namespace: null,
  accountsAvailable: false,
  offline: false,
};

const listeners = new Set();

function deviceGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function deviceSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A device that can't remember the mode simply asks again next time.
  }
}

// Remembered so a signed-in device can open straight into the right data — and, when the
// network is down at start-up, still show that person their own work instead of an empty app.
// It holds no credential: just a display name and the local filing label.
function rememberAccount(user, namespace) {
  deviceSet(LAST_ACCOUNT_KEY, JSON.stringify({ username: user.username, namespace, accountType: user.accountType }));
}
function lastAccount() {
  try {
    const raw = deviceGet(LAST_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function onSessionChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function announce() {
  const snapshot = getSessionState();
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      /* one listener must not break the rest */
    }
  });
}

export function getSessionState() {
  return { ...state };
}

export function isAccountMode() {
  return state.mode === "account";
}

export function currentUser() {
  return state.user;
}

export function accountsAvailable() {
  return state.accountsAvailable;
}

export function isOffline() {
  return state.offline;
}

function enterAccount(session, { offline = false } = {}) {
  state.mode = "account";
  state.user = session.user;
  state.namespace = session.clientNs;
  state.offline = offline;
  setNamespace(session.clientNs);
  if (session.csrfToken) api.setCsrfToken(session.csrfToken);
  deviceSet(MODE_KEY, "account");
  rememberAccount(session.user, session.clientNs);
  sync.start(session.clientNs);
  announce();
}

function enterGuest() {
  state.mode = "guest";
  state.user = null;
  state.namespace = null;
  setNamespace(null);
  api.setCsrfToken(null);
  announce();
}

// Called by boot before the app loads. It never throws: if anything is wrong with the network
// or the server, H1 still starts.
//
// Returns one of:
//   { action: "start" }          — go ahead and start the app (guest or signed in)
//   { action: "auth" }           — show the sign-in screen first
export async function prepareSession() {
  const chosenMode = deviceGet(MODE_KEY);
  let session = null;
  let reachable = true;
  try {
    session = await api.getSession();
  } catch {
    reachable = false;
  }

  if (!reachable) {
    // The server can't be reached. If this device was signed in, open that account's work from
    // the device and keep it in account mode — changes queue up and go when the network is back.
    const remembered = lastAccount();
    if (chosenMode === "account" && remembered) {
      enterAccount({ user: { username: remembered.username, accountType: remembered.accountType }, clientNs: remembered.namespace }, { offline: true });
      state.accountsAvailable = true;
      return { action: "start", offline: true };
    }
    enterGuest();
    return { action: "start", offline: true };
  }

  state.accountsAvailable = Boolean(session.accountsAvailable);

  if (session.authenticated) {
    enterAccount(session);
    return { action: "start" };
  }

  // This server has no accounts at all: H1 is a device-only app here, exactly as before.
  if (!session.accountsAvailable) {
    enterGuest();
    deviceSet(MODE_KEY, null);
    return { action: "start" };
  }

  enterGuest();
  // Signed out (or the session ran out): ask, unless this device chose to stay a guest.
  if (chosenMode === "guest") return { action: "start" };
  return { action: "auth", expired: Boolean(session.expired) && chosenMode === "account" };
}

// The sign-in screen calls these. They throw ApiError with a message fit to show.
export async function signIn(username, password) {
  const session = await api.signIn(username, password);
  await confirmCookieStuck();
  enterAccount(session);
  return session;
}

export async function signUp(username, password, confirmPassword) {
  const session = await api.signUp(username, password, confirmPassword);
  await confirmCookieStuck();
  enterAccount(session);
  return session;
}

// H1 keeps people signed in with a cookie. If the browser is set to refuse cookies, the sign-in
// request itself succeeds and then nothing is remembered — so it is checked, rather than
// pretending it worked. H1 does not fall back to keeping a password or a token in storage:
// that would be a worse way to stay signed in, not a clever one.
async function confirmCookieStuck() {
  const check = await api.getSession().catch(() => null);
  if (check && check.authenticated) return true;
  api.setCsrfToken(null);
  const err = new api.ApiError("Cookies are required to keep you signed in. Please allow cookies for H1 and try again.", { code: "COOKIES_BLOCKED" });
  throw err;
}

export function continueAsGuest() {
  deviceSet(MODE_KEY, "guest");
  enterGuest();
}

// Signing out: everything waiting is uploaded first, then this account's copy is taken off the
// device, so the next person to use this computer doesn't find it. If the upload can't happen,
// the caller is told and the copy is kept — losing someone's work to tidy up is never the right
// trade.
export async function signOut({ force = false } = {}) {
  let flushed = true;
  if (isAccountMode() && !state.offline) flushed = await sync.flush({ timeoutMs: 10000 }).catch(() => false);
  if (!flushed && !force) return { ok: false, pending: sync.pendingKeys().length };

  try {
    await api.signOut();
  } catch {
    // Even if the server can't be reached, this device stops being signed in.
  }
  sync.stop();
  if (flushed) clearLocalAccountData();
  // Forgetting the choice means the sign-in screen is shown next time. Signing out is not the
  // same as choosing to use H1 without an account — that's a separate, deliberate button.
  deviceSet(MODE_KEY, null);
  state.user = null;
  state.namespace = null;
  state.mode = "guest";
  setNamespace(null);
  api.setCsrfToken(null);
  deviceSet(LAST_ACCOUNT_KEY, null);
  announce();
  return { ok: true, keptOnDevice: !flushed };
}

// Removes this account's cached copy from the device. Only ever called once everything has
// been uploaded.
function clearLocalAccountData() {
  const ns = state.namespace;
  if (!ns) return;
  const prefix = `h1u:${ns}:`;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(prefix) || key.startsWith(`h1sync:${ns}:`))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing else to do; the account's data is safe on the server either way.
  }
  try {
    indexedDB.deleteDatabase(`h1-files-${ns}`);
  } catch {
    // Same.
  }
}

// After the account is deleted there is nothing to upload and nothing to keep.
export function forgetAfterDelete() {
  sync.stop();
  clearLocalAccountData();
  deviceSet(MODE_KEY, null);
  deviceSet(LAST_ACCOUNT_KEY, null);
  state.user = null;
  state.namespace = null;
  state.mode = "guest";
  setNamespace(null);
  api.setCsrfToken(null);
  announce();
}

// The server told us this session is over (it expired, or it was ended from another device).
export function handleSessionLoss(reason) {
  if (!isAccountMode()) return;
  state.offline = false;
  sync.stop();
  announce();
  window.dispatchEvent(new CustomEvent("h1:session-lost", { detail: { reason } }));
}

api.onSignedOut((reason) => handleSessionLoss(reason));
