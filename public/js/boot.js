// Starts H1.
//
// H1's interface is ~90 separate script modules, and if any one of them fails to arrive the
// whole app fails to start. In production a small share of requests fail transiently at the
// hosting edge, so starting is made resilient in two layers:
//   1. a service worker (sw.js) that retries H1's own static files when they fail;
//   2. here: if the app still didn't start, reload (by then the service worker is in place),
//      at most twice, and after that show a clear "try again" screen rather than a half-drawn
//      page with dead buttons.
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

export async function startApp() {
  const workerReady = registerServiceWorker();
  try {
    await import("./main.js");
    writeRetries(0);
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
    showStartupError();
    return false;
  }
}

startApp();
