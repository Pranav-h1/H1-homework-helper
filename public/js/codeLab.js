// Code Lab — the "learn to code" half of H1's coding section.
//
// Every lesson ends in an exercise the student writes and H1 actually runs. The ticks come
// from real checks against the real output (see codeCurriculum.js), never from asking a
// model whether the answer looks right — a green tick that doesn't mean anything is worse
// than no tick at all.
import { TRACKS, getTrack, getLesson, getAllLessons, isPythonTrack } from "./codeCurriculum.js";
import { createRunner } from "./codeRunner.js";
import { createCodeEditor } from "./codeEditor.js";
import { renderPythonCourse, renderPythonLesson, disposePythonLesson } from "./pythonLesson.js";
import { selectSubtabInView } from "./subtabs.js";
import { showChallengeList } from "./challengesView.js";
import {
  getLessonState,
  isComplete,
  isUnlocked,
  saveDraft,
  resetLesson,
  recordAttempt,
  getTrackProgress,
  getOverallProgress,
} from "./codeProgressStore.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { logEvent } from "./progress.js";
import { showToast } from "./toast.js";
import { invalidateBrain } from "./secondBrain.js";
import { isEnabled as gamificationEnabled } from "./gamification.js";

const root = document.getElementById("codeLearnRoot");

let view = { screen: "tracks", trackId: null, lessonId: null };
let editors = {};
let activeFile = "html";
let runner = null;
let lastCheckResults = null;

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

// The curriculum's prose is written in a light markdown, and renderMarkdown is the same
// sanitised renderer the AI answers go through.
function prose(md) {
  const wrap = el("div", "code-prose");
  wrap.innerHTML = renderMarkdown(md);
  return wrap;
}

// Which editors a lesson needs: whatever its starter defines, plus the track's own language,
// so a JavaScript lesson always has a JS tab even when its starter only seeds HTML.
function filesFor(lesson) {
  const primary = lesson.track === "js" ? "js" : lesson.track === "css" ? "css" : "html";
  const set = new Set();
  ["html", "css", "js"].forEach((k) => {
    if (lesson.starter && typeof lesson.starter[k] === "string") set.add(k);
  });
  set.add(primary);
  if (lesson.track === "css") set.add("html");
  return ["html", "css", "js"].filter((k) => set.has(k));
}

const FILE_LABEL = { html: "HTML", css: "CSS", js: "JS" };

function trackLabel(trackId) {
  return (TRACKS.find((t) => t.id === trackId) || {}).label || trackId;
}

function currentCode() {
  return {
    html: editors.html ? editors.html.value : "",
    css: editors.css ? editors.css.value : "",
    js: editors.js ? editors.js.value : "",
  };
}

// The Python course and the web tracks share the track list, but Python has its own screens
// (pythonLesson.js). These are the ways out of them.
const pythonNav = {
  backToTracks: () => {
    view = { screen: "tracks", trackId: null, lessonId: null };
    render();
  },
  backToCourse: () => {
    view = { screen: "lessons", trackId: "py", lessonId: null };
    render();
  },
  openLesson: (id) => {
    view = { screen: "lesson", trackId: "py", lessonId: id };
    render();
    const top = document.getElementById("view-code");
    if (top) top.scrollIntoView({ block: "start" });
  },
  openChallenges: () => showChallengeList(),
};

// ---------------------------------------------------------------------------
// Track list
// ---------------------------------------------------------------------------

