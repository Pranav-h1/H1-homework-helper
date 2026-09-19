// The same username and password rules the server enforces, repeated here only so the form can
// answer straight away while someone types. The server checks all of it again on every request
// and its answer is the one that counts — nothing here is a security control.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

const USERNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?$/u;

function normalize(raw) {
  return typeof raw === "string" ? raw.normalize("NFKC").trim() : "";
}

function length(s) {
  return [...s].length;
}

export function checkUsername(raw) {
  const u = normalize(raw);
  if (!u) return "Choose a username.";
  const n = length(u);
  if (n < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`;
  if (n > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (/\s/u.test(u)) return "Usernames can't contain spaces.";
  if (!USERNAME_PATTERN.test(u)) return "Use letters and numbers, with . _ or - between them.";
  return null;
}

// Returns { message, field } or null. Passwords are never trimmed — a space is a character.
export function checkPasswords(password, confirm) {
  if (typeof password !== "string" || password.length === 0) return { message: "Choose a password.", field: "password" };
  if (!password.trim()) return { message: "A password can't be only spaces.", field: "password" };
  const n = length(password);
  if (n < PASSWORD_MIN) return { message: `Passwords need at least ${PASSWORD_MIN} characters.`, field: "password" };
  if (n > PASSWORD_MAX) return { message: `Passwords can be at most ${PASSWORD_MAX} characters.`, field: "password" };
  if (typeof confirm !== "string" || confirm.length === 0) return { message: "Type your password again to confirm it.", field: "confirmPassword" };
  if (confirm !== password) return { message: "The passwords don't match.", field: "confirmPassword" };
  return null;
}
