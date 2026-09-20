// Three small preferences about how much interface there is: how large the text runs, how
// tightly it is packed, and whether the sidebar starts open.
//
// Each one is a single number or word written onto <html>, which the design system reads through
// a token — so a preference never has to be threaded through a component. Text size and density
// belong to the person, so they sync with the account; whether the sidebar is collapsed belongs
// to the device (a phone and a laptop want different answers), and stays local.
import { safeGet, safeSet } from "./storage.js";

const TEXT_KEY = "h1-text-size";
const DENSITY_KEY = "h1-density";

export const TEXT_SIZES = [
  { value: "small", label: "Small", scale: 0.92 },
  { value: "default", label: "Default", scale: 1 },
  { value: "large", label: "Large", scale: 1.1 },
];

export const DENSITIES = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const listeners = new Set();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // One listener failing must not stop the rest.
    }
  });
}

function known(list, value, fallback) {
  return list.some((item) => item.value === value) ? value : fallback;
}

export function getTextSize() {
  return known(TEXT_SIZES, safeGet(TEXT_KEY, ""), "default");
}

export function applyTextSize(value) {
  const size = known(TEXT_SIZES, value, "default");
  const { scale } = TEXT_SIZES.find((s) => s.value === size);
  document.documentElement.style.setProperty("--fs-scale", String(scale));
  document.documentElement.setAttribute("data-text-size", size);
  return size;
}

export function setTextSize(value) {
  const size = applyTextSize(value);
  safeSet(TEXT_KEY, size);
  notify();
  return size;
}

export function getDensity() {
  return known(DENSITIES, safeGet(DENSITY_KEY, ""), "comfortable");
}

export function applyDensity(value) {
  const density = known(DENSITIES, value, "comfortable");
  document.documentElement.setAttribute("data-density", density);
  return density;
}

export function setDensity(value) {
  const density = applyDensity(value);
  safeSet(DENSITY_KEY, density);
  notify();
  return density;
}

export function onInterfacePrefsChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function initInterfacePrefs() {
  applyTextSize(getTextSize());
  applyDensity(getDensity());
}
