// Build — the "make something" half of H1's coding section: websites and Python programs.
//
// A website is three files, a live preview, and a save button. The preview runs in the same
// sandboxed frame the lessons use, so a student can paste anything into it without it reaching
// H1's own data. A Python program runs on the same real-Python workspace as the course.
//
// H1 will help with the code, but it never edits the project behind the student's back: the
// answer comes with a copy button and they decide what goes in. Silently rewriting someone's
// file is how you lose work you spent an hour on.
import {
  TEMPLATES,
  PY_TEMPLATES,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
  exportProjectHtml,
  projectKind,
  projectFileName,
} from "./codeProjectsStore.js";
import { createRunner } from "./codeRunner.js";
import { createCodeEditor } from "./codeEditor.js";
import { createPythonWorkspace } from "./pythonWorkspace.js";
import { decorateCodeBlocks } from "./codeBlocks.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { confirmDanger, promptForText } from "./modal.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";
import { switchView } from "./nav.js";
import { selectSubtabInView } from "./subtabs.js";

const root = document.getElementById("codeBuildRoot");

const PREVIEW_DEBOUNCE_MS = 500;
const SAVE_DEBOUNCE_MS = 700;

let openId = null;
let editors = {};
let activeFile = "html";
let runner = null;
let previewTimer = null;
let saveTimer = null;
let pyWorkspace = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function currentCode() {
  return {
    html: editors.html ? editors.html.value : "",
    css: editors.css ? editors.css.value : "",
    js: editors.js ? editors.js.value : "",
  };
}

function disposePython() {
  if (pyWorkspace) {
    pyWorkspace.dispose();
    pyWorkspace = null;
  }
}

