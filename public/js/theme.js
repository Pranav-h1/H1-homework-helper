import { safeGet, safeSet } from "./storage.js";

const THEME_KEY = "h1-theme";
const DEVICE_KEY = "h1-device-preview";
const lightQuery = window.matchMedia("(prefers-color-scheme: light)");

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
  return resolved;
}

export function setTheme(pref) {
  safeSet(THEME_KEY, pref);
  return applyTheme(pref);
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

const REDUCE_MOTION_KEY = "h1-reduce-motion";

export function getStoredReduceMotion() {
  return safeGet(REDUCE_MOTION_KEY, "0") === "1";
}

export function applyReduceMotion(value) {
  document.documentElement.classList.toggle("force-reduced-motion", Boolean(value));
}

export function setReduceMotion(value) {
  safeSet(REDUCE_MOTION_KEY, value ? "1" : "0");
  applyReduceMotion(value);
}

export function isCompactLayout() {
  const device = getStoredDevice();
  if (device === "desktop") return false;
  if (device === "tablet" || device === "phone") return true;
  return window.matchMedia("(max-width: 899px)").matches;
}
