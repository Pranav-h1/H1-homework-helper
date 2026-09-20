// The first thing that runs (a plain, blocking script in <head>). Three small jobs:
//
//  1. Paint the right theme and accent before anything draws, so there's no flash.
//  2. Register the service worker (sw.js) as early as possible — it retries H1's own files
//     when the hosting edge drops a request, and the sooner it's in place the more of this
//     very first load it protects.
//  3. Watch for a <script> that fails to load. If boot.js itself is the file that got
//     dropped, nothing else could notice — so this reloads (at most twice, sharing the count
//     with boot.js), by which time the service worker is protecting the page.
//
// Kept as its own file rather than inline so the Content-Security-Policy can forbid inline
// scripts entirely.
(function () {
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem("h1-last-theme") || localStorage.getItem("h1-theme") || "dark";
    if (theme === "system") theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    root.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    var accent = localStorage.getItem("h1-last-accent") || localStorage.getItem("h1-accent");
    if (accent && accent !== "purple" && /^[a-z]+$/.test(accent)) root.setAttribute("data-accent", accent);
  } catch (e) {
    root.setAttribute("data-theme", "dark");
  }

  // Hold the interface back for a moment while boot.js works out whether this is a signed-in
  // account or a guest — otherwise the app shell flashes up, then gets covered by the sign-in
  // screen. The timeout is a safety net: if boot.js never runs (dropped request, a browser
  // without modules), the interface appears anyway rather than leaving a blank page.
  root.className += (root.className ? " " : "") + "h1-gate";
  setTimeout(function () {
    root.className = root.className.replace(/(^|\s)h1-gate(?=\s|$)/, "");
  }, 8000);

  // Ask who's signed in straight away, in parallel with the ~95 script modules the page is
  // about to load. Boot needs the answer before it can start the app (it decides which data to
  // open), and starting the request here instead of after the modules arrive means it costs no
  // extra waiting at all.
  try {
    window.__h1SessionProbe = fetch("/api/auth/session", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
  } catch (e) {
    window.__h1SessionProbe = null;
  }

  var workerReady = null;
  try {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      workerReady = navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(function () {
          return navigator.serviceWorker.ready;
        })
        .catch(function () {
          return null;
        });
    }
  } catch (e) {
    workerReady = null;
  }

  var RETRY_KEY = "h1-boot-retries";
  var MAX_AUTO_RELOADS = 2;
  var reloading = false;
  window.addEventListener(
    "error",
    function (event) {
      var el = event.target;
      if (reloading || !el || el.tagName !== "SCRIPT" || !el.src) return;
      if (el.src.indexOf(window.location.origin) !== 0) return;
      var tries = 0;
      try {
        tries = Number(sessionStorage.getItem(RETRY_KEY) || 0);
      } catch (e) {
        return;
      }
      if (tries >= MAX_AUTO_RELOADS) {
        var screen = document.getElementById("bootError");
        if (screen) screen.hidden = false;
        return;
      }
      reloading = true;
      try {
        sessionStorage.setItem(RETRY_KEY, String(tries + 1));
      } catch (e) {
        // counted above; nothing else to do
      }
      var go = function () {
        window.location.reload();
      };
      Promise.race([workerReady || Promise.resolve(), new Promise(function (r) { setTimeout(r, 3000); })]).then(go, go);
    },
    true
  );
})();
