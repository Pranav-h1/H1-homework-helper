// Runs before first paint (a plain, blocking script in <head>) so the page never flashes the
// wrong theme. Kept as its own file rather than inline so the Content-Security-Policy can
// forbid inline scripts entirely.
(function () {
  try {
    var stored = localStorage.getItem("h1-theme") || "dark";
    var resolved = stored;
    if (stored === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", resolved === "light" ? "light" : "dark");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
