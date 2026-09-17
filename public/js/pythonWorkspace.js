// The Python workspace: one editor-and-output component used everywhere Python runs in H1 —
// lessons, challenges, projects, and code opened from the AI Tutor.
//
// Output and errors are separate panels on purpose. A beginner's first job when something goes
// wrong is telling "my program printed this" apart from "Python stopped my program", and one
// mixed log makes that harder. Errors get a plain-English explanation (pythonErrors.js) *and*
// the real traceback: the explanation helps today, reading real tracebacks is the skill.
import { createCodeEditor } from "./codeEditor.js";
import { getSharedPythonRunner, onPythonBoot, getPythonBootStage, disposeSharedPythonRunner, hasSharedPythonRunner } from "./pythonRunner.js";
import { explainPythonError } from "./pythonErrors.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { decorateCodeBlocks } from "./codeBlocks.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";

const SAVE_DEBOUNCE_MS = 450;
// A Python worker holds tens of megabytes. Once no workspace has been on screen for this long,
// it's released; the next Run boots again from the browser cache in a couple of seconds.
const IDLE_RELEASE_MS = 3 * 60 * 1000;

// Errors that come from H1 rather than from Python running the student's code, with the badge
// a student should see instead of an internal name.
const SYSTEM_BADGES = { Timeout: "Stopped", LoadError: "Offline", WorkerError: "Restarted" };

const mounted = new Set();
let sweeper = null;
let lastVisibleAt = Date.now();

function isOnScreen(node) {
  return node.isConnected && node.getClientRects().length > 0;
}

function startSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    [...mounted].forEach((n) => {
      if (!n.isConnected) mounted.delete(n);
    });
    const running = hasSharedPythonRunner() && getSharedPythonRunner().isRunning();
    if ([...mounted].some(isOnScreen) || running) {
      lastVisibleAt = Date.now();
      return;
    }
    if (Date.now() - lastVisibleAt > IDLE_RELEASE_MS) {
      disposeSharedPythonRunner();
      if (mounted.size === 0) {
        clearInterval(sweeper);
        sweeper = null;
      }
    }
  }, 30000);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function btn(label, className, onClick, { title, icon } = {}) {
  const b = el("button", className);
  b.type = "button";
  if (icon) {
    const i = el("span", "pyw-ico");
    i.setAttribute("aria-hidden", "true");
    i.innerHTML = icon;
    b.appendChild(i);
  }
  b.appendChild(el("span", "pyw-btn-label", label));
  if (title) b.title = title;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

const ICONS = {
  play: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  expand: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>',
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function countLines(text) {
  const t = String(text || "").replace(/\n$/, "");
  return t ? t.split("\n").length : 0;
}

// "name 'total' is not defined" while evaluating a check means the variable the check looks for
// was never created — which is worth saying in those words.
function friendlyCheckError(error) {
  const m = /NameError: name '([^']+)' is not defined/.exec(error || "");
  if (m) return `Couldn't find \`${m[1]}\` — make sure your code creates it with exactly that name.`;
  return `This check couldn't run: ${error}`;
}

function codeInline(text) {
  const c = el("code", "pyw-inline-code", text);
  return c;
}

