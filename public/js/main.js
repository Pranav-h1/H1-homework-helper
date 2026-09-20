import "./nav.js";
import { switchView, onViewChange, getCurrentView } from "./nav.js";
import { appState, setSubject, AI_LANGUAGES, setLanguage } from "./state.js";
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
  getStoredAccent,
  setAccent,
  applyAccent,
} from "./theme.js";
import { showToast } from "./toast.js";
import { onHealthChange, startHealthPolling } from "./health.js";
import { confirmDanger } from "./modal.js";
import { safeGet, safeSet, safeRemove } from "./storage.js";
import { exportData, importData, clearAllH1Data } from "./dataTransfer.js";
import { isEnabled as gamificationEnabled, setEnabled as setGamificationEnabled, checkAndNotifyAchievements } from "./gamification.js";
import { clearAllConversations } from "./conversations.js";
import { initChat, openChatWithMessage, prefillChat, setEnterMode, clearAllConversationsData } from "./chat.js";
import { openFilePicker } from "./chatAttachments.js";
import { initExplain } from "./explain.js";
import { initQuiz } from "./quiz.js";
import { initExamSimulator } from "./examSimulator.js";
import { initQuotes } from "./quotes.js";
import { initFlashcards, refreshFlashcards } from "./flashcards.js";
import { initNotes, clearAllNotesData, bindMoreTools, refreshNotes } from "./notes.js";
import { initStudyMode } from "./studyMode.js";
import { initMoreTools, summarizeText, generatePracticeFromSource } from "./moreTools.js";
import { initCommandPalette, openPalette } from "./commandPalette.js";
import { initProgressPage, renderProgressPage } from "./progressPage.js";
import { initBrain, renderBrain } from "./brain.js";
import { initBoss, renderBoss } from "./boss.js";
import { initCodeLab, renderCodeLab } from "./codeLab.js";
import { initWebBuilder, renderWebBuilder, flushBuilder } from "./webBuilder.js";
import { initChallenges, renderChallenges } from "./challengesView.js";
import { nameUnlabelledSwitches } from "./a11y.js";
import { watchMath } from "./mathRender.js";
import { initChatLayout } from "./chatLayout.js";
import { initHomeWidgets, renderHomeWidget, renderUpcomingWidget } from "./homeWidgets.js";
import { initHomework, refreshHomework } from "./homework.js";
import { initScan } from "./scan.js";
import { initSubjects, refreshSubjects } from "./subjects.js";
import { initDocuments, refreshDocuments } from "./documents.js";
import { initPlanner, refreshPlanner } from "./planner.js";
import { initCalendar, refreshCalendar } from "./calendarView.js";
import { initAchievements, renderAchievements } from "./achievements.js";
import { initToolsHub } from "./toolsHub.js";
import { initSubtabs, selectSubtabInView } from "./subtabs.js";
import { initNotifications, setEnabled as setRemindersEnabled } from "./notifications.js";
import { initDock } from "./dock.js";
import { initMagnetic } from "./magnetic.js";
import { initProfile, renderProfile } from "./profile.js";
import { initQuickCapture } from "./quickCapture.js";
import { initSpacesUI, onSpaceUIRefresh } from "./spacesUI.js";
import { initProjects, refreshProjects } from "./projects.js";
import { initFavorites, render as renderFavorites } from "./favorites.js";
import { initShortcuts } from "./shortcuts.js";
import { initNotifCenter, refreshNotifCenter } from "./notifCenter.js";
import { clearEvents } from "./progress.js";
import { initAccountMenu } from "./accountMenu.js";
import { initCreatorPanel } from "./creatorPanel.js";
import { initSettingsNav } from "./settingsNav.js";
import { TEXT_SIZES, DENSITIES, getTextSize, setTextSize, getDensity, setDensity, initInterfacePrefs } from "./interfacePrefs.js";
import { getReadingWidth, setReadingWidth, onReadingWidthChange } from "./chatLayout.js";
import { initDockInset } from "./dockInset.js";
import { DEFAULT_OPACITY, getStoredOpacity, setOpacity, initOpacity } from "./opacity.js";
import { REGIONS, getStoredRegion, setRegion, initClock, render as renderClock, describeZone, formatTime, resolveZone } from "./clock.js";
import { isAccountMode, currentUser } from "./session.js";
import { onRemoteChange } from "./cloudSync.js";
import { offerGuestDataImport, guestDataSummary, importGuestDataFromSettings } from "./guestMigration.js";

