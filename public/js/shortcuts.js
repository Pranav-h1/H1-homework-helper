import { switchView } from "./nav.js";

const SINGLE_KEY_MAP = {
  g: "home",
  a: "chat",
  h: "homework",
  n: "notes",
  f: "study-mode",
};

const SHORTCUTS_REFERENCE = [
  ["Ctrl/Cmd + K", "Open Command Center"],
  ["Ctrl/Cmd + Shift + Space", "Quick Capture"],
  ["Esc", "Close the active overlay"],
  ["G", "Go to Home"],
  ["A", "Go to AI Tutor"],
  ["H", "Go to Homework"],
  ["N", "Go to Notes"],
  ["F", "Go to Focus"],
  ["?", "Show this shortcuts reference"],
];

function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function anyOverlayOpen() {
  return [
    "commandOverlay",
    "modalOverlay",
    "historyOverlay",
    "quickCaptureOverlay",
    "shortcutsOverlay",
  ].some((id) => {
    const el = document.getElementById(id);
    return el && !el.hidden;
  });
}

function buildReferenceOnce() {
  const overlay = document.getElementById("shortcutsOverlay");
  const list = document.getElementById("shortcutsList");
  if (!overlay || !list || list.dataset.built) return;
  list.dataset.built = "1";
  SHORTCUTS_REFERENCE.forEach(([keys, label]) => {
    const row = document.createElement("div");
    row.className = "shortcut-row";
    row.innerHTML = `<span></span><span class="command-kbd"></span>`;
    row.querySelector("span:first-child").textContent = label;
    row.querySelector(".command-kbd").textContent = keys;
    list.appendChild(row);
  });
}

function toggleShortcuts() {
  buildReferenceOnce();
  const overlay = document.getElementById("shortcutsOverlay");
  if (!overlay) return;
  overlay.hidden = !overlay.hidden;
}

export function initShortcuts() {
  buildReferenceOnce();

  document.getElementById("shortcutsCloseBtn")?.addEventListener("click", toggleShortcuts);
  document.getElementById("shortcutsOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "shortcutsOverlay") toggleShortcuts();
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // those combos are handled elsewhere (Ctrl+K etc.)
    if (isTypingContext(e.target)) return;

    if (e.key === "?") {
      e.preventDefault();
      toggleShortcuts();
      return;
    }

    // The shortcuts sheet is this module's own overlay, so it's the one responsible for
    // closing it on Escape — every other overlay (command palette, modal, quick capture)
    // already handles Escape itself.
    if (e.key === "Escape") {
      const overlay = document.getElementById("shortcutsOverlay");
      if (overlay && !overlay.hidden) {
        overlay.hidden = true;
        return;
      }
    }

    if (anyOverlayOpen()) return; // don't let single-letter nav fire while a palette/sheet is open

    const view = SINGLE_KEY_MAP[e.key.toLowerCase()];
    if (view) {
      e.preventDefault();
      switchView(view);
    }
  });
}