function download(text, type, filename) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has actually started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// createProject refuses at the limit instead of dropping an old project; the student is told why.
function tryCreate(args) {
  try {
    return createProject(args);
  } catch (err) {
    showToast(err.message || "Couldn't create the project.", "error", 4200);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

function templateGrid(label, templates, kind) {
  const row = el("div", "builder-templates");
  row.appendChild(el("div", "builder-templates-label", label));
  const grid = el("div", "builder-template-grid");
  templates.forEach((t) => {
    const card = el("button", `builder-template${kind === "python" ? " is-python" : ""}`);
    card.type = "button";
    card.appendChild(el("strong", null, t.name));
    card.appendChild(el("span", "builder-template-blurb", t.blurb));
    card.addEventListener("click", () => {
      const p = tryCreate({ name: t.name, templateId: t.id, kind });
      if (!p) return;
      logEvent("project_started", { title: p.name, subject: "coding", kind });
      openProject(p.id);
    });
    grid.appendChild(card);
  });
  row.appendChild(grid);
  return row;
}

function renderList() {
  disposePython();
  root.innerHTML = "";
  openId = null;

  const head = el("div", "code-hero");
  head.appendChild(el("h2", null, "Build something"));
  head.appendChild(
    el(
      "p",
      "code-hero-sub",
      "Write a Python program or a website of your own. Everything saves as you go, and you can download what you make — a .py file that runs anywhere Python does, or a single .html page that opens in any browser."
    )
  );
  root.appendChild(head);

  root.appendChild(templateGrid("Start a Python program", PY_TEMPLATES, "python"));
  root.appendChild(templateGrid("Start a website", TEMPLATES, "web"));

  const projects = getProjects();
  const listWrap = el("div", "builder-list-wrap");
  listWrap.appendChild(el("div", "builder-templates-label", `Your projects${projects.length ? ` (${projects.length})` : ""}`));

  if (projects.length === 0) {
    listWrap.appendChild(el("p", "brain-empty-line", "Nothing here yet. Pick a starting point above and you'll have something running immediately."));
  } else {
    const list = el("div", "builder-list");
    projects.forEach((p) => {
      const kind = projectKind(p);
      const row = el("div", "builder-row");
      const main = el("div", "builder-row-main");
      const nameRow = el("div", "builder-row-name");
      nameRow.appendChild(el("span", `builder-kind ${kind}`, kind === "python" ? "Python" : "Website"));
      nameRow.appendChild(document.createTextNode(p.name));
      main.appendChild(nameRow);
      const when = new Date(p.updatedAt);
      const size = kind === "python" ? (p.py || "").split("\n").length : (p.html || "").length + (p.css || "").length + (p.js || "").length;
      main.appendChild(
        el(
          "p",
          "builder-row-meta",
          `Edited ${when.toLocaleDateString([], { month: "short", day: "numeric" })} · ${kind === "python" ? `${size} line${size === 1 ? "" : "s"}` : `${size} characters`}${p.source ? ` · from ${p.source}` : ""}`
        )
      );
      row.appendChild(main);

      const side = el("div", "builder-row-side");
      side.appendChild(button("Open", "btn btn-primary brain-btn-sm", () => openProject(p.id)));
      side.appendChild(
        button("Duplicate", "btn btn-ghost brain-btn-sm", () => {
          try {
            duplicateProject(p.id);
          } catch (err) {
            showToast(err.message, "error", 4200);
          }
          renderList();
        })
      );
      side.appendChild(
        button("Delete", "btn btn-ghost brain-btn-sm", () => {
          confirmDanger(`Delete "${p.name}"?`, "This can't be undone.", "Delete", () => {
            deleteProject(p.id);
            renderList();
          });
        })
      );
      row.appendChild(side);
      list.appendChild(row);
    });
    listWrap.appendChild(list);
  }
  root.appendChild(listWrap);
}

// ---------------------------------------------------------------------------
// Shared project bar
// ---------------------------------------------------------------------------

function projectBar(project, { onBack, extraTools = [] }) {
  const bar = el("div", "builder-bar");
  bar.appendChild(button("← All projects", "btn btn-ghost brain-btn-sm", onBack));
  const title = el("div", "builder-title", project.name);
  bar.appendChild(title);
  const stamp = el("span", "builder-saved", "Saved");
  stamp.id = "builderSavedAt";
  bar.appendChild(stamp);

  const tools = el("div", "builder-tools");
  tools.appendChild(
    button("Rename", "btn btn-ghost brain-btn-sm", () => {
      // promptForText(title, currentValue, onConfirm, placeholder)
      promptForText(
        "Rename project",
        getProject(project.id).name,
        (name) => {
          if (!name || !name.trim()) return;
          updateProject(project.id, { name: name.trim() });
          title.textContent = name.trim();
        },
        "Project name"
      );
    })
  );
  extraTools.forEach((t) => tools.appendChild(t));
  bar.appendChild(tools);
  return bar;
}

function stampSaved() {
  const stamp = document.getElementById("builderSavedAt");
  if (stamp) stamp.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function askPanel(placeholder, onAsk) {
  const askWrap = el("div", "builder-ask");
  askWrap.appendChild(el("div", "code-panel-label", "Ask H1 about this project"));
  const askRow = el("div", "builder-ask-row");
  const askInput = el("input", "tool-input");
  askInput.type = "text";
  askInput.placeholder = placeholder;
  askInput.setAttribute("aria-label", "Ask H1 about this project");
  askRow.appendChild(askInput);
  const askHost = el("div", "builder-ask-answer");
  const askBtn = button("Ask", "btn btn-primary brain-btn-sm", () => onAsk(askInput, askHost, askBtn));
  askRow.appendChild(askBtn);
  askWrap.appendChild(askRow);
  askWrap.appendChild(askHost);
  askInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAsk(askInput, askHost, askBtn);
    }
  });
  return askWrap;
}

function renderAnswer(host, reply, note) {
  host.innerHTML = "";
  const panel = el("div", "code-hint-panel");
  const body = el("div", "code-prose");
  body.innerHTML = renderMarkdown(reply);
  // Copy buttons and highlighting on each code block — H1 suggests, the student decides what
  // lands in their file.
  decorateCodeBlocks(body, { runPython: false });
  panel.appendChild(body);
  if (note) panel.appendChild(el("p", "builder-trim-note", note));
  host.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Website editor
// ---------------------------------------------------------------------------

function editorFor(file, value) {
  const wrap = el("div", "code-editor-pane");
  wrap.dataset.file = file;
  const ed = createCodeEditor({
    value: value || "",
    language: file === "js" ? "javascript" : file,
    ariaLabel: `${file.toUpperCase()} editor`,
    onInput: () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
    },
  });
  wrap.appendChild(ed.root);
  editors[file] = ed.textarea;
  return wrap;
}

