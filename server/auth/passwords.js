// Password hashing with scrypt — a memory-hard key-derivation function built into Node, so
// there's no native dependency to install.
//
// Stored format: scrypt$<log2 N>$<r>$<p>$<salt>$<hash>  (salt and hash in base64url)
// The parameters travel with each hash, so they can be raised later without breaking
// existing accounts. Passwords themselves are never stored, logged or returned.
const crypto = require("crypto");

const LOG2_N = 15; // N = 32768 → about 32 MB of memory per hash
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

function scrypt(password, salt, log2n, r, p) {
  const N = 2 ** log2n;
  return new Promise((resolve, reject) => {
    // maxmem must cover 128 * N * r bytes with some headroom.
    crypto.scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password.normalize("NFKC"), salt, LOG2_N, R, P);
  return ["scrypt", LOG2_N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

function parseHash(stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, log2n, r, p, salt, key] = parts;
  const nums = [log2n, r, p].map(Number);
  // Refuse absurd parameters from a tampered row rather than burning CPU/memory on them.
  if (!nums.every(Number.isInteger) || nums[0] < 10 || nums[0] > 20 || nums[1] < 1 || nums[1] > 32 || nums[2] < 1 || nums[2] > 4) return null;
  return { log2n: nums[0], r: nums[1], p: nums[2], salt: Buffer.from(salt, "base64url"), key: Buffer.from(key, "base64url") };
}

function isValidHash(stored) {
  const h = parseHash(stored);
  return Boolean(h && h.salt.length >= 16 && h.key.length === KEYLEN);
}

async function verifyPassword(password, stored) {
  const h = parseHash(stored);
  if (!h || typeof password !== "string") return false;
  const key = await scrypt(password.normalize("NFKC"), h.salt, h.log2n, h.r, h.p);
  return key.length === h.key.length && crypto.timingSafeEqual(key, h.key);
}

// A hash of a random password nobody knows. A login for a username that doesn't exist is
// checked against this, so it takes as long as a real wrong password — response timing can't
// be used to find out which usernames exist.
let dummyHash = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(24).toString("base64url"));
  return dummyHash;
}

module.exports = { hashPassword, verifyPassword, isValidHash, getDummyHash };
