import { setSubject } from "./state.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { getAllSubjects, getSubjectSummary, addCustomSubject, deleteCustomSubject } from "./subjectsStore.js";
import { confirmDanger, promptForText } from "./modal.js";
import { startQuizWithTopic } from "./quiz.js";
import { renderKnowledgeUniverse } from "./knowledgeUniverse.js";

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
    if (summary.questions) parts.push(`${summary.questions} question${summary.questions === 1 ? "" : "s"}`);
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

// The knowledge map is now the Knowledge Universe (see knowledgeUniverse.js) — same slot,
// but driven by the full topic intel rather than quiz events alone, and interactive.
function renderKnowledgeGraph() {
  renderKnowledgeUniverse(graphWrap);
}

export function initSubjects() {
  renderGrid();
  renderKnowledgeGraph();
}

export function refreshSubjects() {
  renderGrid();
  renderKnowledgeGraph();
}
