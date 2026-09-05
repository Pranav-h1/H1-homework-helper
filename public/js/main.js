import "./nav.js";
import { switchView, onViewChange } from "./nav.js";
import { appState, setSubject } from "./state.js";
import {
  getStoredTheme,
  setTheme,
  applyTheme,
  initThemeSync,
  getStoredDevice,
  setDevice,
  applyDevice,
  getStoredReduceMotion,
  setReduceMotion,
} from "./theme.js";
import { showToast } from "./toast.js";
import { onHealthChange, startHealthPolling } from "./health.js";
import { confirmDanger } from "./modal.js";
import { safeGet, safeSet } from "./storage.js";
import { exportData, importData } from "./dataTransfer.js";
import { isEnabled as gamificationEnabled, setEnabled as setGamificationEnabled } from "./gamification.js";
import { clearAllConversations } from "./conversations.js";
import { initChat, openChatWithMessage, prefillChat, setEnterMode, clearAllConversationsData } from "./chat.js";
import { initExplain } from "./explain.js";
import { initQuiz } from "./quiz.js";
import { initFlashcards } from "./flashcards.js";
import { initNotes, clearAllNotesData, bindMoreTools } from "./notes.js";
import { initStudyMode } from "./studyMode.js";
import { initMoreTools, summarizeText, generatePracticeFromSource } from "./moreTools.js";
import { initCommandPalette } from "./commandPalette.js";
import { initExamMode } from "./examMode.js";
import { initProgressPage, renderProgressPage } from "./progressPage.js";
import { initHomeWidgets, renderHomeWidget } from "./homeWidgets.js";

/* ---------------------------------------------------------
   DOM references
   --------------------------------------------------------- */
const subjectChips = document.querySelectorAll(".chip[data-subject]");
const configBanner = document.getElementById("configBanner");
const configBannerText = document.getElementById("configBannerText");
const configBannerClose = document.getElementById("configBannerClose");
const sidebarStatusDot = document.getElementById("sidebarStatusDot");
const sidebarStatusText = document.getElementById("sidebarStatusText");
const settingsProviderName = document.getElementById("settingsProviderName");
const settingsStatusPill = document.getElementById("settingsStatusPill");

const quickThemeToggle = document.getElementById("quickThemeToggle");
const sidebarThemeToggle = document.getElementById("sidebarThemeToggle");
const sidebarThemeLabel = document.getElementById("sidebarThemeLabel");

const themeSettingGroup = document.getElementById("themeSetting");
const deviceSettingGroup = document.getElementById("deviceSetting");
const enterToSendGroup = document.getElementById("enterToSendSetting");
const autoScrollToggle = document.getElementById("autoScrollToggle");
const saveConversationsToggle = document.getElementById("saveConversationsToggle");
const reduceMotionToggle = document.getElementById("reduceMotionToggle");
const gamificationToggle = document.getElementById("gamificationToggle");

const heroGreeting = document.getElementById("heroGreeting");
const heroAskForm = document.getElementById("heroAskForm");
const heroAskInput = document.getElementById("heroAskInput");
const quickActions = document.getElementById("quickActions");

const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importDataInput = document.getElementById("importDataInput");

/* ===========================================================
   Subject selector
   =========================================================== */
function applySubjectUI() {
  subjectChips.forEach((chip) => {
    const active = chip.dataset.subject === appState.subject;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-checked", String(active));
  });
}

subjectChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    setSubject(chip.dataset.subject);
    applySubjectUI();
  });
});

applySubjectUI();

/* ===========================================================
   Theme + device preview + quick toggle
   =========================================================== */
function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

function updateSidebarThemeLabel(resolved) {
  sidebarThemeLabel.textContent = resolved === "light" ? "Light mode" : "Dark mode";
}

function refreshThemeUI() {
  const stored = getStoredTheme();
  const resolved = applyTheme(stored);
  syncSegmented(themeSettingGroup, stored);
  updateSidebarThemeLabel(resolved);
}

themeSettingGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const resolved = setTheme(btn.dataset.value);
    syncSegmented(themeSettingGroup, btn.dataset.value);
    updateSidebarThemeLabel(resolved);
  });
});

function quickToggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  setTheme(next);
  syncSegmented(themeSettingGroup, next);
  updateSidebarThemeLabel(next);
}

quickThemeToggle.addEventListener("click", quickToggleTheme);
sidebarThemeToggle.addEventListener("click", quickToggleTheme);

initThemeSync((resolved) => {
  syncSegmented(themeSettingGroup, "system");
  updateSidebarThemeLabel(resolved);
});

refreshThemeUI();

function refreshDeviceUI() {
  const stored = getStoredDevice();
  applyDevice(stored);
  syncSegmented(deviceSettingGroup, stored);
}

deviceSettingGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setDevice(btn.dataset.value);
    syncSegmented(deviceSettingGroup, btn.dataset.value);
  });
});

refreshDeviceUI();

/* ===========================================================
   Chat-related settings (Enter mode, auto-scroll, save conversations)
   =========================================================== */
let enterMode = safeGet("h1-enter-mode", "enter");
syncSegmented(enterToSendGroup, enterMode);
setEnterMode(enterMode);

enterToSendGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    enterMode = btn.dataset.value;
    safeSet("h1-enter-mode", enterMode);
    syncSegmented(enterToSendGroup, enterMode);
    setEnterMode(enterMode);
  });
});

function wireToggle(el, key, defaultOn, onChange) {
  function apply(on) {
    el.classList.toggle("on", on);
    el.setAttribute("aria-checked", String(on));
  }
  let on = safeGet(key, defaultOn ? "1" : "0") !== "0";
  apply(on);
  function toggle() {
    on = !on;
    safeSet(key, on ? "1" : "0");
    apply(on);
    if (onChange) onChange(on);
  }
  el.addEventListener("click", toggle);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
}

wireToggle(autoScrollToggle, "h1-auto-scroll", true);
wireToggle(saveConversationsToggle, "h1-save-conversations", true);
wireToggle(reduceMotionToggle, "h1-reduce-motion", false, (on) => setReduceMotion(on));
wireToggle(gamificationToggle, "h1-gamification-enabled", true, (on) => {
  setGamificationEnabled(on);
  renderHomeWidget();
});
setReduceMotion(getStoredReduceMotion());
setGamificationEnabled(gamificationEnabled());

/* ===========================================================
   Health status → sidebar dot, settings pill, banner
   =========================================================== */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

let dismissedBannerMessage = null;

function showBanner(text) {
  if (dismissedBannerMessage === text) return;
  configBannerText.textContent = text;
  configBanner.hidden = false;
}

function hideBanner() {
  configBanner.hidden = true;
  dismissedBannerMessage = null;
}

configBannerClose.addEventListener("click", () => {
  dismissedBannerMessage = configBannerText.textContent;
  configBanner.hidden = true;
});

onHealthChange((status) => {
  if (!status.reachable) {
    sidebarStatusDot.className = "status-dot status-dot-bad";
    sidebarStatusText.textContent = "Server unreachable";
    settingsProviderName.textContent = "—";
    settingsStatusPill.textContent = "Unreachable";
    settingsStatusPill.className = "status-pill status-pill-bad";
    showBanner("Couldn't reach the H1 server. Check your connection — answers won't work until it's back.");
    return;
  }

  const ai = status.ai || {};
  if (ai.configured) {
    sidebarStatusDot.className = "status-dot status-dot-ok";
    sidebarStatusText.textContent = `${capitalize(ai.provider)} connected`;
    settingsProviderName.textContent = capitalize(ai.provider);
    settingsStatusPill.textContent = "Connected";
    settingsStatusPill.className = "status-pill status-pill-ok";
    hideBanner();
  } else {
    sidebarStatusDot.className = "status-dot status-dot-bad";
    sidebarStatusText.textContent = "AI not configured";
    settingsProviderName.textContent = ai.provider ? capitalize(ai.provider) : "None";
    settingsStatusPill.textContent = "Not configured";
    settingsStatusPill.className = "status-pill status-pill-bad";
    showBanner(
      "The AI backend isn't configured yet. You can still browse the app, but answers won't be available until an API key is set on the server."
    );
  }
});