/* ---------------------------------------------------------
   DOM references
   --------------------------------------------------------- */
const subjectChips = document.querySelectorAll(".chip[data-subject]");
const configBanner = document.getElementById("configBanner");
const configBannerText = document.getElementById("configBannerText");
const configBannerClose = document.getElementById("configBannerClose");
const sidebarStatusDot = document.getElementById("sidebarStatusDot");
const sidebarStatusText = document.getElementById("sidebarStatusText");
const topbarStatusDot = document.getElementById("topbarStatusDot");
const topbarStatusText = document.getElementById("topbarStatusText");
const settingsStatusPill = document.getElementById("settingsStatusPill");
const topbarSearchBtn = document.getElementById("topbarSearchBtn");
const topbarSettingsBtn = document.getElementById("topbarSettingsBtn");

const quickThemeToggle = document.getElementById("quickThemeToggle");
const sidebarThemeToggle = document.getElementById("sidebarThemeToggle");
const sidebarThemeLabel = document.getElementById("sidebarThemeLabel");

const themeSettingGroup = document.getElementById("themeSetting");
const deviceSettingGroup = document.getElementById("deviceSetting");
const enterToSendGroup = document.getElementById("enterToSendSetting");
const autoScrollToggle = document.getElementById("autoScrollToggle");
const saveConversationsToggle = document.getElementById("saveConversationsToggle");
const aiKnowsMeToggle = document.getElementById("aiKnowsMeToggle");
const reduceMotionToggle = document.getElementById("reduceMotionToggle");
const gamificationToggle = document.getElementById("gamificationToggle");
const aiLanguageGroup = document.getElementById("aiLanguageSetting");
const deadlineRemindersToggle = document.getElementById("deadlineRemindersToggle");
const achievementNotificationsToggle = document.getElementById("achievementNotificationsToggle");

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
   Interface: text size, response width, sidebar
   =========================================================== */
const textSizeGroup = document.getElementById("textSizeSetting");
const densityGroup = document.getElementById("densitySetting");
const responseWidthGroup = document.getElementById("responseWidthSetting");
const sidebarSettingGroup = document.getElementById("sidebarSetting");

textSizeGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    syncSegmented(textSizeGroup, setTextSize(btn.dataset.value));
  });
});

densityGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    syncSegmented(densityGroup, setDensity(btn.dataset.value));
  });
});

responseWidthGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    syncSegmented(responseWidthGroup, setReadingWidth(btn.dataset.value));
  });
});

// The tutor has the same control in its toolbar; whichever is used, both follow.
onReadingWidthChange((value) => syncSegmented(responseWidthGroup, value));

sidebarSettingGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const collapsed = btn.dataset.value === "collapsed";
    if (document.getElementById("app").classList.contains("sidebar-collapsed") !== collapsed) {
      document.getElementById("sidebarCollapseToggle").click();
    }
    syncSegmented(sidebarSettingGroup, btn.dataset.value);
  });
});

function syncInterfaceUI() {
  syncSegmented(textSizeGroup, getTextSize());
  syncSegmented(densityGroup, getDensity());
  syncSegmented(responseWidthGroup, getReadingWidth());
  syncSegmented(sidebarSettingGroup, document.getElementById("app").classList.contains("sidebar-collapsed") ? "collapsed" : "expanded");
}

