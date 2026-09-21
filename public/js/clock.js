// The clock in H1's title bar, and the region it keeps time in.
//
// Two rules decide everything here:
//
//   1. The time shown is the real time, read from the device's own clock on every tick. Nothing
//      is ever cached, counted up from a stored value, or written into the page as a fixed
//      string — a clock that can drift or lie is worse than no clock.
//   2. The zone and the way the date reads come from Intl. A student in Chennai sees
//      "Sunday, 21 September" at Asia/Kolkata's offset; one in New York sees their own date and
//      their own month/day order, and daylight saving is handled by the browser's own time-zone
//      database rather than by arithmetic here.
//
// The region is a normal H1 preference, so it saves with everything else and follows a signed-in
// student to their other devices. "Use device time zone" is the default and simply asks Intl
// what this machine is set to.
import { safeGet, safeSet } from "./storage.js";

const KEY = "h1-region";
export const DEVICE_REGION = "auto";

// Locales are the English variant of each place, so H1 keeps speaking English while writing the
// date the way the region writes it (21 September in London, September 21 in New York).
export const REGIONS = [
  { value: DEVICE_REGION, label: "Use device time zone", zone: null, locale: null },
  { value: "in", label: "India", zone: "Asia/Kolkata", locale: "en-IN" },
  { value: "us-east", label: "United States — New York", zone: "America/New_York", locale: "en-US" },
  { value: "us-central", label: "United States — Chicago", zone: "America/Chicago", locale: "en-US" },
  { value: "us-mountain", label: "United States — Denver", zone: "America/Denver", locale: "en-US" },
  { value: "us-west", label: "United States — Los Angeles", zone: "America/Los_Angeles", locale: "en-US" },
  { value: "ca", label: "Canada — Toronto", zone: "America/Toronto", locale: "en-CA" },
  { value: "mx", label: "Mexico", zone: "America/Mexico_City", locale: "en-US" },
  { value: "br", label: "Brazil", zone: "America/Sao_Paulo", locale: "en-GB" },
  { value: "uk", label: "United Kingdom", zone: "Europe/London", locale: "en-GB" },
  { value: "ie", label: "Ireland", zone: "Europe/Dublin", locale: "en-IE" },
  { value: "fr", label: "France", zone: "Europe/Paris", locale: "en-GB" },
  { value: "de", label: "Germany", zone: "Europe/Berlin", locale: "en-GB" },
  { value: "es", label: "Spain", zone: "Europe/Madrid", locale: "en-GB" },
  { value: "it", label: "Italy", zone: "Europe/Rome", locale: "en-GB" },
  { value: "nl", label: "Netherlands", zone: "Europe/Amsterdam", locale: "en-GB" },
  { value: "se", label: "Sweden", zone: "Europe/Stockholm", locale: "en-GB" },
  { value: "tr", label: "Türkiye", zone: "Europe/Istanbul", locale: "en-GB" },
  { value: "ng", label: "Nigeria", zone: "Africa/Lagos", locale: "en-NG" },
  { value: "ke", label: "Kenya", zone: "Africa/Nairobi", locale: "en-KE" },
  { value: "za", label: "South Africa", zone: "Africa/Johannesburg", locale: "en-ZA" },
  { value: "eg", label: "Egypt", zone: "Africa/Cairo", locale: "en-GB" },
  { value: "ae", label: "United Arab Emirates", zone: "Asia/Dubai", locale: "en-AE" },
  { value: "sa", label: "Saudi Arabia", zone: "Asia/Riyadh", locale: "en-GB" },
  { value: "pk", label: "Pakistan", zone: "Asia/Karachi", locale: "en-PK" },
  { value: "bd", label: "Bangladesh", zone: "Asia/Dhaka", locale: "en-GB" },
  { value: "lk", label: "Sri Lanka", zone: "Asia/Colombo", locale: "en-GB" },
  { value: "np", label: "Nepal", zone: "Asia/Kathmandu", locale: "en-GB" },
  { value: "sg", label: "Singapore", zone: "Asia/Singapore", locale: "en-SG" },
  { value: "my", label: "Malaysia", zone: "Asia/Kuala_Lumpur", locale: "en-MY" },
  { value: "id", label: "Indonesia", zone: "Asia/Jakarta", locale: "en-GB" },
  { value: "ph", label: "Philippines", zone: "Asia/Manila", locale: "en-PH" },
  { value: "cn", label: "China", zone: "Asia/Shanghai", locale: "en-GB" },
  { value: "hk", label: "Hong Kong", zone: "Asia/Hong_Kong", locale: "en-HK" },
  { value: "jp", label: "Japan", zone: "Asia/Tokyo", locale: "en-GB" },
  { value: "kr", label: "South Korea", zone: "Asia/Seoul", locale: "en-GB" },
  { value: "au-east", label: "Australia — Sydney", zone: "Australia/Sydney", locale: "en-AU" },
  { value: "au-west", label: "Australia — Perth", zone: "Australia/Perth", locale: "en-AU" },
  { value: "nz", label: "New Zealand", zone: "Pacific/Auckland", locale: "en-NZ" },
];

const listeners = new Set();
let timer = null;

function findRegion(value) {
  return REGIONS.find((r) => r.value === value) || null;
}