startHealthPolling();

/* ===========================================================
   Home: hero greeting, ask bar, quick actions
   =========================================================== */
function updateGreeting() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  heroGreeting.textContent = `Good ${part} 👋`;
}
updateGreeting();

heroAskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = heroAskInput.value.trim();
  if (!text) return;
  heroAskInput.value = "";
  openChatWithMessage(text);
});

const QUICK_ACTION_PREFILL = {
  explain: "Explain this: ",
  solve: "Solve this: ",
  examples: "Give me examples of ",
  simple: "Explain simply: ",
  revise: "Help me revise ",
};

quickActions.addEventListener("click", (e) => {
  const btn = e.target.closest(".quick-action");
  if (!btn) return;
  const action = btn.dataset.quick;
  if (action === "summarize") return switchView("summarize");
  if (action === "quiz") return switchView("quiz");
  if (action === "flashcards") return switchView("flashcards");
  const prefill = QUICK_ACTION_PREFILL[action];
  if (prefill) prefillChat(prefill);
});

/* ===========================================================
   Settings → Data (export / import + destructive actions, all confirmed)
   =========================================================== */
exportDataBtn.addEventListener("click", () => {
  exportData();
  showToast("Export downloaded.", "success");
});

importDataBtn.addEventListener("click", () => importDataInput.click());
importDataInput.addEventListener("change", async () => {
  const file = importDataInput.files[0];
  importDataInput.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const result = importData(text);
    if (!result.ok) {
      showToast(result.error, "error", 4500);
      return;
    }
    showToast(`Imported ${result.importedKeys.length} data set(s). Reloading…`, "success");
    setTimeout(() => window.location.reload(), 800);
  } catch {
    showToast("Couldn't read that file.", "error");
  }
});

document.getElementById("clearConversationsBtn").addEventListener("click", () => {
  confirmDanger("Clear all conversations?", "This deletes every saved Ask H1 conversation on this device.", "Clear all", () => {
    clearAllConversations();
    clearAllConversationsData();
    showToast("All conversations cleared.", "success");
  });
});

document.getElementById("clearNotesBtn").addEventListener("click", () => {
  confirmDanger("Clear all notes?", "This deletes every saved note on this device.", "Clear all", () => {
    clearAllNotesData();
    showToast("All notes cleared.", "success");
  });
});

const SETTINGS_KEYS = [
  "h1-theme",
  "h1-device-preview",
  "h1-subject",
  "h1-enter-mode",
  "h1-auto-scroll",
  "h1-save-conversations",
  "h1-reduce-motion",
  "h1-ai-mode",
  "h1-gamification-enabled",
];

document.getElementById("resetSettingsBtn").addEventListener("click", () => {
  confirmDanger("Reset settings?", "Theme, subject and preferences will go back to their defaults.", "Reset", () => {
    SETTINGS_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignored
      }
    });
    showToast("Settings reset. Reloading…", "success");
    setTimeout(() => window.location.reload(), 600);
  });
});

document.getElementById("resetEverythingBtn").addEventListener("click", () => {
  confirmDanger("Reset everything?", "This clears all H1 data stored on this device, including conversations and notes.", "Reset everything", () => {
    try {
      localStorage.clear();
    } catch {
      // ignored
    }
    showToast("Everything reset. Reloading…", "success");
    setTimeout(() => window.location.reload(), 600);
  });
});

/* ===========================================================
   Initialize feature modules + first view
   =========================================================== */
initChat();
initExplain();
initQuiz();
initFlashcards();
initNotes();
initStudyMode();
initMoreTools();
initCommandPalette();
initExamMode();
initProgressPage();
initHomeWidgets();

bindMoreTools({ summarizeText, generatePracticeFromSource });

onViewChange((view) => {
  if (view === "home") renderHomeWidget();
  if (view === "progress") renderProgressPage();
});

switchView("home");