initInterfacePrefs();
syncInterfaceUI();
// The sidebar can also be collapsed from the title bar, so Settings re-reads it when opened.
document.addEventListener("h1:view-changed", (event) => {
  if (event.detail === "settings") syncInterfaceUI();
});

/* ===========================================================
   Interface opacity
   =========================================================== */
const opacitySlider = document.getElementById("opacitySetting");
const opacityValue = document.getElementById("opacityValue");
const opacityHint = document.getElementById("opacityHint");
const opacityResetBtn = document.getElementById("opacityReset");

function describeOpacity(pct) {
  if (pct >= 100) return "Solid surfaces.";
  if (pct >= 60) return "A little of what is behind each surface shows through.";
  if (pct >= 25) return "Clearly translucent. Text and controls stay solid.";
  return "As sheer as this interface style allows while staying readable.";
}

function syncOpacityUI(pct) {
  opacitySlider.value = String(pct);
  opacityValue.textContent = pct + "%";
  opacityHint.textContent = describeOpacity(pct);
  opacityResetBtn.disabled = pct === DEFAULT_OPACITY;
}

// `input` rather than `change`, so the interface follows the thumb as it is dragged.
opacitySlider.addEventListener("input", () => {
  syncOpacityUI(setOpacity(opacitySlider.value));
});

opacityResetBtn.addEventListener("click", () => {
  syncOpacityUI(setOpacity(DEFAULT_OPACITY));
  opacitySlider.focus();
});

syncOpacityUI(initOpacity());


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

window.addEventListener("h1:theme-changed", (e) => {
  const { pref, resolved } = e.detail || {};
  syncSegmented(themeSettingGroup, pref);
  updateSidebarThemeLabel(resolved);
});

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
   Time and region: the title-bar clock
   =========================================================== */
const regionSelect = document.getElementById("regionSetting");
const regionPreview = document.getElementById("regionPreview");

REGIONS.forEach((region) => {
  const option = document.createElement("option");
  option.value = region.value;
  option.textContent = region.zone ? `${region.label} — ${region.zone}` : region.label;
  regionSelect.appendChild(option);
});

// The preview is written from the same clock the title bar uses, so what Settings promises and
// what the window shows can never disagree.
function syncRegionUI(value) {
  regionSelect.value = value;
  regionPreview.textContent = `${formatTime()} · ${describeZone()}${value === "auto" ? " (this device)" : ""}`;
}

regionSelect.addEventListener("change", () => {
  syncRegionUI(setRegion(regionSelect.value));
});

initClock();
syncRegionUI(getStoredRegion());
// Keep the preview honest while Settings is open, and after a change from another device.
setInterval(() => {
  if (getCurrentView() === "settings") syncRegionUI(getStoredRegion());
}, 15000);

/* ===========================================================
   Accent color
   =========================================================== */
const accentSettingGroup = document.getElementById("accentSetting");

function syncAccentSwatches(value) {
  accentSettingGroup.querySelectorAll(".accent-swatch").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

accentSettingGroup.querySelectorAll(".accent-swatch").forEach((btn) => {
  btn.addEventListener("click", () => {
    setAccent(btn.dataset.value);
    syncAccentSwatches(btn.dataset.value);
  });
});

applyAccent(getStoredAccent());
syncAccentSwatches(getStoredAccent());

/* ===========================================================
   AI response language
   =========================================================== */
AI_LANGUAGES.forEach((lang) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "segmented-btn";
  btn.dataset.value = lang.value;
  btn.setAttribute("role", "radio");
  btn.textContent = lang.label;
  aiLanguageGroup.appendChild(btn);
});
syncSegmented(aiLanguageGroup, appState.language);
aiLanguageGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLanguage(btn.dataset.value);
    syncSegmented(aiLanguageGroup, btn.dataset.value);
  });
});

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
wireToggle(aiKnowsMeToggle, "h1-ai-knows-me", true);
wireToggle(reduceMotionToggle, "h1-reduce-motion", false, (on) => setReduceMotion(on));
wireToggle(gamificationToggle, "h1-gamification-enabled", true, (on) => {
  setGamificationEnabled(on);
  renderHomeWidget();
});
wireToggle(achievementNotificationsToggle, "h1-achievement-notifications", true);
wireToggle(deadlineRemindersToggle, "h1-deadline-reminders", false, (on) => setRemindersEnabled(on));
setReduceMotion(getStoredReduceMotion());
setGamificationEnabled(gamificationEnabled());

