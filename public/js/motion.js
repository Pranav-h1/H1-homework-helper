// Motion, on a dial (Settings → Appearance → Motion).
//
// H1 used to have a single "Reduce motion" switch, which was really an off switch: it stopped
// every animation in the app. That is the right thing to offer, but it is not the only thing
// people want — most want the interface to stop performing without going completely still.
//
//   full     everything, including the arrival transitions.
//   reduced  state changes only, at roughly two thirds the duration. Nothing loops. (default)
//   off      no transitions, no animation, except the handful of indicators that exist to say
//            work is happening — a frozen spinner reads as a hang, not as calm.
//
// The value lands on <html data-motion="…">; design.css does the rest. The one class the other
// modules check, force-reduced-motion, still means "do not animate this yourself in JS".

const KEY = "h1-motion";
const LEGACY_KEY = "h1-reduce-motion";
const VALUES = ["full", "reduced", "off"];

export const DEFAULT_MOTION = "reduced";

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode, or storage full: the setting just won't survive the session. */
  }
}

export function getStoredMotion() {
  const raw = safeGet(KEY, null);
  if (VALUES.includes(raw)) return raw;
  // Anyone who had the old switch on wanted no motion at all — that switch stopped everything,
  // which is what Off means now. Anyone who had it off gets the new default.
  if (safeGet(LEGACY_KEY, "0") === "1") return "off";
  return DEFAULT_MOTION;
}

export function applyMotion(value) {
  const motion = VALUES.includes(value) ? value : DEFAULT_MOTION;
  const root = document.documentElement;
  root.setAttribute("data-motion", motion);
  root.classList.toggle("force-reduced-motion", motion === "off");
  return motion;
}

export function setMotion(value) {
  const motion = applyMotion(value);
  safeSet(KEY, motion);
  return motion;
}

export function initMotion() {
  return applyMotion(getStoredMotion());
}
