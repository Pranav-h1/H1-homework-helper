import { getStoredDevice } from "./theme.js";
import { safeGet, safeSet } from "./storage.js";

const app = document.getElementById("app");
const mainView = document.getElementById("mainView");
const menuToggle = document.getElementById("menuToggle");
const navItems = document.querySelectorAll(".nav-item");
const dockItems = document.querySelectorAll(".dock-item");
const mobileNavItems = document.querySelectorAll(".mobile-nav-item[data-view]");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const subjectBar = document.getElementById("subjectBar");
const topbarTitle = document.getElementById("topbarTitle");
const sidebarCollapseToggle = document.getElementById("sidebarCollapseToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const mobileMoreBtn = document.getElementById("mobileMoreBtn");

const VIEWS_WITHOUT_SUBJECT_BAR = new Set([
  "settings",
  "notes",
  "study-mode",
  "progress",
  "homework",
  "subjects",
  "documents",
  "planner",
  "calendar",
  "achievements",
  "tools",
  "profile",
  "projects",
  "favorites",
  "quotes",
]);

// Sections reachable from the mobile bottom nav's fixed slots — everything else lives
// behind "More" (which opens the full sidebar drawer) rather than crowding the bar.
const MOBILE_BOTTOM_VIEWS = new Set(["home", "chat", "homework", "quiz"]);

// Views reachable only from the top bar / command palette (no sidebar nav-item to read a
// label from) — used as a topbar-title fallback.
const EXTRA_VIEW_LABELS = { profile: "Profile", favorites: "Favorites" };

const listeners = [];

export function onViewChange(cb) {
  listeners.push(cb);
}

export function isCompactNow() {
  const device = getStoredDevice();
  if (device === "desktop") return false;
  if (device === "tablet" || device === "phone") return true;
  return window.matchMedia("(max-width: 899px)").matches;
}

export function openNav() {
  app.classList.add("nav-open");
  menuToggle.setAttribute("aria-expanded", "true");
  sidebarBackdrop.hidden = false;
}

export function closeNav() {
  app.classList.remove("nav-open");
  menuToggle.setAttribute("aria-expanded", "false");
  sidebarBackdrop.hidden = true;
}

// Slides the single glass "pill" behind whichever sidebar item is active, per nav-group,
// instead of every item carrying its own static highlight (see .nav-active-pill in CSS).
function positionActivePill(view) {
  document.querySelectorAll(".nav-group").forEach((group) => {
    const pill = group.querySelector(".nav-active-pill");
    if (!pill) return;
    const activeItem = group.querySelector(`.nav-item[data-view="${view}"]`);
    if (!activeItem) {
      pill.classList.remove("visible");
      return;
    }
    pill.style.transform = `translateY(${activeItem.offsetTop}px)`;
    pill.style.height = `${activeItem.offsetHeight}px`;
    pill.classList.add("visible");
  });
}

export function switchView(view) {
  viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  let activeLabel = EXTRA_VIEW_LABELS[view] || view;
  navItems.forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    if (active) {
      const span = item.querySelector("span");
      if (span) activeLabel = span.textContent;
    }
  });
  dockItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  mobileNavItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if (mobileMoreBtn) mobileMoreBtn.classList.toggle("active", !MOBILE_BOTTOM_VIEWS.has(view));

  if (topbarTitle) topbarTitle.textContent = activeLabel;
  subjectBar.hidden = VIEWS_WITHOUT_SUBJECT_BAR.has(view);
  mainView.scrollTop = 0;
  positionActivePill(view);
  if (isCompactNow()) closeNav();
  listeners.forEach((cb) => cb(view));
}

navItems.forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});
dockItems.forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});
mobileNavItems.forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});
if (mobileMoreBtn) mobileMoreBtn.addEventListener("click", openNav);

document.querySelectorAll("[data-open-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.openView));
});

menuToggle.addEventListener("click", () => {
  if (app.classList.contains("nav-open")) closeNav();
  else openNav();
});
document.getElementById("sidebarClose").addEventListener("click", closeNav);
document.getElementById("sidebarBackdrop").addEventListener("click", closeNav);

// Desktop sidebar collapse (icon-only rail), independent of the mobile drawer above.
if (sidebarCollapseToggle) {
  function applyCollapsed(collapsed) {
    app.classList.toggle("sidebar-collapsed", collapsed);
    sidebarCollapseToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    requestAnimationFrame(() => {
      const activeItem = document.querySelector(".nav-item.active");
      if (activeItem) positionActivePill(activeItem.dataset.view);
    });
  }
  applyCollapsed(safeGet("h1-sidebar-collapsed", "0") === "1");
  sidebarCollapseToggle.addEventListener("click", () => {
    const collapsed = !app.classList.contains("sidebar-collapsed");
    applyCollapsed(collapsed);
    safeSet("h1-sidebar-collapsed", collapsed ? "1" : "0");
  });
}

// A soft shadow fades in under the top bar once content actually scrolls beneath it,
// so the chrome reads as one continuous glass surface at rest (see .app.scrolled in CSS).
mainView.addEventListener(
  "scroll",
  () => {
    app.classList.toggle("scrolled", mainView.scrollTop > 4);
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  const activeItem = document.querySelector(".nav-item.active");
  if (activeItem) positionActivePill(activeItem.dataset.view);
});
