// Web Builder — the "build a website" half of H1's coding section.
//
// Three files, a live preview, and a save button. The preview runs in the same sandboxed
// frame the lessons use, so a student can paste anything into it without it reaching H1's
// own data.
//
// H1 will help with the code, but it never edits the project behind the student's back: the
// answer comes with a copy button and they decide what goes in. Silently rewriting someone's
// file is how you lose work you spent an hour on.
import {
  TEMPLATES,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
  exportProjectHtml,
} from "./codeProjectsStore.js";
import { createRunner } from "./codeRunner.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { confirmDanger, promptForText } from "./modal.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";

const root = document.getElementById("codeBuildRoot");

const PREVIEW_DEBOUNCE_MS = 500;
const SAVE_DEBOUNCE_MS = 700;

let openId = null;
let editors = {};
let activeFile = "html";
let runner = null;
let previewTimer = null;
let saveTimer = null;

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

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

function renderList() {
  root.innerHTML = "";
  openId = null;

  const head = el("div", "code-hero");
  head.appendChild(el("h2", null, "Build a website"));
  head.appendChild(
    el(
      "p",
      "code-hero-sub",
      "Write HTML, CSS and JavaScript and watch the page change as you type. Everything saves as you go, and you can download a finished site as a single file that works anywhere."
    )
  );
  root.appendChild(head);

  const tplRow = el("div", "builder-templates");
  tplRow.appendChild(el("div", "builder-templates-label", "Start from"));
  const tplGrid = el("div", "builder-template-grid");
  TEMPLATES.forEach((t) => {
    const card = el("button", "builder-template");
    card.type = "button";
    card.appendChild(el("strong", null, t.name));
    card.appendChild(el("span", "builder-template-blurb", t.blurb));
    card.addEventListener("click", () => {
      const p = createProject({ name: t.name, templateId: t.id });
      logEvent("project_started", { title: p.name, subject: "coding" });
      openProject(p.id);
    });
    tplGrid.appendChild(card);
  });
  tplRow.appendChild(tplGrid);
  root.appendChild(tplRow);

  const projects = getProjects();
  const listWrap = el("div", "builder-list-wrap");
  listWrap.appendChild(el("div", "builder-templates-label", `Your sites${projects.length ? ` (${projects.length})` : ""}`));

  if (projects.length === 0) {
    listWrap.appendChild(el("p", "brain-empty-line", "No sites yet. Pick a starting point above and you'll have something on screen immediately."));
  } else {
    const list = el("div", "builder-list");
    projects.forEach((p) => {
      const row = el("div", "builder-row");
      const main = el("div", "builder-row-main");
      main.appendChild(el("div", "builder-row-name", p.name));
      const when = new Date(p.updatedAt);
      main.appendChild(
        el(
          "p",
          "builder-row-meta",
          `Edited ${when.toLocaleDateString([], { month: "short", day: "numeric" })} · ${(p.html || "").length + (p.css || "").length + (p.js || "").length} characters`
        )
      );
      row.appendChild(main);

      const side = el("div", "builder-row-side");
      side.appendChild(button("Open", "btn btn-primary brain-btn-sm", () => openProject(p.id)));
      side.appendChild(
        button("Duplicate", "btn btn-ghost brain-btn-sm", () => {
          duplicateProject(p.id);
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
// Editor
// ---------------------------------------------------------------------------

function editorFor(file, value) {
  const wrap = el("div", "code-editor-pane");
  wrap.dataset.file = file;
  const ta = el("textarea", "code-editor");
  ta.value = value || "";
  ta.spellcheck = false;
  ta.setAttribute("aria-label", `${file.toUpperCase()} editor`);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
    }
  });
  ta.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
  });
  wrap.appendChild(ta);
  editors[file] = ta;
  return wrap;
}

function save() {
  if (!openId) return;
  updateProject(openId, currentCode());
  const stamp = document.getElementById("builderSavedAt");
  if (stamp) stamp.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function refreshPreview() {
  if (!runner) return;
  runner.preview(currentCode());
}

function openProject(id) {
  const project = getProject(id);
  if (!project) return renderList();
  openId = id;
  editors = {};
  root.innerHTML = "";

  const bar = el("div", "builder-bar");
  bar.appendChild(
    button("← All sites", "btn btn-ghost brain-btn-sm", () => {
      save();
      renderList();
    })
  );
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
        "Rename site",
        project.name,
        (name) => {
          if (!name || !name.trim()) return;
          updateProject(id, { name: name.trim() });
          title.textContent = name.trim();
        },
        "Site name"
      );
    })
  );
  tools.appendChild(button("↻ Refresh preview", "btn btn-ghost brain-btn-sm", refreshPreview));
  tools.appendChild(
    button("⬇ Download .html", "btn btn-ghost brain-btn-sm", () => {
      save();
      const fresh = getProject(id);
      const blob = new Blob([exportProjectHtml(fresh)], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(fresh.name || "site").replace(/[^a-z0-9\-_ ]/gi, "").trim() || "site"}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so the download has actually started.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Downloaded — one file, opens in any browser.", "success", 3000);
    })
  );
  bar.appendChild(tools);
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

  const askWrap = el("div", "builder-ask");
  askWrap.appendChild(el("div", "code-panel-label", "Ask H1 about this page"));
  const askRow = el("div", "builder-ask-row");
  const askInput = el("input", "tool-input");
  askInput.type = "text";
  askInput.placeholder = "e.g. how do I centre the heading?";
  askInput.setAttribute("aria-label", "Ask H1 about this page");
  askRow.appendChild(askInput);
  const askBtn = button("Ask", "btn btn-primary brain-btn-sm", () => askAboutCode(askInput, askHost, project.name));
  askRow.appendChild(askBtn);
  askWrap.appendChild(askRow);
  const askHost = el("div", "builder-ask-answer");
  askWrap.appendChild(askHost);
  askInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      askAboutCode(askInput, askHost, project.name);
    }
  });
  previewSide.appendChild(askWrap);

  layout.appendChild(codeSide);
  layout.appendChild(previewSide);
  root.appendChild(layout);

  activeFile = "html";
  tabsRow.children[0].classList.add("active");
  panes.forEach((p) => (p.hidden = p.dataset.file !== "html"));

  runner = createRunner(previewHost);
  refreshPreview();
}

