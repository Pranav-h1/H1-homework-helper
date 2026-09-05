import { getStoredDevice } from "./theme.js";

const app = document.getElementById("app");
const mainView = document.getElementById("mainView");
const menuToggle = document.getElementById("menuToggle");
const navItems = document.querySelectorAll(".nav-item");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const subjectBar = document.getElementById("subjectBar");

const VIEWS_WITHOUT_SUBJECT_BAR = new Set(["settings", "notes", "study-mode", "exam-mode", "progress"]);

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
}

export function closeNav() {
  app.classList.remove("nav-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

export function switchView(view) {
  viewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  navItems.forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  subjectBar.hidden = VIEWS_WITHOUT_SUBJECT_BAR.has(view);
  mainView.scrollTop = 0;
  if (isCompactNow()) closeNav();
  listeners.forEach((cb) => cb(view));
}

navItems.forEach((item) => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

document.querySelectorAll("[data-open-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.openView));
});

menuToggle.addEventListener("click", () => {
  if (app.classList.contains("nav-open")) closeNav();
  else openNav();
});
document.getElementById("sidebarClose").addEventListener("click", closeNav);
document.getElementById("sidebarBackdrop").addEventListener("click", closeNav);
