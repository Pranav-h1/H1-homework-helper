// How solid H1's surfaces are.
//
// This is deliberately NOT `opacity` on the app. Fading the whole interface would fade the text,
// the icons and the focus rings with it, and at anything under full strength the app would be
// unreadable. Instead there is one number, --ui-opacity, and every material in the design system
// is mixed with transparency by it:
//
//   --alpha-surface   panels, cards, the sidebar and the title bar
//   --alpha-overlay   menus, dialogs, toasts, the dock — things that float over content
//
// Both are clamped by a floor that each interface style sets for itself (Material stays close to
// solid; the glassier styles can go much further), so the bottom of the slider is translucent,
// never invisible. Text, icons, borders and anything else carrying meaning are untouched.
import { safeGet, safeSet } from "./storage.js";

const KEY = "h1-ui-opacity";
export const DEFAULT_OPACITY = 100;

const listeners = new Set();

function clamp(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_OPACITY;
  return Math.min(100, Math.max(0, n));
}

export function getStoredOpacity() {
  const raw = safeGet(KEY, "");
  return raw === "" || raw === null ? DEFAULT_OPACITY : clamp(raw);
}

export function applyOpacity(value) {
  const pct = clamp(value);
  document.documentElement.style.setProperty("--ui-opacity", String(pct / 100));
  listeners.forEach((cb) => {
    try {
      cb(pct);
    } catch {
      // One listener failing must not stop the rest.
    }
  });
  return pct;
}

export function setOpacity(value) {
  const pct = clamp(value);
  safeSet(KEY, String(pct));
  return applyOpacity(pct);
}

export function onOpacityChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function initOpacity() {
  return applyOpacity(getStoredOpacity());
}
