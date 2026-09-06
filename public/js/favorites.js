import { safeGetJson } from "./storage.js";
import { getDocuments, toggleFavorite as toggleDocFavorite } from "./documentsStore.js";
import { getDecks, toggleDeckFavorite } from "./flashcardDecks.js";
import { getProjects, toggleFavoriteProject } from "./projectsStore.js";
import { toggleNoteFavorite } from "./notes.js";
import { loadConversations, toggleConversationFavorite, setActiveConversationId } from "./conversations.js";
import { switchView } from "./nav.js";

const container = document.getElementById("favoritesContent");

function row(icon, title, subtitle, onOpen, onUnfavorite) {
  const el = document.createElement("div");
  el.className = "homework-card clickable";
  el.innerHTML = `
    <div class="homework-main">
      <div class="homework-title"></div>
      <div class="homework-meta"><span class="homework-badge"></span></div>
    </div>
    <div class="homework-actions">
      <button type="button" class="icon-btn" title="Remove from favorites">★</button>
    </div>`;
  el.querySelector(".homework-title").textContent = `${icon} ${title}`;
  el.querySelector(".homework-badge").textContent = subtitle;
  el.querySelector(".homework-main").style.cursor = "pointer";
  el.querySelector(".homework-main").addEventListener("click", onOpen);
  el.querySelector(".icon-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    onUnfavorite();
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
  ];

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  if (total === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">⭐</div>
        <h2>No favorites yet</h2>
        <p>Star a document, flashcard deck, project, or note to pin it here.</p>
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
