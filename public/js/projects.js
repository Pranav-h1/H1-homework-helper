import { sendChat, friendlyErrorMessage } from "./api.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { confirmDanger, promptForText, openListPicker } from "./modal.js";
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  toggleFavoriteProject,
  addTasks,
  toggleTask,
  deleteTask,
  linkDocument,
  unlinkDocument,
  linkNote,
  unlinkNote,
  getProjectProgress,
} from "./projectsStore.js";
import { createItem as createPlannerItem } from "./plannerStore.js";
import { getDocuments, getDocument } from "./documentsStore.js";
import { safeGetJson } from "./storage.js";

const grid = document.getElementById("projectGrid");
const emptyState = document.getElementById("projectEmptyState");
const toolbar = document.getElementById("projectToolbar");
const newBtn = document.getElementById("projectNewBtn");
const detail = document.getElementById("projectDetail");
const backBtn = document.getElementById("projectDetailBackBtn");

const PROJECT_TYPES = { assignment: "Assignment", science: "Science project", presentation: "Presentation", research: "Research", coding: "Coding project", group: "Group project" };

function loadingRow(text) {
  const row = document.createElement("div");
  row.className = "loading-row";
  row.innerHTML = `<span class="spinner"></span><span></span>`;
  row.querySelector("span:last-child").textContent = text;
  return row;
}

function projectCard(p) {
  const pct = getProjectProgress(p);
  const card = document.createElement("div");
  card.className = "bento-tile clickable";
  card.innerHTML = `
    <div class="bento-tile-eyebrow"></div>
    <div class="bento-tile-title"></div>
    <div class="bento-tile-sub"></div>
    <div class="level-bar-track" style="margin-top:10px"><div class="level-bar-fill" style="width:${pct}%"></div></div>`;
  card.querySelector(".bento-tile-eyebrow").textContent = (p.favorite ? "⭐ " : "") + (PROJECT_TYPES[p.type] || p.type);
  card.querySelector(".bento-tile-title").textContent = p.title;
  card.querySelector(".bento-tile-sub").textContent = `${p.tasks.filter((t) => t.done).length}/${p.tasks.length} tasks · ${pct}%${p.deadline ? " · Due " + p.deadline : ""}`;
  card.addEventListener("click", () => openDetail(p.id));
  return card;
}

function renderGrid() {
  const projects = getProjects();
  grid.innerHTML = "";
  emptyState.hidden = projects.length > 0;
  grid.hidden = projects.length === 0;
  projects.forEach((p) => grid.appendChild(projectCard(p)));
}

newBtn.addEventListener("click", () => {
  promptForText(
    "New project title",
    "",
    (title) => {
      if (!title) return;
      const project = createProject({ title });
      renderGrid();
      openDetail(project.id);
    },
    "e.g. Science fair volcano model"
  );
});

function renderTasks(project) {
  const wrap = document.getElementById("projectTasksList");
  wrap.innerHTML = "";
  if (project.tasks.length === 0) {
    wrap.innerHTML = '<p class="context-empty">No tasks yet — add one, or let H1 break the project down for you.</p>';
    return;
  }
  project.tasks.forEach((t) => {
    const row = document.createElement("div");
    row.className = "plan-task" + (t.done ? " done" : "");
    row.innerHTML = `
      <div class="plan-checkbox${t.done ? " checked" : ""}"></div>
      <div style="flex:1;min-width:0"><div class="plan-task-title"></div></div>
      <button type="button" class="icon-btn" aria-label="Delete task">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`;
    row.querySelector(".plan-task-title").textContent = t.title;
    row.querySelector(".plan-checkbox").innerHTML = t.done
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : "";
    row.querySelector(".plan-checkbox").addEventListener("click", () => {
      toggleTask(project.id, t.id);
      openDetail(project.id);
    });
    row.querySelector(".icon-btn").addEventListener("click", () => {
      deleteTask(project.id, t.id);
      openDetail(project.id);
    });
    wrap.appendChild(row);
  });
}