export function getStoredRegion() {
  const value = safeGet(KEY, "");
  return findRegion(value) ? value : DEVICE_REGION;
}

// Browsers still report some zones under the name they had decades ago — a student in Chennai
// whose device says "Asia/Calcutta" should be told "Asia/Kolkata", which is what the zone has been
// called since 2008. Only the display name changes; the zone itself is the same either way.
const ZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Africa/Asmera": "Africa/Asmara",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Australia/Canberra": "Australia/Sydney",
};

export function canonicalZone(zone) {
  return ZONE_ALIASES[zone] || zone;
}

// What the device itself is set to. Wrapped because a browser with a broken or missing time-zone
// database still has to show a clock rather than throw on the way to the first paint.
export function deviceZone() {
  try {
    return canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  } catch {
    return "UTC";
  }
}

function deviceLocale() {
  try {
    return navigator.language || "en-GB";
  } catch {
    return "en-GB";
  }
}

export function resolveZone(value = getStoredRegion()) {
  const region = findRegion(value);
  return region && region.zone ? region.zone : deviceZone();
}

export function resolveLocale(value = getStoredRegion()) {
  const region = findRegion(value);
  return region && region.locale ? region.locale : deviceLocale();
}

// Intl throws on a zone or locale it doesn't recognise (an old browser, a zone added after it
// shipped). Rather than let that take the page down, fall back a step at a time: the asked-for
// zone, then the device's, then UTC.
function formatter(options, value) {
  const locale = resolveLocale(value);
  const zone = resolveZone(value);
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: deviceZone() });
    } catch {
      return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
    }
  }
}

export function formatTime(date = new Date(), value) {
  return formatter({ hour: "numeric", minute: "2-digit" }, value).format(date);
}

export function formatDate(date = new Date(), value) {
  return formatter({ weekday: "long", month: "long", day: "numeric" }, value).format(date);
}

// The short form the phone header uses, and part of the tooltip.
export function formatShortDate(date = new Date(), value) {
  return formatter({ weekday: "short", month: "short", day: "numeric" }, value).format(date);
}

export function zoneOffsetLabel(date = new Date(), value) {
  try {
    const parts = formatter({ timeZoneName: "shortOffset" }, value).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName");
    return name ? name.value : "";
  } catch {
    return "";
  }
}

export function describeZone(date = new Date(), value = getStoredRegion()) {
  const offset = zoneOffsetLabel(date, value);
  const zone = resolveZone(value);
  return offset ? `${zone} · ${offset}` : zone;
}

export function setRegion(value) {
  const region = findRegion(value) ? value : DEVICE_REGION;
  safeSet(KEY, region);
  render({ immediate: true });
  listeners.forEach((cb) => {
    try {
      cb(region);
    } catch {
      // One listener failing must not stop the rest.
    }
  });
  return region;
}

export function onRegionChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// The minute changing is the only thing on screen that moves without being asked, so it should
// look like it settled rather than like it flicked: the old value dims, the new one is written
// underneath it, and it comes back up. Nothing moves and nothing scales. Anyone who has asked
// for reduced motion just gets the new value.
const FADE_MS = 260;

function prefersReducedMotion() {
  try {
    return document.documentElement.classList.contains("force-reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function softSet(el, value, immediate) {
  if (el.textContent === value) return;
  // The placeholder in the markup is not a value anyone read, so the first real time is
  // written straight in rather than faded up from a row of dashes.
  if (immediate || !el.textContent || el.textContent.includes("--") || prefersReducedMotion()) {
    el.textContent = value;
    return;
  }
  el.classList.add("is-changing");
  window.setTimeout(() => {
    el.textContent = value;
    el.classList.remove("is-changing");
  }, FADE_MS);
}

// --- the clock itself ------------------------------------------------------------------------
export function render({ immediate = false } = {}) {
  const now = new Date();
  const time = formatTime(now);
  const long = formatDate(now);
  const short = formatShortDate(now);
  const zone = describeZone(now);
  document.querySelectorAll("[data-clock-time]").forEach((el) => {
    softSet(el, time, immediate);
  });
  document.querySelectorAll("[data-clock-date]").forEach((el) => {
    softSet(el, el.dataset.clockDate === "short" ? short : long, immediate);
  });
  document.querySelectorAll("[data-clock]").forEach((el) => {
    el.title = `${long} · ${zone}`;
    // Read out as one phrase rather than as two loose fragments.
    el.setAttribute("aria-label", `${time}, ${long}`);
  });
  return { time, date: long, zone };
}

// Tick on the minute rather than every second: the display has no seconds in it, so waking every
// second would be 59 wasted repaints a minute. The extra 400ms keeps the tick just past the
// boundary so it never renders the minute it is about to leave.
function schedule() {
  if (timer) clearTimeout(timer);
  const now = new Date();
  const wait = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 400;
  timer = setTimeout(() => {
    render();
    schedule();
  }, wait);
}

export function initClock() {
  render({ immediate: true });
  schedule();
  // A laptop that was asleep, or a tab left in the background, comes back to a stale clock —
  // and a background tab's timers are throttled, so the tick may be minutes late.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    render();
    schedule();
  });
  window.addEventListener("focus", render);
  // A region chosen on another device arrives as a plain write, so re-read on that too.
  window.addEventListener("h1:region-changed", render);
}
