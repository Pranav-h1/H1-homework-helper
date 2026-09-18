// Gives the tutor chat the whole main panel.
//
// Every other view is a page that scrolls, and reserves a fixed 132px at its end so its last
// item can scroll clear of the floating dock. The chat doesn't scroll as a page — its message
// log does — so that fixed reserve was simply dead space under the composer. Instead, the chat
// measures how far the dock (or the phone's bottom nav) actually reaches into the panel and
// keeps exactly that much clear, which at a normal desktop size is about 30px, not 132.
//
// It also owns the reading-width preference: answers either keep prose at a comfortable line
// length (wide tables, code and equations still use the full width), or run edge to edge.
import { onViewChange } from "./nav.js";
import { safeGet, safeSet } from "./storage.js";

const READING_KEY = "h1-reading-width";
const GAP_ABOVE_FLOATING_UI = 10;

let main = null;
let chatView = null;
let frame = 0;

function isVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && el.getClientRects().length > 0;
}

function measure() {
  frame = 0;
  if (!main || !chatView) return;
  const active = !chatView.hidden;
  main.classList.toggle("is-chat", active);
  if (!active) return;

  const panel = main.getBoundingClientRect();
  let clearance = 0;
  // The dock's wrapper is the stable box: the dock icons magnify on hover with a transform,
  // which would make a measurement taken mid-hover jump around.
  [document.querySelector(".dock-wrap .dock"), document.querySelector(".mobile-bottom-nav")].forEach((el) => {
    if (!isVisible(el)) return;
    const r = el.getBoundingClientRect();
    const overlapsSideways = r.right > panel.left && r.left < panel.right;
    if (!overlapsSideways || r.top >= panel.bottom) return;
    clearance = Math.max(clearance, panel.bottom - r.top + GAP_ABOVE_FLOATING_UI);
  });
  main.style.setProperty("--chat-clearance", `${Math.ceil(clearance)}px`);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

function applyReadingWidth(value, button) {
  const full = value === "full";
  chatView.classList.toggle("reading-full", full);
  if (button) {
    button.setAttribute("aria-pressed", String(full));
    button.title = full
      ? "Wide answers are on — text uses the full width. Click for a comfortable reading width."
      : "Let answer text use the full width (tables, code and equations always do)";
  }
}

export function initChatLayout() {
  main = document.getElementById("mainView");
  chatView = document.getElementById("view-chat");
  if (!main || !chatView) return;

  onViewChange(schedule);
  window.addEventListener("resize", schedule, { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(schedule).observe(main);
  // The sidebar collapsing, device-preview switching and the dock appearing all change the
  // panel or the floating UI without resizing the window.
  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, { attributes: true, attributeFilter: ["class"] });
  schedule();

  const button = document.getElementById("readingWidthBtn");
  applyReadingWidth(safeGet(READING_KEY, "comfortable"), button);
  if (button) {
    button.addEventListener("click", () => {
      const next = chatView.classList.contains("reading-full") ? "comfortable" : "full";
      safeSet(READING_KEY, next);
      applyReadingWidth(next, button);
    });
  }
}
