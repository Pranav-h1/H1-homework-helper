// Talking to H1's account API.
//
// Two rules hold everywhere in this file:
//   • The browser never holds a credential. The session lives in a cookie the page can't read
//     (HttpOnly), so there is nothing here to steal from storage — no password, no token.
//   • The CSRF token lives in a variable in memory for as long as the page is open, and nowhere
//     else. It isn't written to localStorage, so a different site can't get at it and a shared
//     computer doesn't keep it after the tab closes.

const JSON_HEADERS = { "Content-Type": "application/json" };

let csrfToken = null;
const listeners = { signedOut: new Set() };

export class ApiError extends Error {
  constructor(message, { status = 0, code = "", field = "", offline = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.offline = offline;
  }
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function hasCsrfToken() {
  return Boolean(csrfToken);
}

// Only for the "page is closing" save, which has to build its request by hand. The token stays
// a module variable — it is never put on `window`, where any script on the page could read it.
export function getCsrfToken() {
  return csrfToken;
}

// Fires when the server says this session is over (signed out elsewhere, expired, deleted).
export function onSignedOut(cb) {
  listeners.signedOut.add(cb);
  return () => listeners.signedOut.delete(cb);
}

function announceSignedOut(reason) {
  csrfToken = null;
  listeners.signedOut.forEach((cb) => {
    try {
      cb(reason);
    } catch {
      // One listener failing shouldn't stop the others.
    }
  });
}

async function request(method, url, body, { retryOnCsrf = true, timeoutMs = 20000 } = {}) {
  const headers = { ...JSON_HEADERS };
  if (csrfToken && method !== "GET") headers["X-H1-CSRF"] = csrfToken;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      // Same-origin only: H1's pages and its API share one origin, and the cookie should never
      // travel anywhere else.
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(err && err.name === "AbortError" ? "That took too long. Check your connection and try again." : "H1 couldn't reach the server. Check your connection and try again.", {
      offline: true,
    });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (data && data.csrfToken) csrfToken = data.csrfToken;

  if (res.ok) return data === null ? {} : data;

  const code = (data && data.code) || "";
  // The page's CSRF token can go stale if the session rotated in another tab. Fetch the current
  // one once and retry — the person shouldn't see an error for our bookkeeping.
  if (res.status === 403 && code === "CSRF" && retryOnCsrf) {
    const session = await getSession().catch(() => null);
    if (session && session.authenticated) return request(method, url, body, { retryOnCsrf: false, timeoutMs });
  }
  // A 401 that means "this session is over" ends the session here too. A 401 that means "that
  // password was wrong" — checking your own password to change it, say — must not: getting a
  // password wrong once should never look like being signed out, or stop syncing.
  if (res.status === 401 && (code === "SESSION_EXPIRED" || code === "NOT_SIGNED_IN")) {
    announceSignedOut(code === "SESSION_EXPIRED" ? "expired" : "signed-out");
  }
  throw new ApiError((data && data.error) || "Something went wrong. Please try again.", {
    status: res.status,
    code,
    field: (data && data.field) || "",
  });
}

// --- session ------------------------------------------------------------------------------
export function getSession() {
  return request("GET", "/api/auth/session", undefined, { timeoutMs: 12000 });
}

export function signUp(username, password, confirmPassword) {
  return request("POST", "/api/auth/signup", { username, password, confirmPassword });
}

export function signIn(username, password) {
  return request("POST", "/api/auth/login", { username, password });
}

export function signOut() {
  return request("POST", "/api/auth/logout", {});
}

// --- account ------------------------------------------------------------------------------
export function getAccount() {
  return request("GET", "/api/account");
}

export function changePassword(currentPassword, newPassword, confirmPassword) {
  return request("POST", "/api/account/password", { currentPassword, newPassword, confirmPassword });
}

export function verifyPassword(password) {
  return request("POST", "/api/account/verify-password", { password });
}

export function signOutEverywhere() {
  return request("POST", "/api/account/logout-all", {});
}

export function deleteAccount(password) {
  return request("POST", "/api/account/delete", { password });
}

// --- data ---------------------------------------------------------------------------------
export function fetchAllData() {
  return request("GET", "/api/data", undefined, { timeoutMs: 45000 });
}

export function fetchRevision() {
  return request("GET", "/api/data/revision", undefined, { timeoutMs: 12000 });
}

export function saveChanges(changes) {
  return request("PUT", "/api/data", { changes }, { timeoutMs: 45000 });
}

// --- files --------------------------------------------------------------------------------
export function putFileRecord(record) {
  return request("PUT", `/api/files/${encodeURIComponent(record.id)}`, { record }, { timeoutMs: 60000 });
}

export function getFileRecord(id) {
  return request("GET", `/api/files/${encodeURIComponent(id)}`, undefined, { timeoutMs: 60000 });
}

export function deleteFiles(payload) {
  return request("POST", "/api/files/delete", payload);
}

export function reassignFileRecords(ids, conversationId) {
  return request("POST", "/api/files/reassign", { ids, conversationId });
}