function save() {
  if (!openId) return;
  const p = getProject(openId);
  if (!p || projectKind(p) !== "web") return;
  updateProject(openId, currentCode());
  stampSaved();
}

function refreshPreview() {
  if (!runner) return;
  runner.preview(currentCode());
}

function openProject(id) {
  const project = getProject(id);
  if (!project) return renderList();
  disposePython();
  if (projectKind(project) === "python") return openPythonProject(project);

  openId = id;
  editors = {};
  root.innerHTML = "";

  const bar = projectBar(project, {
    onBack: () => {
      save();
      renderList();
    },
    extraTools: [
      button("↻ Refresh preview", "btn btn-ghost brain-btn-sm", refreshPreview),
      button("⬇ Download .html", "btn btn-ghost brain-btn-sm", () => {
        save();
        const fresh = getProject(id);
        download(exportProjectHtml(fresh), "text/html", projectFileName(fresh, "html"));
        showToast("Downloaded — one file, opens in any browser.", "success", 3000);
      }),
    ],
  });
  root.appendChild(bar);

  const layout = el("div", "builder-layout");

  const codeSide = el("div", "builder-code");
  const tabsRow = el("div", "code-file-tabs");
  const panes = [];
  ["html", "css", "js"].forEach((f) => {
    const tab = el("button", "code-file-tab", f.toUpperCase());
    tab.type = "button";
    tab.dataset.file = f;
    tabsRow.appendChild(tab);
    panes.push(editorFor(f, project[f]));
  });
  codeSide.appendChild(tabsRow);
  panes.forEach((p) => codeSide.appendChild(p));
  [...tabsRow.children].forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFile = tab.dataset.file;
      [...tabsRow.children].forEach((b) => b.classList.toggle("active", b.dataset.file === activeFile));
      panes.forEach((p) => (p.hidden = p.dataset.file !== activeFile));
      if (editors[activeFile]) editors[activeFile].focus();
    });
  });

  const previewSide = el("div", "builder-preview-side");
  previewSide.appendChild(el("div", "code-panel-label", "Live preview"));
  const previewHost = el("div", "code-preview builder-preview");
  previewSide.appendChild(previewHost);
  previewSide.appendChild(askPanel("e.g. how do I centre the heading?", (input, host, btnEl) => askAboutWebCode(input, host, btnEl, project.name)));

  layout.appendChild(codeSide);
  layout.appendChild(previewSide);
  root.appendChild(layout);

  activeFile = "html";
  tabsRow.children[0].classList.add("active");
  panes.forEach((p) => (p.hidden = p.dataset.file !== "html"));

  runner = createRunner(previewHost);
  refreshPreview();
}

