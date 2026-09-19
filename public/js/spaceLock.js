// The password on a Space.
//
// What it is: H1 asks for this password before opening the Space on a device. It's a separate
// password from the account's, so a Space can be shown to someone (or left open on a shared
// screen) without handing over the account.
//
// What it is not, and the UI says so plainly: it is not encryption. The Space's contents sit in
// the same storage as everything else, so someone with the device and the know-how could read
// them without the password. It's a lock on a door, not a safe.
//
// The password itself is never stored — only a PBKDF2-SHA-256 hash of it with a random salt, the
// same idea the server uses for account passwords.
const ITERATIONS = 150000;
const UNLOCKED_KEY = "h1-unlocked-spaces";

function randomBytes(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes) {
  let s = "";
  new Uint8Array(bytes).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromBase64(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

export async function makeLock(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS);
  return { v: 1, salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
}

export async function verifyLock(lock, password) {
  if (!lock || !lock.salt || !lock.hash) return false;
  try {
    const hash = await derive(password, fromBase64(lock.salt), lock.iterations || ITERATIONS);
    const expected = fromBase64(lock.hash);
    if (hash.length !== expected.length) return false;
    // Constant-time-ish comparison; there's no remote attacker here, but no reason to leak
    // where the first difference is either.
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// Which Spaces have been opened in this tab. Kept in sessionStorage — it holds space ids only,
// never a password — so switching between Spaces doesn't ask every single time, while closing
// the browser locks them again.
function readUnlocked() {
  try {
    const raw = sessionStorage.getItem(UNLOCKED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeUnlocked(set) {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify([...set]));
  } catch {
    // Then it asks again — which is the safe direction to fail in.
  }
}

export function isUnlocked(spaceId) {
  return readUnlocked().has(spaceId);
}

export function markUnlocked(spaceId) {
  const set = readUnlocked();
  set.add(spaceId);
  writeUnlocked(set);
}

export function lockAgain(spaceId) {
  const set = readUnlocked();
  set.delete(spaceId);
  writeUnlocked(set);
}

export function hasLock(space) {
  return Boolean(space && space.lock);
}