async function askAboutCode(input, host, projectName) {
  const question = input.value.trim();
  if (!question) {
    showToast("Type what you'd like help with first.", "error", 2400);
    return;
  }
  host.innerHTML = "";
  host.appendChild(el("p", "code-hint-loading", "Asking H1…"));

  const code = currentCode();
  // Each file is trimmed so a large project can't push the request past the backend's
  // per-message limit — the student is told when that happens rather than silently losing
  // the part of their code H1 never saw.
  const PER_FILE = 1000;
  const trimmed = [];
  ["html", "css", "js"].forEach((k) => {
    const v = code[k] || "";
    if (!v.trim()) return;
    trimmed.push(`${k.toUpperCase()}:\n${v.slice(0, PER_FILE)}${v.length > PER_FILE ? "\n…(truncated)" : ""}`);
  });
  const wasTrimmed = ["html", "css", "js"].some((k) => (code[k] || "").length > PER_FILE);

  const message =
    `I'm building a web page called "${projectName}" with plain HTML, CSS and JavaScript. ` +
    `Answer my question about it. Show only the small piece of code that needs to change, and say which file it goes in.\n\n` +
    `Question: ${question}\n\n${trimmed.join("\n\n")}`;

  try {
    const reply = await sendChat([{ role: "user", content: message.slice(0, 3800) }], "coding", {
      mode: "tutor",
      language: "en",
    });
    logEvent("question", { source: "web_builder", subject: "coding" });
    host.innerHTML = "";
    const panel = el("div", "code-hint-panel");
    const body = el("div", "code-prose");
    body.innerHTML = renderMarkdown(reply);
    panel.appendChild(body);
    // Copy buttons on each code block — H1 suggests, the student decides what lands in
    // their file.
    body.querySelectorAll("pre").forEach((pre) => {
      const copy = button("Copy", "btn btn-ghost brain-btn-sm code-copy-btn", async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent);
          showToast("Copied.", "success", 1600);
        } catch {
          showToast("Couldn't copy — select the text and copy manually.", "error", 2600);
        }
      });
      pre.appendChild(copy);
    });
    if (wasTrimmed) {
      panel.appendChild(el("p", "builder-trim-note", "Your files are long, so H1 only saw the first part of each one. If the answer looks off, ask about a specific section."));
    }
    host.appendChild(panel);
    input.value = "";
  } catch (err) {
    host.innerHTML = "";
    host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(err)));
  }
}

// ---------------------------------------------------------------------------

export function renderWebBuilder() {
  if (!root) return;
  if (openId && getProject(openId)) return;
  renderList();
}

export function initWebBuilder() {
  if (!root) return;
  renderList();
}

// Saving on the way out means a half-typed change is never lost by navigating away.
export function flushBuilder() {
  if (openId) save();
}
