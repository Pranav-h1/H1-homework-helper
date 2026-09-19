// What counts as a valid username and password. Enforced here on the server — the sign-up
// form checks the same rules for instant feedback, but the server never trusts that it did.

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 128;
// Anything longer isn't a password anyone typed; refusing it early keeps a huge body from
// costing a full scrypt hash.
const PASSWORD_HARD_LIMIT = 1024;

// Letters and numbers from any script, plus . _ - between them. No spaces, no symbols that
// could be confused in a URL or look like punctuation.
const USERNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?$/u;

// H1's own account, and names that would impersonate H1 or its staff. Signing up with any of
// these is refused exactly like a taken username.
const MASTER_USERNAME = "Pranav-H1";
const RESERVED = new Set([MASTER_USERNAME, "admin", "administrator", "root", "system", "support", "moderator", "h1", "h1lab", "h1-lab", "h1_lab", "official", "staff", "null", "undefined"].map((u) => usernameKey(u)));

function codePoints(s) {
  return [...s].length;
}

function normalizeUsername(raw) {
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

// The form used for uniqueness and lookup: "Pranav", "pranav" and "PRANAV" are one account.
function usernameKey(username) {
  return normalizeUsername(username).toLocaleLowerCase("en-US");
}

// Returns an error message, or null when the username is acceptable for a NEW account.
function checkUsername(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "Choose a username.";
  const u = normalizeUsername(raw);
  const n = codePoints(u);
  if (n < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`;
  if (n > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (/\s/u.test(u)) return "Usernames can't contain spaces.";
  if (!USERNAME_PATTERN.test(u)) return "Use letters and numbers, with . _ or - between them.";
  return null;
}

function isReserved(raw) {
  return RESERVED.has(usernameKey(raw));
}

// Rules for a NEW password (sign-up, change password). Passwords are never trimmed or altered.
function checkNewPassword(password, confirm) {
  if (typeof password !== "string" || password.length === 0) return "Choose a password.";
  if (!password.trim()) return "A password can't be only spaces.";
  const n = codePoints(password);
  if (n < PASSWORD_MIN) return `Passwords need at least ${PASSWORD_MIN} characters.`;
  if (n > PASSWORD_MAX) return `Passwords can be at most ${PASSWORD_MAX} characters.`;
  if (typeof confirm !== "string" || confirm.length === 0) return "Type your password again to confirm it.";
  if (confirm !== password) return "The passwords don't match.";
  return null;
}

// Login only checks shape, never the sign-up rules — H1's own account is exempt from those, and
// an account created under older rules must still be able to sign in.
function plausibleLogin(username, password) {
  return (
    typeof username === "string" &&
    typeof password === "string" &&
    normalizeUsername(username).length > 0 &&
    codePoints(normalizeUsername(username)) <= 256 &&
    password.length > 0 &&
    password.length <= PASSWORD_HARD_LIMIT
  );
}

module.exports = {
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  PASSWORD_HARD_LIMIT,
  MASTER_USERNAME,
  normalizeUsername,
  usernameKey,
  checkUsername,
  isReserved,
  checkNewPassword,
  plausibleLogin,
};