/* ===========================================================
   Health status → sidebar dot, topbar pill, settings pill, banner
   Never names the underlying AI provider — see H1's no-branding rule.
   =========================================================== */
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

function setStatus(dotClass, text, pillClass, pillText) {
  sidebarStatusDot.className = `status-dot ${dotClass}`;
  sidebarStatusText.textContent = text;
  if (topbarStatusDot) topbarStatusDot.className = `status-dot ${dotClass}`;
  if (topbarStatusText) topbarStatusText.textContent = text;
  settingsStatusPill.textContent = pillText;
  settingsStatusPill.className = `status-pill ${pillClass}`;
}

onHealthChange((status) => {
  if (!status.reachable) {
    setStatus("status-dot-bad", "Server unreachable", "status-pill-bad", "Unreachable");
    showBanner("Couldn't reach the H1 server. Check your connection — answers won't work until it's back.");
    return;
  }

  const ai = status.ai || {};
  if (ai.configured) {
    setStatus("status-dot-ok", "AI Connected", "status-pill-ok", "Connected");
    hideBanner();
  } else {
    setStatus("status-dot-bad", "AI Offline", "status-pill-bad", "Not configured");
    showBanner(
      "The AI backend isn't configured yet. You can still browse H1, but AI answers won't be available until an API key is set on the server."
    );
  }
});

setStatus("status-dot-pending", "Connecting…", "status-pill-pending", "Checking…");
startHealthPolling();

/* ===========================================================
   Desktop topbar actions
   =========================================================== */
const topbarProfileBtn = document.getElementById("topbarProfileBtn");
if (topbarSearchBtn) topbarSearchBtn.addEventListener("click", openPalette);
if (topbarSettingsBtn) topbarSettingsBtn.addEventListener("click", () => switchView("settings"));
if (topbarProfileBtn) topbarProfileBtn.addEventListener("click", () => switchView("profile"));

/* ===========================================================
   Achievement-unlock notifications
   =========================================================== */
window.addEventListener("h1:activity-logged", () => {
  if (safeGet("h1-achievement-notifications", "1") !== "0") {
    checkAndNotifyAchievements();
  }
});

/* ===========================================================
   Home: hero greeting, ask bar, quick actions
   =========================================================== */
// Greets the person by name when H1 knows one — the display name they chose, or their account's
// username — and plainly otherwise.
function greetingName() {
  const chosen = (safeGet("h1-display-name", "") || "").trim();
  if (chosen && chosen !== "Student") return chosen;
  const user = currentUser();
  return user && user.username && user.accountType !== "lab" ? user.username : user && user.accountType === "lab" ? "Creator" : "";
}

function updateGreeting() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const name = greetingName();
  heroGreeting.textContent = name ? `Good ${part}, ${name} 👋` : `Good ${part} 👋`;
}
updateGreeting();
document.addEventListener("h1:view-changed", (event) => {
  if (event.detail === "home") updateGreeting();
});

heroAskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = heroAskInput.value.trim();
  if (!text) return;
  heroAskInput.value = "";
  openChatWithMessage(text);
});

const QUICK_ACTION_PREFILL = {
  solve: "Solve this: ",
  examples: "Give me examples of ",
  simple: "Explain simply: ",
  revise: "Help me revise ",
};

