// How much room the floating dock takes out of the bottom of the window.
//
// The dock (and, on a phone, the bottom navigation) floats over the content panel rather than
// sitting beside it. Pages used to reserve a guessed 88–132px at their end to compensate, which
// went wrong in two ways: the guess didn't match the dock at every size, and a reserve at the
// END of a page does nothing for a region that scrolls on its own (the notes list, the settings
// column, the periodic table) or for a list that keeps loading as you reach the bottom (the
// quotes wall) — in those, content simply sat under the dock and couldn't be brought out.
//
// So the room is measured from the dock itself, published once as --dock-inset, and every
// scrolling region pads its end with it. The dock stays floating; nothing ends up under it.
const GAP = 12;
let app = null;
let panel = null;
let frame = 0;

function isVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0" && el.getClientRects().length > 0;
}

function measure() {
  frame = 0;
  if (!app || !panel) return;
  const wrap = document.querySelector(".dock-wrap");
  const rect = panel.getBoundingClientRect();
  let inset = 0;

  // An auto-hidden dock (the tutor) is measured by the strip it leaves behind, not by the dock
  // it is hiding — otherwise the page would reserve room for something that isn't shown.
  const hidden = wrap && wrap.classList.contains("dock-autohide");
  const candidates = [hidden ? wrap : document.querySelector(".dock-wrap .dock"), document.querySelector(".mobile-bottom-nav")];

  candidates.forEach((el) => {
    if (!isVisible(el)) return;
    const r = el.getBoundingClientRect();
    const overlapsSideways = r.right > rect.left && r.left < rect.right;
    if (!overlapsSideways || r.top >= rect.bottom) return;
    inset = Math.max(inset, rect.bottom - r.top + GAP);
  });

  app.style.setProperty("--dock-inset", `${Math.ceil(inset)}px`);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

export function initDockInset() {
  app = document.getElementById("app");
  panel = document.getElementById("mainView");
  if (!app || !panel) return;

  measure();
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("h1:view-changed", schedule);

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    // The dock and the phone's bar change size at breakpoints, and animate as they do.
    [document.querySelector(".dock-wrap .dock"), document.querySelector(".dock-wrap"), document.querySelector(".mobile-bottom-nav")].forEach((el) => {
      if (!el) return;
      observer.observe(el);
      el.addEventListener("transitionend", schedule);
    });
  }
  // Collapsing the sidebar, switching the device preview, or the tutor tucking the dock away all
  // change the geometry without resizing the window.
  new MutationObserver(schedule).observe(app, { attributes: true, attributeFilter: ["class"], subtree: false });
  const wrap = document.querySelector(".dock-wrap");
  if (wrap) new MutationObserver(schedule).observe(wrap, { attributes: true, attributeFilter: ["class"] });
}
