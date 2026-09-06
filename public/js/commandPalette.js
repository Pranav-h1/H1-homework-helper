import { switchView, onViewChange } from "./nav.js";
import { setTheme } from "./theme.js";
import { loadConversations, setActiveConversationId } from "./conversations.js";
import { safeGetJson } from "./storage.js";
import { selectSubtabInView } from "./subtabs.js";
import { getTasks } from "./homeworkStore.js";
import { getDocuments } from "./documentsStore.js";
import { getDecks } from "./flashcardDecks.js";
import { getSpaces } from "./spacesStore.js";
import { switchToSpace } from "./spacesUI.js";

const overlay = document.getElementById("commandOverlay");
const input = document.getElementById("commandInput");
const list = document.getElementById("commandList");
const hintBtn = document.getElementById("commandHint");

function openWithSubtab(view, subtab) {
  return () => {
    switchView(view);
    selectSubtabInView(view, subtab);
  };
}

const VIEW_LABELS = {
  home: "Home",
  chat: "AI Tutor",
  homework: "Homework",
  scan: "Scan",
  subjects: "Subjects",
  notes: "Notes",
  documents: "Documents",
  flashcards: "Flashcards",
  quiz: "Quiz Lab",
  planner: "Study Planner",
  projects: "Projects",
  calendar: "Calendar",
  "study-mode": "Focus",
  progress: "Progress",
  achievements: "Achievements",
  tools: "Tools",
  settings: "Settings",
  profile: "Profile",
  favorites: "Favorites",
};

const VIEW_ICONS = {
  home: "🏠", chat: "💬", homework: "📘", scan: "📸", subjects: "🧭", notes: "📝",
  documents: "📁", flashcards: "🗂️", quiz: "✅", planner: "🗓️", calendar: "📅",
  "study-mode": "⏱️", progress: "📈", achievements: "🏆", tools: "🧰", settings: "⚙️", profile: "👤", projects: "🧩", favorites: "⭐",
};

const NAV_COMMANDS = Object.keys(VIEW_LABELS).map((view) => ({
  title: `Open ${VIEW_LABELS[view]}`,
  icon: VIEW_ICONS[view],
  group: "Navigation",
  run: () => switchView(view),
}));

const AI_COMMANDS = [
  { title: "Ask H1", icon: "💬", group: "AI", run: () => switchView("chat") },
  { title: "Scan homework", icon: "📸", group: "AI", run: () => switchView("scan") },
  { title: "Make a quiz", icon: "✅", group: "AI", run: () => switchView("quiz") },
  { title: "Make flashcards", icon: "🗂️", group: "AI", run: () => switchView("flashcards") },
  {
    title: "Create a study plan",
    icon: "🗓️",
    group: "AI",
    run: () => {
      switchView("planner");
      document.getElementById("plannerStudyPlanToggleBtn")?.click();
    },
  },
  {
    title: "Create an exam prep plan",
    icon: "📆",
    group: "AI",
    run: () => {
      switchView("planner");
      document.getElementById("plannerExamPlanToggleBtn")?.click();
    },
  },
  { title: "Summarize text", icon: "📄", group: "AI", run: openWithSubtab("tools", "writing") },
  { title: "Practice questions", icon: "✍️", group: "AI", run: openWithSubtab("tools", "writing") },
  { title: "Vocabulary & language", icon: "🔤", group: "AI", run: openWithSubtab("tools", "writing") },
  { title: "Explain a question step by step", icon: "🧠", group: "AI", run: openWithSubtab("homework", "explain") },
];

const ACTION_COMMANDS = [
  { title: "Start focus session", icon: "⏱️", group: "Actions", run: () => switchView("study-mode") },
  { title: "Open today's tasks", icon: "📘", group: "Actions", run: () => switchView("homework") },
  {
    title: "Search my notes",
    icon: "📝",
    group: "Actions",
    run: () => {
      switchView("notes");
      setTimeout(() => document.getElementById("notesSearch")?.focus(), 60);
    },
  },
  {
    title: "Toggle dark / light theme",
    icon: "🌓",
    group: "Actions",
    run: () => {
      const current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "light" ? "dark" : "light");
    },
  },
  { title: "Open Settings", icon: "⚙️", group: "Actions", run: () => switchView("settings") },
];

const STATIC_COMMANDS = [...AI_COMMANDS, ...ACTION_COMMANDS, ...NAV_COMMANDS];

// Recently visited sections — surfaced first when the palette opens with no query.
const RECENT_KEY = "h1-command-recent-views";
const MAX_RECENT = 4;
onViewChange((view) => {
  if (!VIEW_LABELS[view]) return;
  const recent = safeGetJson(RECENT_KEY, []).filter((v) => v !== view);
  recent.unshift(view);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignored — recent list is a convenience, not critical data
  }
});

function recentCommands() {
  return safeGetJson(RECENT_KEY, [])
    .filter((v) => VIEW_LABELS[v])
    .map((v) => ({ title: VIEW_LABELS[v], icon: VIEW_ICONS[v], group: "Recent", run: () => switchView(v) }));
}

let activeIndex = 0;
let items = [];