quickActions.addEventListener("click", (e) => {
  const btn = e.target.closest(".suggestion-chip");
  if (!btn) return;
  const action = btn.dataset.quick;
  if (action === "explain") {
    switchView("homework");
    selectSubtabInView("homework", "explain");
    return;
  }
  if (action === "summarize") {
    switchView("tools");
    selectSubtabInView("tools", "writing");
    return;
  }
  if (action === "plan") return switchView("planner");
  if (action === "quiz") return switchView("quiz");
  if (action === "flashcards") return switchView("flashcards");
  const prefill = QUICK_ACTION_PREFILL[action];
  if (prefill) prefillChat(prefill);
});

/* ===========================================================
   Home superbar — attach / scan / command shortcuts
   =========================================================== */
const superbarAttachBtn = document.getElementById("superbarAttachBtn");
const superbarScanBtn = document.getElementById("superbarScanBtn");
const superbarCommandBtn = document.getElementById("superbarCommandBtn");

if (superbarAttachBtn) {
  superbarAttachBtn.addEventListener("click", () => {
    switchView("chat");
    // Same gesture, so the browser still allows the file picker to open.
    openFilePicker();
  });
}
if (superbarScanBtn) superbarScanBtn.addEventListener("click", () => switchView("scan"));
if (superbarCommandBtn) superbarCommandBtn.addEventListener("click", openPalette);

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

// Where deleting something actually deletes it from — said plainly, because for someone signed in
// it's every device, not just this one.
function whereItLives() {
  return isAccountMode() ? "in your account, on every device you use" : "on this device";
}

document.getElementById("clearConversationsBtn").addEventListener("click", () => {
  confirmDanger("Clear all conversations?", `This deletes every saved AI Tutor conversation ${whereItLives()}.`, "Clear all", () => {
    clearAllConversations();
    clearAllConversationsData();
    showToast("All conversations cleared.", "success");
  });
});

document.getElementById("clearNotesBtn").addEventListener("click", () => {
  confirmDanger("Clear all notes?", `This deletes every saved note ${whereItLives()}.`, "Clear all", () => {
    clearAllNotesData();
    showToast("All notes cleared.", "success");
  });
});

document.getElementById("resetProgressBtn").addEventListener("click", () => {
  confirmDanger("Reset progress?", "This clears your XP, streaks and achievement history.", "Reset", () => {
    clearEvents();
    safeRemove("h1-achievements-seen");
    showToast("Progress reset. Reloading…", "success");
    setTimeout(() => window.location.reload(), 600);
  });
});

const SETTINGS_KEYS = [
  "h1-theme",
  "h1-device-preview",
  "h1-subject",
  "h1-enter-mode",
  "h1-auto-scroll",
  "h1-save-conversations",
  "h1-ai-knows-me",
  "h1-reduce-motion",
  "h1-ai-mode",
  "h1-ai-language",
  "h1-gamification-enabled",
  "h1-achievement-notifications",
  "h1-deadline-reminders",
  "h1-sidebar-collapsed",
];

document.getElementById("resetSettingsBtn").addEventListener("click", () => {
  confirmDanger("Reset settings?", "Theme, subject and preferences will go back to their defaults.", "Reset", () => {
    SETTINGS_KEYS.forEach((k) => safeRemove(k));
    showToast("Settings reset. Reloading…", "success");
    setTimeout(() => window.location.reload(), 600);
  });
});

