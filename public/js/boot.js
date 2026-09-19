// Starts H1.
//
// Two jobs, in this order:
//
// 1. Work out who H1 is running as — signed in, a guest, or a server with no accounts at all —
//    and, when signed in, bring that account's work onto the device BEFORE the app loads. Every
//    feature reads its data synchronously at start-up, so the data has to be there first.
//
// 2. Actually start the app, resiliently. H1's interface is ~95 separate script modules, and if
//    any one of them fails to arrive the whole app fails to start. In production a small share
//    of requests fail transiently at the hosting edge, so starting is protected in two layers:
//      • a service worker (sw.js) that retries H1's own static files when they fail;
//      • here: if the app still didn't start, reload (by then the service worker is in place),
//        at most twice, and after that show a clear "try again" screen rather than a half-drawn
//        page with dead buttons.
const RETRY_KEY = "h1-boot-retries";
const MAX_AUTO_RELOADS = 2;

function readRetries() {
  try {
    return Number(sessionStorage.getItem(RETRY_KEY) || 0);
  } catch {
    return MAX_AUTO_RELOADS;
  }
}

function writeRetries(n) {
  try {
    if (n) sessionStorage.setItem(RETRY_KEY, String(n));
    else sessionStorage.removeItem(RETRY_KEY);
  } catch {
    // Without sessionStorage there's no safe way to count reloads, so none are attempted.
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return Promise.resolve(null);
  return navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
}

function showStartupError() {
  hideSplash();
  const el = document.getElementById("bootError");
  if (!el) return;
  el.hidden = false;
  const retry = document.getElementById("bootErrorRetry");
  if (retry) {
    retry.addEventListener("click", () => {
      writeRetries(0);
      window.location.reload();
    });
    retry.focus();
  }
}

function splash(text) {
  const el = document.getElementById("bootSplash");
  const label = document.getElementById("bootSplashText");
  if (label && text) label.textContent = text;
  if (el) el.hidden = false;
}

function hideSplash() {
  const el = document.getElementById("bootSplash");
  if (el) el.hidden = true;
}

function revealApp() {
  document.documentElement.classList.remove("h1-gate");
  hideSplash();
}

// Signing in, or picking guest mode, decides which data H1 opens — so this runs before the app
// itself is imported. It never blocks start-up: any failure falls back to this device's own
// data, which is exactly how H1 worked before accounts existed.
async function prepare() {
  let session;
  try {
    session = await import("./session.js");
  } catch {
    return; // Can't load the session module: carry on as a guest on this device.
  }
  let outcome;
  try {
    splash("Checking your session…");
    outcome = await session.prepareSession();
  } catch {
    return;
  }

  if (outcome.action === "auth") {
    hideSplash();
    try {
      const { showAuthScreen } = await import("./authScreen.js");
      await showAuthScreen({ expired: outcome.expired });
    } catch {
      // The sign-in screen itself couldn't load — don't strand anyone: H1 opens as a guest.
      session.continueAsGuest();
    }
  }

  if (session.isAccountMode() && !session.isOffline()) {
    splash("Loading your work…");
    try {
      const sync = await import("./cloudSync.js");
      await sync.pullAll({ initial: true });
    } catch {
      // Couldn't fetch this time: the device's own copy is used and sync catches up later.
    }
  }
}

export async function startApp() {
  const workerReady = registerServiceWorker();
  try {
    await prepare();
  } catch {
    // Never let account set-up stop H1 from opening.
  }
  try {
    splash("Starting H1…");
    await import("./main.js");
    writeRetries(0);
    revealApp();
    return true;
  } catch (err) {
    const tries = readRetries();
    if (tries < MAX_AUTO_RELOADS) {
      writeRetries(tries + 1);
      // Give the service worker a moment to take over, so the reload is protected by it.
      await Promise.race([workerReady, new Promise((resolve) => setTimeout(resolve, 3000))]);
      window.location.reload();
      return false;
    }
    writeRetries(0);
    console.error("H1 couldn't start:", err);
    revealApp();
    showStartupError();
    return false;
  }
}

startApp();