function renderLinks(project) {
  const wrap = document.getElementById("projectLinksList");
  wrap.innerHTML = "";
  const notes = safeGetJson("h1-notes", []);
  project.linkedNoteIds.forEach((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const chip = document.createElement("div");
    chip.className = "context-chip";
    chip.innerHTML = `<span>📝</span><span class="context-chip-label"></span><button type="button">×</button>`;
    chip.querySelector(".context-chip-label").textContent = note.title || "Untitled note";
    chip.querySelector("button").addEventListener("click", () => {
      unlinkNote(project.id, id);
      openDetail(project.id);
    });
    wrap.appendChild(chip);
  });
  project.linkedDocIds.forEach((id) => {
    const doc = getDocument(id);
    if (!doc) return;
    const chip = document.createElement("div");
    chip.className = "context-chip";
    chip.innerHTML = `<span>📄</span><span class="context-chip-label"></span><button type="button">×</button>`;
    chip.querySelector(".context-chip-label").textContent = doc.name;
    chip.querySelector("button").addEventListener("click", () => {
      unlinkDocument(project.id, id);
      openDetail(project.id);
    });
    wrap.appendChild(chip);
  });
  if (project.linkedNoteIds.length === 0 && project.linkedDocIds.length === 0) {
    wrap.innerHTML = '<p class="context-empty">No files or notes linked yet.</p>';
  }
}

