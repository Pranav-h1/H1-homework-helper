// Which interface language H1 speaks.
//
// The design system (design.css) holds H1's tokens and primitives. This picks the dialect they
// are rendered in — the same buttons, menus, lists and dialogs, drawn the way a given platform
// draws them:
//
//   apple     Default. A macOS-style desktop application: compact controls, hairline borders,
//             vibrancy on the chrome, restrained shadows, grouped inset lists, the system font.
//   classic   H1's own flat look: soft filled cards, roomier controls, no translucency.
//   material  Android/Material: elevation shadows, fully rounded buttons, larger touch targets.
//
// The choice is a normal H1 preference, so it saves with everything else and follows a signed-in
// student to their other devices.
import { safeGet, safeSet } from "./storage.js";

const KEY = "h1-os-style";
const FIRST_PAINT_KEY = "h1-last-os";
export const OS_STYLES = [
  { value: "apple", label: "Apple / macOS", hint: "Compact, calm and translucent, like a native Mac app." },
  { value: "classic", label: "Classic H1", hint: "H1's own flat look: soft surfaces, roomier controls." },
  { value: "material", label: "Android / Material", hint: "Material-style elevation, rounded buttons and larger targets." },
];

const listeners = new Set();

function isKnown(value) {
  return OS_STYLES.some((s) => s.value === value);
}

export function getStoredOsStyle() {
  const value = safeGet(KEY, "");
  return isKnown(value) ? value : "apple";
}

export function applyOsStyle(value) {
  const style = isKnown(value) ? value : "apple";
  document.documentElement.setAttribute("data-os", style);
  // Remembered outside the account namespace too, so the very first paint after a reload is
  // already in the right style instead of flashing the default (see early.js).
  try {
    localStorage.setItem(FIRST_PAINT_KEY, style);
  } catch {
    // A device that can't remember it just paints the default first.
  }
  listeners.forEach((cb) => {
    try {
      cb(style);
    } catch {
      // One listener failing must not stop the rest.
    }
  });
  return style;
}

export function setOsStyle(value) {
  const style = isKnown(value) ? value : "apple";
  safeSet(KEY, style);
  return applyOsStyle(style);
}

export function onOsStyleChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function initOsStyle() {
  return applyOsStyle(getStoredOsStyle());
}
