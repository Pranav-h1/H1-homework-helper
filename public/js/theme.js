import { safeGet, safeSet } from "./storage.js";

const THEME_KEY = "h1-theme";
const DEVICE_KEY = "h1-device-preview";
const ACCENT_KEY = "h1-accent";
const ACCENT_VALUES = ["purple", "blue", "cyan", "green", "orange", "pink"];
const lightQuery = window.matchMedia("(prefers-color-scheme: light)");

export function getStoredAccent() {
  const v = safeGet(ACCENT_KEY, "purple");
  return ACCENT_VALUES.includes(v) ? v : "purple";
}

// The theme and accent last shown on this device, read by early.js to paint the first frame
// correctly. Written straight to this device's storage (not to an account), since it's only a
// hint for the moment before an account's own settings have loaded.
function rememberForFirstPaint(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only a hint; without it the first frame may briefly show the default theme.
  }
}

export function applyAccent(value) {
  rememberForFirstPaint("h1-last-accent", value);
  // "purple" is the token defaults baked into :root, so it needs no [data-accent] override —
  // removing the attribute rather than setting data-accent="purple" keeps the CSS simpler.
  if (value === "purple") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", value);
  }
}

export function setAccent(value) {
  safeSet(ACCENT_KEY, value);
  applyAccent(value);
}

export function getStoredTheme() {
  const v = safeGet(THEME_KEY, "dark");
  return v === "light" || v === "system" ? v : "dark";
}

export function resolveTheme(pref) {
  if (pref === "system") return lightQuery.matches ? "light" : "dark";
  return pref === "light" ? "light" : "dark";
}

export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  rememberForFirstPaint("h1-last-theme", pref);
  return resolved;
}

export function setTheme(pref) {
  safeSet(THEME_KEY, pref);
  const resolved = applyTheme(pref);
  // Anything showing the current theme (the Settings control, the sidebar label) listens for
  // this, so a change made from anywhere — the command palette included — shows up everywhere.
  window.dispatchEvent(new CustomEvent("h1:theme-changed", { detail: { pref, resolved } }));
  return resolved;
}

export function initThemeSync(onChange) {
  lightQuery.addEventListener("change", () => {
    if (getStoredTheme() === "system") {
      const resolved = applyTheme("system");
      if (onChange) onChange(resolved);
    }
  });
}

export function getStoredDevice() {
  const v = safeGet(DEVICE_KEY, "auto");
  return ["desktop", "tablet", "phone"].includes(v) ? v : "auto";
}

export function applyDevice(value) {
  const app = document.getElementById("app");
  app.classList.remove("device-desktop", "device-tablet", "device-phone");
  if (value === "desktop") app.classList.add("device-desktop");
  else if (value === "tablet") app.classList.add("device-tablet");
  else if (value === "phone") app.classList.add("device-phone");
}

export function setDevice(value) {
  safeSet(DEVICE_KEY, value);
  applyDevice(value);
}

export function isCompactLayout() {
  const device = getStoredDevice();
  if (device === "desktop") return false;
  if (device === "tablet" || device === "phone") return true;
  return window.matchMedia("(max-width: 899px)").matches;
}