async function askAboutWebCode(input, host, btnEl, projectName) {
  const question = input.value.trim();
  if (!question) {
    showToast("Type what you'd like help with first.", "error", 2400);
    return;
  }
  btnEl.disabled = true;
  host.innerHTML = "";
  host.appendChild(el("p", "code-hint-loading", "Asking H1…"));

  const code = currentCode();
  // The files travel as attachments, so H1 reads all of them rather than a trimmed excerpt.
  const documents = ["html", "css", "js"]
    .filter((k) => (code[k] || "").trim())
    .map((k) => ({ name: `index.${k}`, text: code[k] }));
  const message =
    `I'm building a web page called "${projectName}" with plain HTML, CSS and JavaScript (files attached). ` +
    `Answer my question about it. Show only the small piece of code that needs to change, and say which file it goes in.\n\n` +
    `Question: ${question}`;

  try {
    const reply = await sendChat([{ role: "user", content: message.slice(0, 3900), documents }], "coding", { mode: "tutor", language: "en" });
    logEvent("question", { source: "web_builder", subject: "coding" });
    renderAnswer(host, reply);
    input.value = "";
  } catch (err) {
    host.innerHTML = "";
    host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(err)));
  } finally {
    btnEl.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Python program
// ---------------------------------------------------------------------------

function openPythonProject(project) {
  openId = project.id;
  editors = {};
  runner = null;
  root.innerHTML = "";

  const fileName = projectFileName(project, "py").replace(/ /g, "_");
  const bar = projectBar(project, {
    onBack: () => {
      if (pyWorkspace) pyWorkspace.flush();
      renderList();
    },
    extraTools: [
      button("⬇ Download .py", "btn btn-ghost brain-btn-sm", () => {
        if (pyWorkspace) pyWorkspace.flush();
        const fresh = getProject(project.id);
        download(fresh.py || "", "text/x-python", projectFileName(fresh, "py"));
        showToast("Downloaded — run it with Python on any computer.", "success", 3000);
      }),
    ],
  });
  root.appendChild(bar);

  const layout = el("div", "builder-py-layout");
  pyWorkspace = createPythonWorkspace({
    code: project.py || "",
    stdin: project.stdin || "",
    fileName: fileName.toLowerCase(),
    context: () => `My Python project "${getProject(project.id)?.name || project.name}".`,
    onChange: ({ code, stdin }) => {
      updateProject(project.id, { py: code, stdin });
      stampSaved();
    },
    editorHeight: "420px",
  });
  layout.appendChild(pyWorkspace.root);
  layout.appendChild(
    askPanel("e.g. how do I keep asking until the answer is a number?", async (input, host, btnEl) => {
      const question = input.value.trim();
      if (!question) {
        showToast("Type what you'd like help with first.", "error", 2400);
        return;
      }
      btnEl.disabled = true;
      host.innerHTML = "";
      host.appendChild(el("p", "code-hint-loading", "Asking H1…"));
      const message =
        `I'm writing a Python program (attached as ${fileName}). Answer my question about it for a student. ` +
        `Show only the lines that need to change and where they go — don't rewrite the whole program.\n\nQuestion: ${question}`;
      try {
        const reply = await sendChat([{ role: "user", content: message.slice(0, 3900), documents: [{ name: fileName, text: pyWorkspace ? pyWorkspace.getCode() : "" }] }], "coding", {
          mode: "tutor",
          language: "en",
        });
        logEvent("question", { source: "python_project", subject: "coding" });
        renderAnswer(host, reply);
        input.value = "";
      } catch (err) {
        host.innerHTML = "";
        host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(err)));
      } finally {
        btnEl.disabled = false;
      }
    })
  );
  root.appendChild(layout);
}

// Python code from anywhere else in H1 (an AI Tutor answer, for now) opens as a project of its
// own, so it can be run, changed and kept. Opening the same code twice reuses that project
// rather than making a duplicate each click.
function openPythonCode({ code, source }) {
  const text = String(code || "").replace(/\s+$/, "") + "\n";
  const existing = getProjects().find((p) => projectKind(p) === "python" && p.source === source && p.py === text);
  let project = existing;
  if (!project) {
    const stamp = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    project = tryCreate({ name: `${source || "Python"} code · ${stamp}`, kind: "python", py: text, stdin: "", source: source || "H1" });
    if (!project) return;
    logEvent("project_started", { title: project.name, subject: "coding", kind: "python" });
  }
  switchView("code");
  selectSubtabInView("code", "build");
  openProject(project.id);
  showToast(existing ? "Opened in Code Lab." : "Opened in Code Lab as a new Python project — press Run.", "success", 2600);
}

// ---------------------------------------------------------------------------

export function renderWebBuilder() {
  if (!root) return;
  if (openId && getProject(openId)) {
    // Coming back to an open Python project mustn't rebuild it (and stop a running program).
    if (pyWorkspace && pyWorkspace.root.isConnected) return;
    if (projectKind(getProject(openId)) === "web") return;
    return openProject(openId);
  }
  renderList();
}

export function initWebBuilder() {
  if (!root) return;
  renderList();
  window.addEventListener("h1:open-python", (e) => openPythonCode(e.detail || {}));
}

// Saving on the way out means a half-typed change is never lost by navigating away.
export function flushBuilder() {
  if (!openId) return;
  if (pyWorkspace) pyWorkspace.flush();
  else save();
}