function splitToLines(text) {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*]|\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function spreadDates(count, deadline) {
  const end = deadline ? new Date(deadline + "T00:00:00") : new Date(Date.now() + 14 * 86400000);
  const start = new Date();
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const dates = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.round((totalDays * (i + 1)) / (count + 1));
    const d = new Date(start);
    d.setDate(d.getDate() + offset);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function runAIAction(project, kind) {
  const resultEl = document.getElementById("projectAIResult");
  resultEl.innerHTML = "";
  resultEl.appendChild(loadingRow("H1 is thinking…"));

  const prompts = {
    tasks: `Break this project into a clear, ordered checklist of concrete tasks: "${project.title}" (${PROJECT_TYPES[project.type] || project.type}). Reply with ONLY the tasks, one per line, no extra commentary.`,
    timeline: `Create a milestone timeline (5-8 milestones) for completing this project by its deadline: "${project.title}". Reply with ONLY the milestones in order, one per line, no extra commentary.`,
    missing: `Review this project and list anything important that's commonly forgotten or missing: "${project.title}" (current tasks: ${project.tasks.map((t) => t.title).join(", ") || "none yet"}). Reply with ONLY the missing items, one per line.`,
    outline: `Prepare a presentation outline (section by section) for this project: "${project.title}". Reply with a short, clearly structured outline.`,
  };

  try {
    const reply = await sendChat([{ role: "user", content: prompts[kind] }], project.subject || appState.subject);
    resultEl.innerHTML = "";

    if (kind === "tasks") {
      const tasks = splitToLines(reply);
      addTasks(project.id, tasks);
      showToast(`Added ${tasks.length} tasks.`, "success");
      openDetail(project.id);
      return;
    }
    if (kind === "timeline") {
      const milestones = splitToLines(reply);
      const dates = spreadDates(milestones.length, project.deadline);
      milestones.forEach((title, i) => createPlannerItem({ type: "goal", title: `${project.title}: ${title}`, subject: project.subject, deadline: dates[i] }));
      showToast(`Added ${milestones.length} milestones to your Planner.`, "success");
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = "<h3>Timeline added to Planner</h3>";
      milestones.forEach((m, i) => {
        const row = document.createElement("div");
        row.className = "weak-topic-row";
        row.innerHTML = `<span></span><span></span>`;
        row.querySelector("span:first-child").textContent = m;
        row.querySelector("span:last-child").textContent = dates[i];
        card.appendChild(row);
      });
      resultEl.appendChild(card);
      return;
    }
    if (kind === "outline") {
      updateProject(project.id, { notes: (project.notes ? project.notes + "\n\n" : "") + "Presentation outline:\n" + reply });
      showToast("Outline saved to project notes.", "success");
      openDetail(project.id);
      return;
    }
    // missing
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = "<h3>Possibly missing</h3><ul class=\"result-list\"></ul>";
    const ul = card.querySelector("ul");
    splitToLines(reply).forEach((m) => {
      const li = document.createElement("li");
      li.textContent = m;
      ul.appendChild(li);
    });
    resultEl.appendChild(card);
  } catch (err) {
    resultEl.innerHTML = "";
    const errorCard = document.createElement("div");
    errorCard.className = "step-card";
    errorCard.style.borderColor = "var(--danger-border)";
    errorCard.innerHTML = `<div class="step-text" style="color:var(--danger)"></div>`;
    errorCard.querySelector(".step-text").textContent = friendlyErrorMessage(err);
    resultEl.appendChild(errorCard);
  }
}

function openDetail(id) {
  const project = getProject(id);
  if (!project) return;
  grid.hidden = true;
  emptyState.hidden = true;
  toolbar.hidden = true;
  detail.hidden = false;

  document.getElementById("projectDetailTitle").textContent = project.title;
  document.getElementById("projectDetailMeta").textContent =
    `${PROJECT_TYPES[project.type] || project.type} · ${SUBJECT_LABELS[project.subject] || project.subject}` + (project.deadline ? ` · Due ${project.deadline}` : "");
  document.getElementById("projectNotesInput").value = project.notes || "";
  document.getElementById("projectDeadlineInput").value = project.deadline || "";
  document.getElementById("projectDeadlineInput").onchange = (e) => {
    project.deadline = e.target.value;
    updateProject(project.id, { deadline: project.deadline });
    document.getElementById("projectDetailMeta").textContent =
      `${PROJECT_TYPES[project.type] || project.type} · ${SUBJECT_LABELS[project.subject] || project.subject}` + (project.deadline ? ` · Due ${project.deadline}` : "");
  };
  document.getElementById("projectAIResult").innerHTML = "";
  renderTasks(project);
  renderLinks(project);

  document.getElementById("projectAddTaskBtn").onclick = () => {
    promptForText("Add a task", "", (title) => {
      if (!title) return;
      addTasks(project.id, [title]);
      openDetail(project.id);
    });
  };
  document.getElementById("projectNotesInput").onchange = (e) => {
    project.notes = e.target.value;
    updateProject(project.id, { notes: project.notes });
  };
  document.getElementById("projectFavoriteBtn").onclick = () => {
    toggleFavoriteProject(project.id);
    openDetail(project.id);
  };
  document.getElementById("projectFavoriteBtn").textContent = project.favorite ? "★ Favorited" : "☆ Favorite";
  document.getElementById("projectDeleteBtn").onclick = () => {
    confirmDanger("Delete this project?", `"${project.title}" and its tasks will be removed.`, "Delete", () => {
      deleteProject(project.id);
      closeDetail();
    });
  };
  document.getElementById("projectAddDeadlineBtn").onclick = () => {
    if (!project.deadline) {
      showToast("Set a deadline on this project first.", "error");
      return;
    }
    createPlannerItem({ type: "goal", title: `Project due: ${project.title}`, subject: project.subject, deadline: project.deadline });
    showToast("Added to your Planner & Calendar.", "success");
  };
  document.getElementById("projectLinkNoteBtn").onclick = () => {
    const notes = safeGetJson("h1-notes", []).filter((n) => !project.linkedNoteIds.includes(n.id));
    openListPicker("Link a note", notes.map((n) => ({ id: n.id, icon: "📝", label: n.title || "Untitled note" })), (id) => {
      linkNote(project.id, id);
      openDetail(project.id);
    }, "No notes available.");
  };
  document.getElementById("projectLinkDocBtn").onclick = () => {
    const docs = getDocuments().filter((d) => !project.linkedDocIds.includes(d.id));
    openListPicker("Link a document", docs.map((d) => ({ id: d.id, icon: "📄", label: d.name })), (id) => {
      linkDocument(project.id, id);
      openDetail(project.id);
    }, "No documents available.");
  };

  document.querySelectorAll(".project-ai-btn").forEach((btn) => {
    btn.onclick = () => runAIAction(project, btn.dataset.aiAction);
  });
}

function closeDetail() {
  detail.hidden = true;
  toolbar.hidden = false;
  renderGrid();
}
backBtn.addEventListener("click", closeDetail);

export function initProjects() {
  renderGrid();
}

export function refreshProjects() {
  renderGrid();
}