document.getElementById("resetEverythingBtn").addEventListener("click", () => {
  const signedIn = isAccountMode();
  const where = signedIn
    ? "This clears all H1 data in your account — conversations, notes and everything else — on every device you use."
    : "This clears all H1 data stored on this device, including conversations and notes.";
  confirmDanger("Reset everything?", where, "Reset everything", async () => {
    showToast("Clearing your H1 data…");
    await clearAllH1Data();
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
initExamSimulator();
initQuotes();
initFlashcards();
initNotes();
initStudyMode();
initMoreTools();
initCommandPalette();
initProgressPage();
initBrain();
initBoss();
initCodeLab();
initWebBuilder();
initChallenges();
initHomeWidgets();
initHomework();
initScan();
initSubjects();
initDocuments();
initPlanner();
initCalendar();
initAchievements();
initToolsHub();
initSubtabs();
nameUnlabelledSwitches();
watchMath();
initChatLayout();
initNotifications();
initDock();
initProfile();
initQuickCapture();
initSpacesUI();
initProjects();
initFavorites();
initShortcuts();
initNotifCenter();

// Switching Spaces re-filters every space-aware list view at once, so the switch feels
// instantaneous no matter which view the user is currently on.
onSpaceUIRefresh(() => {
  refreshHomework();
  refreshNotes();
  refreshDocuments();
  refreshFlashcards();
  refreshPlanner();
  refreshProjects();
  renderHomeWidget();
  renderUpcomingWidget();
  renderProfile();
});
initMagnetic(".bento-tile", 5);

bindMoreTools({ summarizeText, generatePracticeFromSource });

function renderView(view) {
  if (view === "home") {
    renderHomeWidget();
    renderUpcomingWidget();
  }
  if (view === "progress") renderProgressPage();
  if (view === "brain") renderBrain();
  if (view === "boss") renderBoss();
  if (view === "code") {
    renderCodeLab();
    renderChallenges();
    renderWebBuilder();
  } else {
    // Leaving the builder shouldn't lose a change typed a moment ago.
    flushBuilder();
  }
  if (view === "homework") refreshHomework();
  if (view === "planner") refreshPlanner();
  if (view === "calendar") refreshCalendar();
  if (view === "subjects") refreshSubjects();
  if (view === "achievements") renderAchievements();
  if (view === "profile") renderProfile();
  if (view === "projects") refreshProjects();
  if (view === "favorites") renderFavorites();
  refreshNotifCenter();
}

onViewChange(renderView);

// Work that arrived from another device: redraw what's on screen so it shows up without a
// reload, and say so once rather than silently changing what someone is looking at.
onRemoteChange((keys) => {
  syncOpacityUI(initOpacity());
  initInterfacePrefs();
  syncInterfaceUI();
  syncRegionUI(getStoredRegion());
  renderClock();
  renderView(getCurrentView());
  refreshNotes();
  refreshFlashcards();
  showToast(keys.length === 1 ? "Updated with a change from your other device." : "Updated with changes from your other device.");
});

initAccountMenu();
initCreatorPanel();
initSettingsNav();
initDockInset();

// Empty states carry the one action that fills them. The button just presses the page's own
// primary control, so there's a single code path for "add a task", "new note" and so on.
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-empty-action]");
  if (!trigger) return;
  const target = document.getElementById(trigger.dataset.emptyAction);
  if (target) target.click();
});

// Settings → Data: bringing on-device (guest) work into the account stays available even if
// the offer at sign-in was declined.
(() => {
  const row = document.getElementById("guestImportRow");
  const btn = document.getElementById("guestImportBtn");
  const sub = document.getElementById("guestImportSub");
  if (!row || !btn) return;
  const refresh = () => {
    const summary = isAccountMode() ? guestDataSummary() : null;
    row.hidden = !summary;
    if (summary && sub) sub.textContent = summary.parts.length ? `${summary.parts.slice(0, 3).join(", ")} saved on this device before you signed in.` : "Work saved on this device before you signed in.";
  };
  btn.addEventListener("click", importGuestDataFromSettings);
  document.addEventListener("h1:view-changed", (event) => {
    if (event.detail === "settings") refresh();
  });
  refresh();
})();

switchView("home");

// Signing in on a device that already has work saved as a guest: H1 asks, once, and never
// uploads anything without being told to.
if (isAccountMode()) offerGuestDataImport();