function renderTracks() {
  root.innerHTML = "";

  const all = getAllLessons();
  const overall = getOverallProgress(all);
  const head = el("div", "code-hero");
  head.appendChild(el("h2", null, "Learn to code"));
  head.appendChild(
    el(
      "p",
      "code-hero-sub",
      `${TRACKS.length} tracks — ${TRACKS.map((t) => t.label).join(", ").replace(/, ([^,]*)$/, " and $1")} — and ${all.length} lessons. You write real code, H1 runs it for real, and the ticks come from checking what your code actually did, not from guessing whether it looks right.`
    )
  );
  if (overall.done > 0) {
    const bar = el("div", "code-progress");
    const fill = el("div", "code-progress-fill");
    fill.style.width = `${overall.pct}%`;
    bar.appendChild(fill);
    head.appendChild(bar);
    head.appendChild(el("p", "code-progress-label", `${overall.done} of ${overall.total} lessons complete`));
  }
  root.appendChild(head);

  const grid = el("div", "code-track-grid");
  TRACKS.forEach((t) => {
    const lessons = getTrack(t.id);
    const p = getTrackProgress(lessons);
    const card = el("button", `code-track-card${isPythonTrack(t.id) ? " is-python" : ""}`);
    card.type = "button";
    card.appendChild(el("div", "code-track-icon", t.icon));
    card.appendChild(el("h3", null, t.label));
    card.appendChild(el("p", "code-track-blurb", t.blurb));
    const bar = el("div", "code-progress");
    const fill = el("div", "code-progress-fill");
    fill.style.width = `${p.pct}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
    card.appendChild(el("span", "code-track-count", `${p.done} / ${p.total} lessons`));
    card.addEventListener("click", () => {
      view = { screen: "lessons", trackId: t.id, lessonId: null };
      render();
    });
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Lesson list
// ---------------------------------------------------------------------------

function renderLessonList() {
  root.innerHTML = "";
  const track = TRACKS.find((t) => t.id === view.trackId);
  const lessons = getTrack(view.trackId);

  const bar = el("div", "code-crumb");
  bar.appendChild(
    button("← All tracks", "btn btn-ghost brain-btn-sm", () => {
      view = { screen: "tracks", trackId: null, lessonId: null };
      render();
    })
  );
  root.appendChild(bar);

  const head = el("div", "code-hero");
  head.appendChild(el("h2", null, `${track.icon} ${track.label}`));
  head.appendChild(el("p", "code-hero-sub", track.blurb));
  root.appendChild(head);

  const list = el("div", "code-lesson-list");
  lessons.forEach((lesson, i) => {
    const done = isComplete(lesson.id);
    const unlocked = isUnlocked(lessons, i);
    const row = el("div", `code-lesson-row${done ? " done" : ""}${unlocked ? "" : " locked"}`);

    const num = el("div", "code-lesson-num", done ? "✓" : String(i + 1));
    const main = el("div", "code-lesson-main");
    main.appendChild(el("div", "code-lesson-title", lesson.title));
    main.appendChild(el("p", "code-lesson-goal", lesson.goal));
    row.appendChild(num);
    row.appendChild(main);

    if (unlocked) {
      const state = getLessonState(lesson.id);
      const meta = el("div", "code-lesson-side");
      if (done) meta.appendChild(el("span", "code-lesson-tag", "Complete"));
      else if (state.attempts > 0) meta.appendChild(el("span", "code-lesson-tag", "In progress"));
      meta.appendChild(
        button(done ? "Review" : state.attempts > 0 ? "Continue" : "Start", "btn btn-primary brain-btn-sm", () => {
          view = { screen: "lesson", trackId: view.trackId, lessonId: lesson.id };
          render();
        })
      );
      row.appendChild(meta);
    } else {
      const meta = el("div", "code-lesson-side");
      meta.appendChild(el("span", "code-lesson-locked", `Finish "${lessons[i - 1].title}" first`));
      row.appendChild(meta);
    }
    list.appendChild(row);
  });
  root.appendChild(list);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

function editorFor(file, value) {
  const wrap = el("div", "code-editor-pane");
  wrap.dataset.file = file;
  let saveTimer = null;
  const ed = createCodeEditor({
    value: value || "",
    language: file === "js" ? "javascript" : file,
    ariaLabel: `${FILE_LABEL[file] || file.toUpperCase()} editor`,
    onInput: () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveDraft(view.lessonId, currentCode()), 400);
    },
  });
  wrap.appendChild(ed.root);
  editors[file] = ed.textarea;
  return wrap;
}

function setActiveFile(file, tabsRow, panes) {
  activeFile = file;
  [...tabsRow.children].forEach((b) => b.classList.toggle("active", b.dataset.file === file));
  panes.forEach((p) => (p.hidden = p.dataset.file !== file));
  if (editors[file]) editors[file].focus();
}

function renderLesson() {
  root.innerHTML = "";
  editors = {};
  lastCheckResults = null;

  const lesson = getLesson(view.lessonId);
  if (!lesson) {
    view = { screen: "tracks", trackId: null, lessonId: null };
    return render();
  }
  const lessons = getTrack(lesson.track);
  const files = filesFor(lesson);
  const saved = getLessonState(lesson.id);
  const code = saved.code || {};

  const crumb = el("div", "code-crumb");
  crumb.appendChild(
    button(`← ${TRACKS.find((t) => t.id === lesson.track).label} lessons`, "btn btn-ghost brain-btn-sm", () => {
      view = { screen: "lessons", trackId: lesson.track, lessonId: null };
      render();
    })
  );
  crumb.appendChild(el("span", "code-crumb-step", `Lesson ${lesson.index + 1} of ${lessons.length}`));
  root.appendChild(crumb);

  const layout = el("div", "code-lesson-layout");

  // --- Left: teaching -------------------------------------------------------
  const left = el("div", "code-teach");
  left.appendChild(el("h2", "code-lesson-heading", lesson.title));
  left.appendChild(el("p", "code-lesson-goal-big", lesson.goal));
  left.appendChild(prose(lesson.concept || ""));

  if (lesson.example) {
    const ex = el("div", "code-example");
    ex.appendChild(el("div", "code-example-label", "Example"));
    const pre = el("pre", "code-example-pre");
    pre.appendChild(el("code", null, [lesson.example.html, lesson.example.css, lesson.example.js].filter(Boolean).join("\n\n")));
    ex.appendChild(pre);
    left.appendChild(ex);
  }

  const taskBox = el("div", "code-task");
  taskBox.appendChild(el("div", "code-task-label", "Your turn"));
  taskBox.appendChild(prose(lesson.task || ""));
  left.appendChild(taskBox);

  const hintHost = el("div", "code-hint-host");
  left.appendChild(hintHost);
  left.appendChild(
    (() => {
      const row = el("div", "code-hint-actions");
      row.appendChild(button("Stuck? Ask H1 for a hint", "btn btn-ghost brain-btn-sm", () => askForHint(lesson, hintHost, false)));
      row.appendChild(button("Explain this lesson differently", "btn btn-ghost brain-btn-sm", () => askForHint(lesson, hintHost, true)));
      return row;
    })()
  );

  // --- Right: editor, preview, results -------------------------------------
  const right = el("div", "code-work");

  const tabsRow = el("div", "code-file-tabs");
  const panes = [];
  files.forEach((f) => {
    const tab = el("button", "code-file-tab", FILE_LABEL[f] || f.toUpperCase());
    tab.type = "button";
    tab.dataset.file = f;
    tabsRow.appendChild(tab);
    const pane = editorFor(f, code[f] !== undefined ? code[f] : (lesson.starter && lesson.starter[f]) || "");
    panes.push(pane);
  });
  right.appendChild(tabsRow);
  panes.forEach((p) => right.appendChild(p));
  [...tabsRow.children].forEach((tab) => {
    tab.addEventListener("click", () => setActiveFile(tab.dataset.file, tabsRow, panes));
  });

  const actions = el("div", "code-actions");
  const runBtn = button("▶ Run", "btn btn-ghost", () => doRun(lesson, resultHost, previewHost, consoleHost, false));
  const checkBtn = button("Check my work", "btn btn-primary", () => doRun(lesson, resultHost, previewHost, consoleHost, true));
  actions.appendChild(runBtn);
  actions.appendChild(checkBtn);
  actions.appendChild(
    button("Reset to starter", "btn btn-ghost brain-btn-sm", () => {
      resetLesson(lesson.id);
      render();
      showToast("Back to the starter code. Your completion is kept.", "success", 2400);
    })
  );
  right.appendChild(actions);

  // A JavaScript-only lesson produces no page, so an empty white preview box would just look
  // broken. The frame still has to exist (that's where the code runs), so it's kept out of
  // sight rather than skipped.
  const showsPage = files.includes("html");
  const previewLabel = el("div", "code-panel-label", "Preview");
  previewLabel.hidden = !showsPage;
  right.appendChild(previewLabel);
  const previewHost = el("div", "code-preview");
  previewHost.hidden = !showsPage;
  right.appendChild(previewHost);

  const consoleLabel = el("div", "code-panel-label", "Console");
  right.appendChild(consoleLabel);
  const consoleHost = el("div", "code-console");
  consoleHost.appendChild(el("p", "code-console-empty", "Press Run to see output here."));
  right.appendChild(consoleHost);

  const resultHost = el("div", "code-results");
  right.appendChild(resultHost);

  layout.appendChild(left);
  layout.appendChild(right);
  root.appendChild(layout);

  runner = createRunner(previewHost);
  setActiveFile(files[0], tabsRow, panes);
  // Show the page as it currently stands, without marking anything.
  doRun(lesson, resultHost, previewHost, consoleHost, false, true);
}

async function doRun(lesson, resultHost, previewHost, consoleHost, withChecks, quiet) {
  const code = currentCode();

  if (!runner) runner = createRunner(previewHost);

  if (!withChecks) {
    // A plain Run still needs the harness so the console panel has something to show.
    const res = await runner.run({ ...code, checks: [] });
    renderConsole(consoleHost, res);
    if (!quiet) resultHost.innerHTML = "";
    return;
  }

  resultHost.innerHTML = "";
  resultHost.appendChild(el("p", "code-checking", "Running your code…"));

  const res = await runner.run({ ...code, checks: lesson.checks || [] });
  renderConsole(consoleHost, res);
  lastCheckResults = res.checks;

  const outcome = recordAttempt(lesson, res.checks);
  invalidateBrain();
  renderResults(resultHost, lesson, res, outcome);
}

function renderConsole(host, res) {
  host.innerHTML = "";
  const lines = res.logs || [];
  const errors = res.errors || [];
  if (lines.length === 0 && errors.length === 0) {
    host.appendChild(el("p", "code-console-empty", "No output. (Nothing called console.log, and nothing went wrong.)"));
    return;
  }
  lines.forEach((l) => {
    const row = el("div", `code-console-line ${l.level}`);
    row.textContent = l.text;
    host.appendChild(row);
  });
  errors.forEach((e) => {
    const row = el("div", "code-console-line error");
    row.textContent = e.line ? `Error on line ${e.line}: ${e.message}` : `Error: ${e.message}`;
    host.appendChild(row);
  });
}

function renderResults(host, lesson, res, outcome) {
  host.innerHTML = "";

  const summary = el("div", `code-result-summary${outcome.allPassed ? " passed" : ""}`);
  summary.appendChild(
    el("strong", null, outcome.allPassed ? "All checks passed" : `${outcome.passed} of ${outcome.total} checks passed`)
  );
  if (outcome.justCompleted) {
    summary.appendChild(el("span", "code-result-note", `Lesson complete${gamificationEnabled() ? " — XP earned" : ""}.`));
  } else if (outcome.allPassed) {
    summary.appendChild(el("span", "code-result-note", "Already complete — nice to see it still works."));
  } else if (outcome.firstResult) {
    summary.appendChild(el("span", "code-result-note", "This first attempt is the one recorded in your Learning Brain. Keep going — retries aren't counted against you."));
  }
  host.appendChild(summary);

  const list = el("div", "code-check-list");
  (res.checks || []).forEach((c) => {
    const row = el("div", `code-check${c.passed ? " passed" : ""}`);
    row.appendChild(el("span", "code-check-mark", c.passed ? "✓" : "✗"));
    const main = el("div", "code-check-main");
    main.appendChild(el("span", "code-check-label", c.label));
    if (!c.passed && c.hint) main.appendChild(el("p", "code-check-hint", c.hint));
    if (c.error) main.appendChild(el("p", "code-check-hint", `The check couldn't run: ${c.error}`));
    row.appendChild(main);
    list.appendChild(row);
  });
  host.appendChild(list);

  if (outcome.justCompleted) {
    const lessons = getTrack(lesson.track);
    const next = lessons[lesson.index + 1];
    const row = el("div", "code-next-row");
    if (next) {
      row.appendChild(
        button(`Next: ${next.title} →`, "btn btn-primary", () => {
          view = { screen: "lesson", trackId: lesson.track, lessonId: next.id };
          render();
        })
      );
    } else {
      row.appendChild(el("span", "code-result-note", `That's the whole ${trackLabel(lesson.track)} track finished.`));
      row.appendChild(
        button("Back to tracks", "btn btn-ghost", () => {
          view = { screen: "tracks", trackId: null, lessonId: null };
          render();
        })
      );
    }
    host.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// AI help — a nudge, never the answer
// ---------------------------------------------------------------------------

async function askForHint(lesson, host, reexplain) {
  host.innerHTML = "";
  host.appendChild(el("p", "code-hint-loading", reexplain ? "Asking H1 to explain it another way…" : "Asking H1 for a hint…"));

  const code = currentCode();
  const failing = (lastCheckResults || []).filter((c) => !c.passed).map((c) => c.label);

  const message = reexplain
    ? `I'm learning ${trackLabel(lesson.track)}. Explain this idea to me in a different way, with a small example:\n\n` +
      `Lesson: ${lesson.title}\n${lesson.goal}\n\n${lesson.concept}`
    : `I'm stuck on a coding exercise. Give me ONE specific hint that points at what to change — do NOT write the ` +
      `solution for me, and do not paste corrected code.\n\n` +
      `Task: ${lesson.task}\n\n` +
      (failing.length ? `Checks still failing: ${failing.join("; ")}\n\n` : "") +
      `My code right now:\n\n` +
      ["html", "css", "js"].filter((k) => code[k] && code[k].trim()).map((k) => `${k.toUpperCase()}:\n${code[k]}`).join("\n\n");

  try {
    const reply = await sendChat([{ role: "user", content: message.slice(0, 3800) }], "coding", {
      mode: reexplain ? "beginner" : "examcoach",
      language: "en",
    });
    logEvent("question", { source: "code_lab", subject: "coding", topic: lesson.title });
    host.innerHTML = "";
    const panel = el("div", "code-hint-panel");
    panel.appendChild(el("div", "code-hint-label", reexplain ? "Another way to look at it" : "Hint"));
    const body = el("div", "code-prose");
    body.innerHTML = renderMarkdown(reply);
    panel.appendChild(body);
    host.appendChild(panel);
  } catch (err) {
    host.innerHTML = "";
    host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(err)));
  }
}

// ---------------------------------------------------------------------------

function render() {
  if (!root) return;
  disposePythonLesson();
  if (view.screen === "tracks") return renderTracks();
  if (isPythonTrack(view.trackId)) {
    if (view.screen === "lessons") return renderPythonCourse(root, pythonNav);
    return renderPythonLesson(root, view.lessonId, pythonNav);
  }
  if (view.screen === "lessons") return renderLessonList();
  return renderLesson();
}

export function renderCodeLab() {
  // Coming back to Code Lab shouldn't restart an open Python lesson (and stop whatever it was
  // running); the course page is re-rendered so its progress is current.
  if (view.screen === "lesson" && isPythonTrack(view.trackId) && root.querySelector(".pyw")) return;
  render();
}

export function initCodeLab() {
  if (!root) return;
  render();
}

// Lets the command palette and the Learning Brain drop someone straight into a track.
export function openTrack(trackId) {
  view = { screen: "lessons", trackId, lessonId: null };
  render();
}

// For search and the command palette: straight into one lesson.
export function openLessonById(lessonId) {
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  selectSubtabInView("code", "learn");
  view = { screen: "lesson", trackId: lesson.track, lessonId: lesson.id };
  render();
  return true;
}
