import { safeGetJson, safeSetJson } from "./storage.js";
import { getDocuments, toggleFavorite as toggleDocFavorite } from "./documentsStore.js";
import { getDecks, toggleDeckFavorite } from "./flashcardDecks.js";
import { getProjects, toggleFavoriteProject } from "./projectsStore.js";
import { toggleNoteFavorite } from "./notes.js";
import { loadConversations, toggleConversationFavorite, setActiveConversationId } from "./conversations.js";
import { getSavedAnswers, deleteSavedAnswer } from "./vaultStore.js";
import { QUOTES } from "./quotesData.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";

const QUOTE_FAVORITES_KEY = "h1-quote-favorites";

function toggleQuoteFavorite(id) {
  const set = new Set(safeGetJson(QUOTE_FAVORITES_KEY, []));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  safeSetJson(QUOTE_FAVORITES_KEY, [...set]);
}

const container = document.getElementById("favoritesContent");

function row(icon, title, subtitle, onOpen, onRemove, removeIcon = "★", removeTitle = "Remove from favorites") {
  const el = document.createElement("div");
  el.className = "homework-card clickable";
  el.innerHTML = `
    <div class="homework-main">
      <div class="homework-title"></div>
      <div class="homework-meta"><span class="homework-badge"></span></div>
    </div>
    <div class="homework-actions">
      <button type="button" class="icon-btn" title=""></button>
    </div>`;
  el.querySelector(".homework-title").textContent = `${icon} ${title}`;
  el.querySelector(".homework-badge").textContent = subtitle;
  el.querySelector(".homework-main").style.cursor = "pointer";
  el.querySelector(".homework-main").addEventListener("click", onOpen);
  const removeBtn = el.querySelector(".icon-btn");
  removeBtn.title = removeTitle;
  removeBtn.textContent = removeIcon;
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
    render();
  });
  return el;
}

export function render() {
  container.innerHTML = "";
  const sections = [
    { label: "📄 Documents", items: getDocuments().filter((d) => d.favorite), build: (d) => row("📄", d.name, "Document", () => switchView("documents"), () => toggleDocFavorite(d.id)) },
    { label: "🗂️ Flashcard decks", items: getDecks().filter((d) => d.favorite), build: (d) => row("🗂️", d.topic, "Flashcard deck", () => switchView("flashcards"), () => toggleDeckFavorite(d.id)) },
    { label: "🧩 Projects", items: getProjects().filter((p) => p.favorite), build: (p) => row("🧩", p.title, "Project", () => switchView("projects"), () => toggleFavoriteProject(p.id)) },
    {
      label: "📝 Notes",
      items: safeGetJson("h1-notes", []).filter((n) => n.favorite),
      build: (n) => row("📝", n.title || "Untitled note", "Note", () => switchView("notes"), () => toggleNoteFavorite(n.id)),
    },
    {
      label: "💬 Pinned chats",
      items: loadConversations().filter((c) => c.favorite),
      build: (c) =>
        row(
          "💬",
          c.title,
          "Conversation",
          () => {
            setActiveConversationId(c.id);
            switchView("chat");
            window.dispatchEvent(new CustomEvent("h1:conversation-selected"));
          },
          () => toggleConversationFavorite(c.id)
        ),
    },
    {
      label: "💾 Saved answers",
      items: getSavedAnswers(),
      build: (a) =>
        row(
          "💾",
          a.question ? a.question.slice(0, 70) : a.answer.slice(0, 70),
          "Saved AI answer",
          () => {
            switchView("home");
            showToast(a.answer.slice(0, 200) + (a.answer.length > 200 ? "…" : ""), "success", 6000);
          },
          () => deleteSavedAnswer(a.id),
          "✕",
          "Remove from Vault"
        ),
    },
    {
      label: "✨ Favorited quotes",
      items: (() => {
        const favIds = new Set(safeGetJson(QUOTE_FAVORITES_KEY, []));
        return QUOTES.filter((q) => favIds.has(q.id));
      })(),
      build: (q) => row("✨", q.text, "Quote", () => switchView("quotes"), () => toggleQuoteFavorite(q.id)),
    },
  ];

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  if (total === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">💎</div>
        <h2>Your Vault is empty</h2>
        <p>Star a document, flashcard deck, project, note, or quote — or save an AI answer from the chat — to keep it here.</p>
      </div>`;
    return;
  }

  sections.forEach((s) => {
    if (s.items.length === 0) return;
    const heading = document.createElement("div");
    heading.className = "section-heading";
    heading.innerHTML = `<h2>${s.label}</h2>`;
    container.appendChild(heading);
    const list = document.createElement("div");
    list.className = "homework-list";
    s.items.forEach((item) => list.appendChild(s.build(item)));
    container.appendChild(list);
  });
}

export function initFavorites() {
  render();
}