// The check list, shared by lessons, challenges and anything else with tests.
export function renderCheckList(host, checks) {
  const list = el("div", "code-check-list");
  (checks || []).forEach((c) => {
    const row = el("div", `code-check${c.passed ? " passed" : ""}`);
    row.appendChild(el("span", "code-check-mark", c.passed ? "✓" : "✗"));
    const main = el("div", "code-check-main");
    main.appendChild(el("span", "code-check-label", c.label));
    if (c.stdin !== undefined && c.stdin !== null) {
      const inp = el("p", "code-check-stdin");
      inp.appendChild(document.createTextNode("With input: "));
      String(c.stdin)
        .split("\n")
        .forEach((line, i) => {
          if (i) inp.appendChild(document.createTextNode(" ⏎ "));
          inp.appendChild(codeInline(line || " "));
        });
      main.appendChild(inp);
    }
    if (!c.passed && c.actual !== undefined && c.actual !== null) {
      const cmp = el("div", "code-check-compare");
      const exp = el("div", "code-check-cmp-row");
      exp.appendChild(el("span", "code-check-cmp-k", "Expected"));
      exp.appendChild(codeInline(String(c.expected)));
      const got = el("div", "code-check-cmp-row got");
      got.appendChild(el("span", "code-check-cmp-k", "Got"));
      got.appendChild(codeInline(String(c.actual)));
      cmp.appendChild(exp);
      cmp.appendChild(got);
      main.appendChild(cmp);
    }
    if (!c.passed && c.hint) main.appendChild(el("p", "code-check-hint", c.hint));
    if (!c.passed && c.error) main.appendChild(el("p", "code-check-hint", friendlyCheckError(c.error)));
    row.appendChild(main);
    list.appendChild(row);
  });
  host.appendChild(list);
  return list;
}

/**
 * options:
 *   code, stdin, files        initial program, Input box contents, files the program can open
 *   checks                    tests to run on "Check" (omit for a plain runner)
 *   checkLabel                label for the check button
 *   fileName                  shown above the editor
 *   context                   () => string: what the student is working on, for "Ask H1"
 *   onChange({code, stdin})   called (debounced) after edits; the workspace shows "Saved"
 *   onRun(result)             after a plain Run
 *   onCheck(result, host)     after Check; render into host (defaults to the check list)
 *   extraTools                extra toolbar buttons
 */
