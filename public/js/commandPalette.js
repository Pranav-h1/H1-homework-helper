import { switchView } from "./nav.js";
import { setTheme } from "./theme.js";
import { loadConversations, setActiveConversationId } from "./conversations.js";
import { safeGetJson } from "./storage.js";

const overlay = document.getElementById("commandOverlay");
const input = document.getElementById("commandInput");
const list = document.getElementById("commandList");
const hintBtn = document.getElementById("commandHint");

const STATIC_COMMANDS = [
  { title: "Ask H1", icon: "💬", run: () => switchView("chat") },
  { title: "Open Home", icon: "🏠", run: () => switchView("home") },
  { title: "Open Step-by-Step", icon: "🧠", run: () => switchView("explain") },
  { title: "Open Quiz", icon: "📝", run: () => switchView("quiz") },
  { title: "Open Flashcards", icon: "🗂️", run: () => switchView("flashcards") },
  { title: "Open Notes", icon: "📝", run: () => switchView("notes") },
  { title: "Open Study Mode", icon: "⏱️", run: () => switchView("study-mode") },
  { title: "Open Summarize", icon: "📄", run: () => switchView("summarize") },
  { title: "Open Practice Questions", icon: "✍️", run: () => switchView("practice") },
  { title: "Open Study Plan", icon: "🗓️", run: () => switchView("study-plan") },
  { title: "Open Vocabulary", icon: "🔤", run: () => switchView("vocabulary") },
  { title: "Open Exam Mode", icon: "📆", run: () => switchView("exam-mode") },
  { title: "Open Progress", icon: "📈", run: () => switchView("progress") },
  { title: "Open Settings", icon: "⚙️", run: () => switchView("settings") },
  {
    title: "Toggle dark / light theme",
    icon: "🌓",
    run: () => {
      const current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "light" ? "dark" : "light");
    },
  },
];

let activeIndex = 0;
let items = [];

function matches(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
}

function buildItems(query) {
  const commandMatches = STATIC_COMMANDS.filter((c) => !query || matches(c.title, query));
  if (!query) return commandMatches;

  const convoMatches = loadConversations()
    .filter((c) => matches(c.title, query))
    .slice(0, 5)
    .map((c) => ({
      title: c.title,
      icon: "🗨️",
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
      subtitle: "Note",
      run: () => {
        switchView("notes");
        window.dispatchEvent(new CustomEvent("h1:note-selected", { detail: { id: n.id } }));
      },
    }));

  const quizMatches = safeGetJson("h1-recent-quizzes", [])
    .filter((q) => matches(q.topic || "", query))
    .slice(0, 5)
    .map((q) => ({
      title: `${q.topic} (${q.score}/${q.total})`,
      icon: "📝",
      subtitle: "Recent quiz",
      run: () => switchView("quiz"),
    }));

  return [...commandMatches, ...convoMatches, ...noteMatches, ...quizMatches];
}

function render() {
  list.innerHTML = "";
  if (items.length === 0) {
    list.innerHTML = '<div class="command-empty">No matching actions.</div>';
    return;
  }
  items.forEach((item, i) => {
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
