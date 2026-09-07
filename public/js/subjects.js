import { setSubject } from "./state.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { getAllSubjects, getSubjectSummary, addCustomSubject, deleteCustomSubject } from "./subjectsStore.js";
import { confirmDanger, promptForText } from "./modal.js";
import { startQuizWithTopic } from "./quiz.js";
import { getKnowledgeGraphData } from "./progress.js";

const grid = document.getElementById("subjectGrid");
const addBtn = document.getElementById("subjectAddBtn");
const graphWrap = document.getElementById("subjectKnowledgeGraph");

function subjectCard(subject) {
  const summary = getSubjectSummary(subject.key);
  const card = document.createElement("div");
  card.className = "subject-card";
  card.style.setProperty("--subject-color", subject.color);
  card.innerHTML = `
    <div class="subject-card-top">
      <span class="subject-card-icon"></span>
      <span class="subject-card-title"></span>
    </div>
    <div class="subject-card-stats"></div>`;
  card.querySelector(".subject-card-icon").textContent = subject.icon;
  card.querySelector(".subject-card-title").textContent = subject.label;

  const statsEl = card.querySelector(".subject-card-stats");
  if (!summary.hasActivity) {
    statsEl.innerHTML = '<span class="subject-card-empty">No activity yet — ask a question to get started.</span>';
  } else {
    const parts = [];
    if (summary.questions) parts.push(`${summary.questions} questions`);
    if (summary.quizzes) parts.push(`${summary.quizzes} quizzes${summary.avgScorePct !== null ? ` (${summary.avgScorePct}% avg)` : ""}`);
    if (summary.studyMinutes) parts.push(`${summary.studyMinutes} min studied`);
    if (summary.homeworkOpen || summary.homeworkDone) parts.push(`${summary.homeworkDone}/${summary.homeworkOpen + summary.homeworkDone} homework done`);
    if (summary.documents) parts.push(`${summary.documents} documents`);
    if (summary.flashcardDecks) parts.push(`${summary.flashcardDecks} flashcard decks`);
    statsEl.innerHTML = parts.map((p) => `<span>${p}</span>`).join("");
  }

  if (!subject.custom) {
    card.addEventListener("click", () => {
      setSubject(subject.key);
      switchView("chat");
    });
  } else {
    card.addEventListener("click", () => {
      startQuizWithTopic(subject.label);
      switchView("quiz");
    });
  }
  return card;
}

function renderGrid() {
  grid.innerHTML = "";
  getAllSubjects().forEach((s) => grid.appendChild(subjectCard(s)));

  const customs = getAllSubjects().filter((s) => s.custom);
  if (customs.length > 0) {
    const manageRow = document.createElement("div");
    manageRow.className = "view-actions";
    manageRow.style.gridColumn = "1 / -1";
    customs.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-btn-sm";
      btn.textContent = `Remove "${s.label}"`;
      btn.addEventListener("click", () => {
        confirmDanger(`Remove ${s.label}?`, "This only removes the subject tag — nothing else is deleted.", "Remove", () => {
          deleteCustomSubject(s.key);
          renderGrid();
        });
      });
      manageRow.appendChild(btn);
    });
    grid.appendChild(manageRow);
  }
}

addBtn.addEventListener("click", () => {
  promptForText(
    "Add a subject",
    "",
    (label) => {
      if (!label || !label.trim()) return;
      addCustomSubject(label.trim(), "📚");
      renderGrid();
      showToast(`Added "${label.trim()}".`, "success");
    },
    "e.g. Robotics Club, Art, French"
  );
});

// A lightweight knowledge map — subject and topic nodes connected only where a quiz was
// actually taken; edge color reflects the real average score for that topic.
function renderKnowledgeGraph() {
  if (!graphWrap) return;
  const data = getKnowledgeGraphData().filter((s) => s.topics.length > 0);
  if (data.length === 0) {
    graphWrap.innerHTML = '<p class="context-empty">Take a few quizzes and your knowledge map will appear here.</p>';
    return;
  }

  const colWidth = 200;
  const width = Math.max(600, data.length * colWidth);
  const subjectY = 30;
  const topicStartY = 90;
  const topicGap = 46;
  const maxTopics = Math.max(...data.map((s) => s.topics.length));
  const height = topicStartY + maxTopics * topicGap + 30;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;font-family:inherit">`;

  data.forEach((s, colIndex) => {
    const cx = colIndex * colWidth + colWidth / 2;
    const label = SUBJECT_LABELS_FALLBACK(s.subject);

    s.topics.forEach((t, i) => {
      const ty = topicStartY + i * topicGap;
      const color = t.avgPct >= 70 ? "#34d399" : t.avgPct >= 40 ? "#fbbf24" : "#ff6b7a";
      svg += `<line x1="${cx}" y1="${subjectY + 14}" x2="${cx}" y2="${ty}" stroke="${color}" stroke-width="2" opacity="0.55"></line>`;
      svg += `<circle cx="${cx}" cy="${ty}" r="7" fill="${color}"></circle>`;
      svg += `<text x="${cx}" y="${ty + 22}" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">${escapeXml(truncate(t.topic, 16))}</text>`;
      svg += `<title>${escapeXml(t.topic)}: ${t.avgPct}% avg over ${t.count} quiz${t.count === 1 ? "" : "zes"}</title>`;
    });

    svg += `<circle cx="${cx}" cy="${subjectY}" r="16" fill="url(#kgGrad)"></circle>`;
    svg += `<text x="${cx}" y="${subjectY + 4}" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--accent-contrast)">${escapeXml(label.slice(0, 2).toUpperCase())}</text>`;
    svg += `<text x="${cx}" y="${subjectY + 34}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${escapeXml(label)}</text>`;
  });

  // Presentation attributes can't see CSS custom properties, but inline `style` can — this
  // keeps the knowledge map's header nodes in sync with the user's chosen accent color.
  svg += `<defs><linearGradient id="kgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent-1)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient></defs>`;
  svg += `</svg>`;
  graphWrap.innerHTML = svg;
}

function truncate(text, len) {
  return text.length > len ? text.slice(0, len - 1) + "…" : text;
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function SUBJECT_LABELS_FALLBACK(subject) {
  const all = getAllSubjects();
  const found = all.find((s) => s.key === subject);
  return found ? found.label : subject;
}

export function initSubjects() {
  renderGrid();
  renderKnowledgeGraph();
}

export function refreshSubjects() {
  renderGrid();
  renderKnowledgeGraph();
}