export function createPythonWorkspace(options = {}) {
  const {
    code = "",
    stdin = "",
    files = null,
    checks = null,
    checkLabel = "Check my work",
    fileName = "main.py",
    context = null,
    onChange = null,
    onRun = null,
    onCheck = null,
    extraTools = [],
    editorHeight = null,
  } = options;

  let currentChecks = checks;
  const runner = getSharedPythonRunner();
  let running = false;
  let disposed = false;

  const root = el("div", "pyw");
  mounted.add(root);
  startSweeper();

  // --- Top bar ---------------------------------------------------------------
  const bar = el("div", "pyw-bar");
  const fileTag = el("div", "pyw-file");
  fileTag.appendChild(el("span", "pyw-file-dot"));
  fileTag.appendChild(el("span", "pyw-file-name", fileName));
  const saved = el("span", "pyw-saved");
  saved.setAttribute("aria-live", "polite");
  fileTag.appendChild(saved);
  bar.appendChild(fileTag);

  const tools = el("div", "pyw-tools");
  extraTools.forEach((t) => tools.appendChild(t));
  const copyBtn = btn("Copy", "pyw-tool", async () => {
    const ok = await copyText(editor.getValue());
    showToast(ok ? "Code copied." : "Couldn't copy — select the code and copy it manually.", ok ? "success" : "error", 1800);
  }, { icon: ICONS.copy, title: "Copy code" });
  const fsBtn = btn("Fullscreen", "pyw-tool", () => setFullscreen(!root.classList.contains("is-fullscreen")), { icon: ICONS.expand, title: "Fullscreen editor" });
  tools.appendChild(copyBtn);
  tools.appendChild(fsBtn);
  bar.appendChild(tools);
  root.appendChild(bar);

  const grid = el("div", "pyw-grid");
  const left = el("div", "pyw-left");
  const right = el("div", "pyw-right");
  grid.appendChild(left);
  grid.appendChild(right);
  root.appendChild(grid);

  // --- Editor ----------------------------------------------------------------
  let saveTimer = null;
  let dirty = false;
  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!dirty || !onChange) return;
    dirty = false;
    try {
      onChange({ code: editor.getValue(), stdin: stdinBox.value });
      saved.textContent = "Saved";
      saved.classList.add("is-on");
    } catch {
      saved.textContent = "Couldn't save";
    }
  }
  function queueSave() {
    if (!onChange) return;
    dirty = true;
    saved.textContent = "Saving…";
    saved.classList.add("is-on");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }

  const editor = createCodeEditor({
    value: code,
    language: "python",
    ariaLabel: `${fileName} — Python editor`,
    onInput: () => {
      queueSave();
      syncInputVisibility();
    },
    onRun: () => (currentChecks && currentChecks.length ? run(true) : run(false)),
    className: "pyw-editor",
  });
  if (editorHeight) editor.root.style.setProperty("--ce-height", editorHeight);
  left.appendChild(editor.root);

  // --- Actions ---------------------------------------------------------------
  const actions = el("div", "pyw-actions");
  const runBtn = btn("Run", "btn btn-ghost pyw-run", () => run(false), { icon: ICONS.play, title: "Run (Ctrl+Enter)" });
  const stopBtn = btn("Stop", "btn btn-ghost pyw-stop", () => stop(), { icon: ICONS.stop, title: "Stop the running program" });
  stopBtn.hidden = true;
  actions.appendChild(runBtn);
  actions.appendChild(stopBtn);
  const checkBtn = btn(checkLabel, "btn btn-primary pyw-check", () => run(true), { icon: ICONS.check, title: "Run the tests (Ctrl+Enter)" });
  actions.appendChild(checkBtn);
  checkBtn.hidden = !(currentChecks && currentChecks.length);
  const status = el("span", "pyw-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  actions.appendChild(status);
  const kbd = el("span", "pyw-kbd", "Ctrl + Enter");
  kbd.setAttribute("aria-hidden", "true");
  actions.appendChild(kbd);
  left.appendChild(actions);

  // --- Input -----------------------------------------------------------------
  const inputWrap = el("details", "pyw-input");
  const inputSummary = el("summary", "pyw-input-summary");
  inputSummary.appendChild(el("span", "pyw-input-title", "Input"));
  const inputCount = el("span", "pyw-input-count");
  inputSummary.appendChild(inputCount);
  inputWrap.appendChild(inputSummary);
  inputWrap.appendChild(el("p", "pyw-input-note", "Each line is the answer to one input() call, in order."));
  const stdinBox = el("textarea", "pyw-stdin");
  stdinBox.rows = 3;
  stdinBox.spellcheck = false;
  stdinBox.value = stdin || "";
  stdinBox.setAttribute("aria-label", "Program input, one line per input() call");
  stdinBox.placeholder = "Type the answers your program asks for, one per line";
  stdinBox.addEventListener("input", () => {
    updateInputCount();
    queueSave();
  });
  inputWrap.appendChild(stdinBox);
  left.appendChild(inputWrap);

  function updateInputCount() {
    const n = countLines(stdinBox.value);
    inputCount.textContent = n ? `${n} line${n === 1 ? "" : "s"}` : "empty";
  }
  // The box only earns its space once the program actually reads input.
  function syncInputVisibility() {
    const needed = /\binput\s*\(/.test(editor.getValue()) || stdinBox.value.trim() !== "";
    inputWrap.hidden = !needed;
  }
  updateInputCount();
  syncInputVisibility();
  if (stdinBox.value.trim()) inputWrap.open = true;

  // --- Files -----------------------------------------------------------------
  if (files && Object.keys(files).length) {
    const fw = el("div", "pyw-files");
    fw.appendChild(el("span", "pyw-files-label", "Files your code can open"));
    const chips = el("div", "pyw-file-chips");
    const preview = el("pre", "pyw-file-preview");
    preview.hidden = true;
    Object.entries(files).forEach(([name, content]) => {
      const chip = btn(name, "pyw-file-chip", () => {
        const showing = !preview.hidden && preview.dataset.name === name;
        preview.hidden = showing;
        preview.dataset.name = name;
        preview.textContent = content;
        [...chips.children].forEach((c) => c.classList.toggle("active", !showing && c === chip));
        chip.setAttribute("aria-expanded", String(!showing));
      });
      chip.setAttribute("aria-expanded", "false");
      chips.appendChild(chip);
    });
    fw.appendChild(chips);
    fw.appendChild(preview);
    fw.appendChild(el("p", "pyw-input-note", "Every run starts with these files exactly as shown, so a run that changes them can't break the next one."));
    left.appendChild(fw);
  }

  // --- Output / error / results ---------------------------------------------
  const outPanel = el("section", "pyw-panel pyw-output");
  const outHead = el("div", "pyw-panel-head");
  outHead.appendChild(el("span", "pyw-panel-title", "Output"));
  const outMeta = el("span", "pyw-panel-meta");
  outHead.appendChild(outMeta);
  outPanel.appendChild(outHead);
  // Not a live region: a program printing hundreds of lines would all be read out. The status
  // line announces that the run finished; the output is there to read.
  const outBody = el("pre", "pyw-out");
  outBody.tabIndex = 0;
  outBody.setAttribute("aria-label", "Program output");
  outPanel.appendChild(outBody);
  right.appendChild(outPanel);

  const errPanel = el("section", "pyw-panel pyw-error");
  errPanel.hidden = true;
  right.appendChild(errPanel);

  const resultsHost = el("div", "pyw-results");
  right.appendChild(resultsHost);

  function showPlaceholder(text) {
    outBody.innerHTML = "";
    outBody.appendChild(el("span", "pyw-out-empty", text));
  }

  // --- Boot status -----------------------------------------------------------
  function bootText(stage) {
    if (stage === "downloading") return "Downloading Python — one time only, then it's cached…";
    if (stage === "starting") return "Starting Python…";
    if (stage === "ready") return "Python ready";
    if (stage === "failed") return "Python couldn't load. It needs an internet connection the first time.";
    return "";
  }
  // Once a run has reported something ("Stopped", "Error on line 3"), that stays on screen: the
  // quiet restart that follows a Stop or a timeout mustn't replace it with "Starting Python…".
  let showingRunResult = false;
  const unsubscribe = onPythonBoot((stage) => {
    if (disposed) return;
    if (showingRunResult && stage !== "failed") return;
    if (!running) {
      status.textContent = bootText(stage);
      status.dataset.state = stage === "failed" ? "error" : stage === "ready" ? "ready" : "busy";
    }
  });
  const initialStage = getPythonBootStage();
  status.textContent = initialStage ? bootText(initialStage.stage) : "Loading Python…";
  status.dataset.state = initialStage && initialStage.stage === "ready" ? "ready" : "busy";
  showPlaceholder("Press Run to see what your program prints.");
  runner.warmup();

  // --- Running ---------------------------------------------------------------
  function setRunning(on) {
    running = on;
    root.classList.toggle("is-running", on);
    runBtn.disabled = on;
    checkBtn.disabled = on;
    stopBtn.hidden = !on;
    if (on) {
      status.dataset.state = "busy";
      status.textContent = runner.isReady() ? "Running…" : "Starting Python…";
    }
  }

  function stop() {
    if (!running) return;
    runner.stop();
  }

  async function run(withChecks) {
    if (running || disposed) return null;
    flushSave();
    const source = editor.getValue();
    editor.markLine(null);
    errPanel.hidden = true;
    errPanel.innerHTML = "";
    if (withChecks) resultsHost.innerHTML = "";
    setRunning(true);
    outMeta.textContent = "";
    showPlaceholder(runner.isReady() ? "Running…" : "Starting Python — the first run takes a few seconds…");

    const res = await runner.run({
      code: source,
      stdin: stdinBox.value,
      files: files || null,
      checks: withChecks ? currentChecks || [] : [],
    });
    if (disposed) return res;
    setRunning(false);
    showingRunResult = true;

    // Output
    outBody.innerHTML = "";
    if (res.stopped) {
      showPlaceholder("Stopped. Python was restarted, so the next run starts fresh.");
      status.textContent = "Stopped";
      status.dataset.state = "idle";
    } else if (res.output) {
      outBody.textContent = res.output;
      if (res.truncated) outBody.appendChild(el("span", "pyw-out-empty", "\n… output cut off here — your program printed more than can be shown."));
    } else if (!res.error) {
      showPlaceholder("Your program ran, but didn't print anything. Use print() to show a value.");
    } else {
      showPlaceholder("Nothing was printed before the error.");
    }
    if (!res.stopped) {
      outMeta.textContent = res.elapsedMs ? `${res.elapsedMs} ms` : "";
      if (res.error) {
        status.textContent = res.error.line
          ? `Error on line ${res.error.line}`
          : res.error.type === "LoadError"
            ? "Python couldn't load"
            : res.error.type === "Timeout"
              ? "Stopped after 10 seconds"
              : "Error";
        status.dataset.state = "error";
      } else {
        status.textContent = "Ran successfully";
        status.dataset.state = "ok";
      }
    }

    // Error
    if (res.error && !res.stopped) renderError(res.error, source);

    if (withChecks && !res.stopped) {
      resultsHost.innerHTML = "";
      if (onCheck) onCheck(res, resultsHost);
      else renderCheckList(resultsHost, res.checks);
    } else if (!withChecks && onRun) {
      onRun(res);
    }
    return res;
  }

  function renderError(err, source) {
    const info = explainPythonError(err);
    errPanel.innerHTML = "";
    errPanel.hidden = false;
    if (err.line) editor.markLine(err.line);

    const head = el("div", "pyw-err-head");
    const badge = el("span", "pyw-err-type", SYSTEM_BADGES[err.type] || err.type || "Error");
    head.appendChild(badge);
    head.appendChild(el("strong", "pyw-err-title", info.title));
    errPanel.appendChild(head);

    const real = el("div", "pyw-err-real");
    real.appendChild(el("code", "pyw-err-msg", err.message));
    if (err.line) {
      const where = el("div", "pyw-err-where");
      where.appendChild(document.createTextNode(`Line ${err.line}`));
      if (err.codeLine) {
        where.appendChild(document.createTextNode(": "));
        where.appendChild(el("code", null, err.codeLine));
      }
      const go = btn("Show me", "pyw-link", () => editor.goToLine(err.line));
      go.setAttribute("aria-label", `Go to line ${err.line} in the editor`);
      where.appendChild(go);
      real.appendChild(where);
    }
    errPanel.appendChild(real);

    const dl = el("dl", "pyw-err-explain");
    [
      ["What happened", info.what],
      ["Why", info.why],
      ["How to fix it", info.fix],
    ].forEach(([k, v]) => {
      if (!v) return;
      dl.appendChild(el("dt", null, k));
      const dd = el("dd", "code-prose");
      dd.innerHTML = renderMarkdown(v);
      dl.appendChild(dd);
    });
    errPanel.appendChild(dl);

    if (err.traceback) {
      const det = el("details", "pyw-err-tb");
      det.appendChild(el("summary", null, "Full error from Python"));
      det.appendChild(el("pre", null, err.traceback.trimEnd()));
      errPanel.appendChild(det);
    }

    const askRow = el("div", "pyw-err-actions");
    const aiHost = el("div", "pyw-err-ai");
    // Problems with H1 itself (Python not loading, the worker crashing) aren't in the student's
    // code, so there's nothing for H1 to explain about it — the panel says what to do instead.
    if (!SYSTEM_BADGES[err.type] || err.type === "Timeout") {
      const askBtn = btn("Ask H1 to explain this error", "btn btn-ghost brain-btn-sm", () => askAboutError(err, source, aiHost, askBtn), { icon: ICONS.spark });
      askRow.appendChild(askBtn);
    }
    if (err.type === "EOFError") {
      askRow.appendChild(
        btn("Open the Input box", "btn btn-ghost brain-btn-sm", () => {
          inputWrap.hidden = false;
          inputWrap.open = true;
          stdinBox.focus();
        })
      );
    }
    errPanel.appendChild(askRow);
    errPanel.appendChild(aiHost);
  }

  async function askAboutError(err, source, host, askBtn) {
    askBtn.disabled = true;
    host.innerHTML = "";
    host.appendChild(el("p", "code-hint-loading", "Asking H1…"));
    const about = typeof context === "function" ? context() : "";
    const message =
      `I'm learning Python and my program (attached as ${fileName}) stopped with this error:\n\n${err.message}` +
      (err.line ? `\n(line ${err.line}${err.codeLine ? `: ${err.codeLine}` : ""})` : "") +
      `\n\nExplain it for a beginner: what the error means, why it happened in MY code specifically, and how to fix it. ` +
      `Point at the exact line. Show only the lines that need to change — don't rewrite my whole program.` +
      (about ? `\n\nWhat I'm trying to do: ${about}` : "");
    try {
      const reply = await sendChat(
        [{ role: "user", content: message.slice(0, 3900), documents: [{ name: fileName, text: source }] }],
        "coding",
        { mode: "beginner", language: "en" }
      );
      logEvent("question", { source: "python_error", subject: "coding", topic: err.type || "Python error" });
      if (disposed) return;
      host.innerHTML = "";
      const panel = el("div", "code-hint-panel");
      panel.appendChild(el("div", "code-hint-label", "H1 explains"));
      const body = el("div", "code-prose");
      body.innerHTML = renderMarkdown(reply);
      decorateCodeBlocks(body, { runPython: false });
      panel.appendChild(body);
      host.appendChild(panel);
    } catch (e) {
      host.innerHTML = "";
      host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(e)));
    } finally {
      askBtn.disabled = false;
    }
  }

  // --- Fullscreen ------------------------------------------------------------
  function onKey(e) {
    // Escape inside the editor belongs to the editor (it's how keyboard users leave the Tab
    // trap), so fullscreen only closes on Escape from anywhere else.
    if (e.key === "Escape" && root.classList.contains("is-fullscreen") && !e.target.classList.contains("ce-input")) {
      setFullscreen(false);
    }
  }
  function setFullscreen(on) {
    root.classList.toggle("is-fullscreen", on);
    document.body.classList.toggle("pyw-fullscreen-open", on);
    fsBtn.querySelector(".pyw-btn-label").textContent = on ? "Exit fullscreen" : "Fullscreen";
    fsBtn.querySelector(".pyw-ico").innerHTML = on ? ICONS.shrink : ICONS.expand;
    if (on) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
    editor.refresh();
    editor.focus();
  }

  function dispose() {
    if (disposed) return;
    flushSave();
    if (running) runner.stop();
    disposed = true;
    unsubscribe();
    mounted.delete(root);
    if (root.classList.contains("is-fullscreen")) {
      document.body.classList.remove("pyw-fullscreen-open");
      document.removeEventListener("keydown", onKey);
    }
  }

  return {
    root,
    editor,
    run: () => run(false),
    check: () => run(true),
    stop,
    flush: flushSave,
    dispose,
    getCode: () => editor.getValue(),
    setCode: (v) => {
      editor.setValue(v);
      syncInputVisibility();
    },
    getStdin: () => stdinBox.value,
    setStdin: (v) => {
      stdinBox.value = v || "";
      updateInputCount();
      syncInputVisibility();
    },
    setChecks: (c) => {
      currentChecks = c;
      checkBtn.hidden = !(c && c.length);
    },
    isRunning: () => running,
    resultsHost,
  };
}

// Runs a short snippet (a lesson's example) and returns what it printed — for inline "Run
// example" panels that shouldn't disturb the student's own editor.
export async function runSnippet(code, { stdin = "", files = null } = {}) {
  const runner = getSharedPythonRunner();
  return runner.run({ code, stdin, files, checks: [] });
}
