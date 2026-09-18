// H1's service worker. It does exactly one job: retry H1's own static files when the network
// hiccups.
//
// In production, a small share of requests fail at the hosting edge with a 520/502 after a few
// seconds, and an immediate retry of the same file succeeds. H1 loads its interface as ~90
// separate script modules, so without this roughly one page load in seven lost a module and
// never started.
//
// Deliberately NOT a cache: every request still goes to the network and gets the current
// version of the file, so a deploy can never leave a mix of old and new code running. And it
// only ever retries GETs for H1's own static files — never /api requests, which aren't safe to
// repeat and must fail honestly.
const RETRIES = [250, 700, 1500];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function isRetryable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return url.pathname === "/" || /\.(js|mjs|css|html|svg|png|ico|json|txt|woff2?)$/.test(url.pathname);
}

async function fetchWithRetry(request) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES.length; attempt++) {
    try {
      const response = await fetch(request.clone());
      // 5xx from the edge is the transient failure; 4xx is a real answer.
      if (response.status < 500 || attempt === RETRIES.length) return response;
    } catch (err) {
      lastError = err;
      if (attempt === RETRIES.length) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRIES[attempt]));
  }
  throw lastError || new Error("fetch failed");
}

self.addEventListener("fetch", (event) => {
  if (!isRetryable(event.request)) return;
  event.respondWith(fetchWithRetry(event.request));
});