// Substring match scores highest (earlier position wins); otherwise falls back to a loose
// in-order subsequence match, so "sbs" still finds "Step-by-Step".
function fuzzyScore(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    ti = t.indexOf(q[qi], ti);
    if (ti === -1) return -1;
    ti++;
  }
  return 5;
}

function matches(text, query) {
  return fuzzyScore(text, query) > -1;
}

function buildItems(query) {
  if (!query) {
    const recents = recentCommands();
    return [...recents, ...STATIC_COMMANDS.slice(0, 10 - recents.length)];
  }

  const commandMatches = STATIC_COMMANDS.map((c) => ({ ...c, score: fuzzyScore(c.title, query) }))
    .filter((c) => c.score > -1)
    .sort((a, b) => b.score - a.score);

  const convoMatches = loadConversations()
    .filter((c) => matches(c.title, query))
    .slice(0, 5)
    .map((c) => ({
      title: c.title,
      icon: "🗨️",
      group: "Search",
      subtitle: "Conversation",
      run: () => {
        setActiveConversationId(c.id);
        switchView("chat");
        window.dispatchEvent(new CustomEvent("h1:conversation-selected"));
      },
    }));

  const noteMatches = safeGetJson("h1-notes", [])
    .filter((n) => matches(n.title || "", query) || matches(n.body || "", query))
    .slice(0, 5)
    .map((n) => ({
      title: n.title || "Untitled note",
      icon: "📝",
      group: "Search",
      subtitle: "Note",
      run: () => {
        switchView("notes");
        window.dispatchEvent(new CustomEvent("h1:note-selected", { detail: { id: n.id } }));
      },
    }));

  const quizMatches = safeGetJson("h1-recent-quizzes", [])
    .filter((q) => matches(q.topic || "", query))
    .slice(0, 5)
    .map((q) => ({ title: `${q.topic} (${q.score}/${q.total})`, icon: "✅", group: "Search", subtitle: "Recent quiz", run: () => switchView("quiz") }));

  const homeworkMatches = getTasks()
    .filter((t) => matches(t.title, query))
    .slice(0, 5)
    .map((t) => ({ title: t.title, icon: "📘", group: "Search", subtitle: "Homework", run: () => switchView("homework") }));

  const documentMatches = getDocuments()
    .filter((d) => matches(d.name, query))
    .slice(0, 5)
    .map((d) => ({ title: d.name, icon: "📁", group: "Search", subtitle: "Document", run: () => switchView("documents") }));

  const deckMatches = getDecks()
    .filter((d) => matches(d.topic, query))
    .slice(0, 5)
    .map((d) => ({ title: d.topic, icon: "🗂️", group: "Search", subtitle: "Flashcard deck", run: () => switchView("flashcards") }));

  const spaceMatches = getSpaces()
    .filter((s) => matches(s.name, query))
    .slice(0, 5)
    .map((s) => ({ title: `Open ${s.name} Space`, icon: s.icon, group: "Navigation", run: () => switchToSpace(s.id) }));

  return [...commandMatches, ...spaceMatches, ...convoMatches, ...noteMatches, ...quizMatches, ...homeworkMatches, ...documentMatches, ...deckMatches];
}

function render() {
  list.innerHTML = "";
  if (items.length === 0) {
    list.innerHTML = '<div class="command-empty">No matching actions.</div>';
    return;
  }
  let lastGroup = null;
  items.forEach((item, i) => {
    if (item.group && item.group !== lastGroup) {
      lastGroup = item.group;
      const heading = document.createElement("div");
      heading.className = "command-group-heading";
      heading.textContent = item.group.toUpperCase();
      list.appendChild(heading);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "command-item";
    btn.dataset.active = String(i === activeIndex);
    btn.innerHTML = `<span class="command-item-icon"></span><span></span>`;
    btn.querySelector(".command-item-icon").textContent = item.icon;
    btn.querySelector("span:last-child").textContent = item.subtitle ? `${item.title} · ${item.subtitle}` : item.title;
    btn.addEventListener("click", () => runItem(i));
    list.appendChild(btn);
  });
}

function runItem(i) {
  const item = items[i];
  if (!item) return;
  closePalette();
  item.run();
}

function refresh() {
  items = buildItems(input.value.trim());
  activeIndex = 0;
  render();
}

export function openPalette() {
  overlay.hidden = false;
  input.value = "";
  refresh();
  setTimeout(() => input.focus(), 10);
}

function closePalette() {
  overlay.hidden = true;
}

input.addEventListener("input", refresh);
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    render();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    render();
  } else if (e.key === "Enter") {
    e.preventDefault();
    runItem(activeIndex);
  } else if (e.key === "Escape") {
    closePalette();
  }
});

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closePalette();
});

hintBtn.addEventListener("click", openPalette);

document.addEventListener("keydown", (e) => {
  const isK = e.key.toLowerCase() === "k";
  if ((e.ctrlKey || e.metaKey) && isK) {
    e.preventDefault();
    if (overlay.hidden) openPalette();
    else closePalette();
  }
});

export function initCommandPalette() {
  // event listeners above are wired at module load; nothing else to prime
}
