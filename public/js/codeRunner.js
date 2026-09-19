// Runs student code for real, in an iframe that can't touch H1.
//
// The sandbox attribute is "allow-scripts" and deliberately NOT "allow-same-origin". Those
// two together would be worth nothing — the combination lets the frame reach back out and
// remove its own sandbox. Without allow-same-origin the frame gets a unique opaque origin,
// so student code cannot read H1's localStorage, cookies or DOM, and a student pasting
// something they found online can't quietly wipe their own notes.
//
// Everything the parent learns about a run therefore comes back over postMessage: console
// output, errors, and the result of each exercise check. The checks run *inside* the frame
// for the same reason — the parent has no access to the frame's document and shouldn't.
//
// The frame loads /sandbox.html and is handed the document to run over postMessage, rather than
// being given it directly as `srcdoc`. A srcdoc frame inherits the parent page's
// Content-Security-Policy, and H1's pages now forbid inline scripts and eval — which is exactly
// what a student's page is made of. Loading a real page gives the preview its own policy.
const RUN_TIMEOUT_MS = 4000;
const MAX_LOGS = 200;
const MAX_LOG_CHARS = 2000;
// A loop gets this long in total before it aborts itself. Generous for anything a lesson
// asks for, short enough that a runaway loop is an inconvenience rather than a lost session.
const LOOP_BUDGET_MS = 2500;

let runSeq = 0;

// ---------------------------------------------------------------------------
// Loop protection
//
// This exists because of something measured, not assumed: a sandboxed srcdoc iframe running
// `while (true) {}` freezes the ENTIRE tab, parent included. The parent's own timeout can't
// save it — the parent's timers never fire either. So a student forgetting `i++`, which is
// about the most common beginner mistake there is, would take H1 down with their exercise
// and lose whatever they hadn't saved.
//
// The fix is to make the loop stop itself. A guard call is spliced into every loop's
// CONDITION rather than its body, because a condition is evaluated on every iteration whether
// or not the body has braces — `for (;;) x();` is protected the same as a braced loop, with
// no need to work out where a braceless body ends.
// ---------------------------------------------------------------------------

// Replaces string, template and comment contents with filler of identical length, so the
// scanner below can't mistake the word "for" inside a sentence for a loop keyword. Positions
// are preserved exactly, so indexes found here apply to the original source.
function maskLiterals(src) {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      out[i] = out[i + 1] = " ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) out[i] = out[i + 1] = " ", (i += 2);
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out[i] = " ";
          if (i + 1 < n && src[i + 1] !== "\n") out[i + 1] = " ";
          i += 2;
          continue;
        }
        if (src[i] === quote) break;
        if (src[i] !== "\n") out[i] = " ";
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return out.join("");
}

// Index of the ')' matching the '(' at `open`, or -1.
function matchParen(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "(") depth++;
    else if (masked[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Top-level ';' positions inside a for-header, ignoring nested parens/brackets/braces.
function topLevelSemicolons(masked, from, to) {
  const found = [];
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === ";" && depth === 0) found.push(i);
  }
  return found;
}

export function injectLoopGuard(js) {
  if (!js || !/\b(while|for)\b/.test(js)) return js;
  const masked = maskLiterals(js);
  const edits = [];
  const re = /\b(while|for)\b/g;
  let m;

  while ((m = re.exec(masked)) !== null) {
    const kw = m[1];
    const kwEnd = m.index + kw.length;
    // A property called .for / .while isn't a loop.
    const before = masked.slice(0, m.index).replace(/\s+$/, "");
    if (before.endsWith(".")) continue;

    let p = kwEnd;
    while (p < masked.length && /\s/.test(masked[p])) p++;
    if (masked[p] !== "(") continue;
    const close = matchParen(masked, p);
    if (close === -1) continue;

    if (kw === "while") {
      edits.push({ at: p + 1, text: "__h1g(), " });
      continue;
    }

    // for(...): a three-part header has its condition guarded; for-of / for-in has no
    // condition to guard, so the guard goes at the top of its body instead.
    const semis = topLevelSemicolons(masked, p + 1, close);
    if (semis.length === 2) {
      const condStart = semis[0] + 1;
      const condEnd = semis[1];
      const cond = js.slice(condStart, condEnd).trim();
      // An empty condition means "forever" — the guard becomes the whole condition, with
      // `true` preserving that meaning.
      edits.push({ at: condStart, text: cond ? " __h1g(), " : " __h1g(), true " });
    } else {
      let b = close + 1;
      while (b < masked.length && /\s/.test(masked[b])) b++;
      if (masked[b] === "{") edits.push({ at: b + 1, text: " __h1g();" });
    }
  }

  if (edits.length === 0) return js;
  edits.sort((a, b) => b.at - a.at);
  let out = js;
  edits.forEach((e) => {
    out = out.slice(0, e.at) + e.text + out.slice(e.at);
  });

  return (
    "var __h1_deadline = Date.now() + " +
    LOOP_BUDGET_MS +
    ";\nfunction __h1g() {\n  if (Date.now() > __h1_deadline) {\n" +
    '    throw new Error("A loop in your code ran for more than ' +
    LOOP_BUDGET_MS / 1000 +
    ' seconds without finishing. That usually means its condition never becomes false \\u2014 check the test inside the brackets, and make sure something inside the loop changes each time round.");\n' +
    "  }\n  return true;\n}\n" +
    out
  );
}

// Injected ahead of the student's script. Written as a plain string rather than a function
// so nothing from H1's scope can be captured by accident.
function harnessSource(runId, checkBodies) {
  return `(function () {
  var __runId = ${JSON.stringify(runId)};
  var __logs = [];
  var __errors = [];
  var __done = false;

  var __truncated = false;

  function record(level, args) {
    if (__truncated) return false;
    if (__logs.length >= ${MAX_LOGS}) {
      __truncated = true;
      __logs.push({ level: "warn", text: "… output stopped after ${MAX_LOGS} lines." });
      return false;
    }
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      try {
        if (typeof a === "string") parts.push(a);
        else if (a instanceof Error) parts.push(a.message);
        else parts.push(JSON.stringify(a));
      } catch (e) {
        parts.push(String(a));
      }
    }
    var line = parts.join(" ");
    if (line.length > ${MAX_LOG_CHARS}) line = line.slice(0, ${MAX_LOG_CHARS}) + "…";
    __logs.push({ level: level, text: line });
    return true;
  }

  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      if (!record(level === "debug" ? "log" : level, arguments)) return;
      try { original.apply(console, arguments); } catch (e) {}
    };
  });

  window.addEventListener("error", function (e) {
    __errors.push({ message: e.message, line: e.lineno || null });
    finish();
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    __errors.push({ message: "Unhandled promise rejection: " + (reason && reason.message ? reason.message : String(reason)), line: null });
    finish();
  });

  var CHECKS = ${JSON.stringify(checkBodies)};

  function runChecks() {
    return CHECKS.map(function (c) {
      try {
        // Checks get the document and the captured console output, which between them cover
        // "did the page end up right" and "did the code print the right thing".
        var fn = new Function("logs", "output", c.body);
        var out = __logs.map(function (l) { return l.text; });
        var passed = fn(out, out.join("\\n"));
        return { label: c.label, passed: passed === true, hint: c.hint || "" };
      } catch (err) {
        return { label: c.label, passed: false, hint: c.hint || "", error: err && err.message ? err.message : String(err) };
      }
    });
  }

  function finish() {
    if (__done) return;
    __done = true;
    var results;
    try { results = runChecks(); } catch (e) { results = []; }
    try {
      window.parent.postMessage({ __h1code: true, runId: __runId, logs: __logs, errors: __errors, checks: results }, "*");
    } catch (e) {}
  }

  // Give synchronous script and DOM construction a chance to settle, then report. A later
  // error still reports through the handlers above.
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(finish, 60);
  } else {
    window.addEventListener("DOMContentLoaded", function () { setTimeout(finish, 60); });
  }
})();`;
}

export function buildDocument({ html = "", css = "", js = "", harness = "" }) {
  // The student's HTML may or may not be a full document. Either way it goes inside a real
  // one so relative behaviour (head/body, default styles) matches a normal page.
  const looksFull = /<html[\s>]/i.test(html);
  const body = looksFull ? html : `<!doctype html><html><head><meta charset="utf-8"></head><body>\n${html}\n</body></html>`;
  const styleTag = css ? `<style>\n${css}\n</style>` : "";
  const harnessTag = harness ? `<script>\n${harness}\n<\/script>` : "";
  const scriptTag = js ? `<script>\n${js}\n<\/script>` : "";

  // Harness first so it captures everything the student's script does.
  if (/<\/head>/i.test(body)) {
    return body.replace(/<\/head>/i, `${styleTag}${harnessTag}</head>`).replace(/<\/body>/i, `${scriptTag}</body>`);
  }
  return `${body}${styleTag}${harnessTag}${scriptTag}`;
}

const SANDBOX_URL = "/sandbox.html";
const SANDBOX_READY_TIMEOUT_MS = 8000;

// Creates the sandboxed frame and resolves once the page inside it is ready to be handed a
// document. Rejects if it never loads, so a preview that can't start says so rather than
// sitting blank forever.
function createSandboxFrame(host, title) {
  const frame = document.createElement("iframe");
  frame.className = "code-preview-frame";
  frame.title = title;
  // No allow-same-origin: see the note at the top of this file.
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
  frame.src = SANDBOX_URL;
  host.appendChild(frame);

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onReady);
      reject(new Error("preview did not start"));
    }, SANDBOX_READY_TIMEOUT_MS);
    function onReady(event) {
      if (event.source !== frame.contentWindow) return;
      if (!event.data || event.data.__h1sandboxReady !== true) return;
      clearTimeout(timer);
      window.removeEventListener("message", onReady);
      resolve();
    }
    window.addEventListener("message", onReady);
  });

  return {
    frame,
    // Hands the document over. The frame's origin is opaque, so "*" is the only target
    // available; the content is the student's own code going into their own sandbox.
    send: (doc) => ready.then(() => frame.contentWindow && frame.contentWindow.postMessage({ __h1sandbox: true, doc }, "*")),
  };
}

// `host` is the element the sandboxed frame lives in. A fresh frame is created per run so a
// previous run's timers, listeners and infinite loops are genuinely gone, not just ignored.
export function createRunner(host) {
  let current = null;

  function teardown() {
    if (current) {
      window.removeEventListener("message", current.onMessage);
      clearTimeout(current.timer);
      if (current.frame && current.frame.parentNode) current.frame.parentNode.removeChild(current.frame);
      current = null;
    }
  }

  function run({ html = "", css = "", js = "", checks = [], withHarness = true } = {}) {
    teardown();
    host.innerHTML = "";

    const runId = ++runSeq;
    const sandbox = createSandboxFrame(host, "Code preview");
    const frame = sandbox.frame;

    const checkBodies = checks.map((c) => ({ label: c.label, body: c.body, hint: c.hint || "" }));
    const harness = withHarness ? harnessSource(runId, checkBodies) : "";
    // Guarded: an unbounded loop in here would otherwise freeze the whole tab.
    const guardedJs = injectLoopGuard(js);
    const doc = buildDocument({ html, css, js: guardedJs, harness });
    const delivered = sandbox.send(doc);

    // How many lines sit above the student's own first line in the generated document: the
    // wrapper and harness, plus whatever preamble the loop guard added.
    const NL = String.fromCharCode(10);
    const countLines = (text) => text.split(NL).length - 1;
    const jsAt = js ? doc.indexOf(guardedJs) : -1;
    const guardLines = guardedJs.length > js.length ? countLines(guardedJs.slice(0, guardedJs.length - js.length)) : 0;
    const lineOffset = jsAt === -1 ? 0 : countLines(doc.slice(0, jsAt)) + guardLines;
    const fixLines = (errs) =>
      (errs || []).map((e) => {
        if (!e.line) return e;
        const real = e.line - lineOffset;
        // Outside the student's own code (harness, or their inline HTML script): drop the
        // number rather than point at a line they can't see.
        return { ...e, line: real > 0 ? real : null };
      });

    if (!withHarness) return Promise.resolve({ logs: [], errors: [], checks: [], timedOut: false });

    return new Promise((resolve) => {
      delivered.catch(() => {
        settle({
          logs: [],
          errors: [{ message: "H1 couldn't start the preview window. Check your connection and try running it again.", line: null }],
          checks: checkBodies.map((c) => ({ label: c.label, passed: false, hint: c.hint })),
          timedOut: false,
        });
      });

      function settle(result) {
        if (!current || current.runId !== runId) return;
        window.removeEventListener("message", onMessage);
        clearTimeout(current.timer);
        current.timer = null;
        resolve(result);
      }

      function onMessage(event) {
        // The frame has an opaque origin, so origin checking is meaningless here — identity
        // comes from the window reference plus the run id, which a stale frame can't fake.
        if (event.source !== frame.contentWindow) return;
        const d = event.data;
        if (!d || d.__h1code !== true || d.runId !== runId) return;
        settle({ logs: d.logs || [], errors: fixLines(d.errors), checks: d.checks || [], timedOut: false });
      }

      function onTimeout() {
        // Nothing came back: almost always an infinite loop. Destroying the frame is what
        // actually stops it — there's no other way to interrupt a busy script.
        const frameEl = current && current.frame;
        if (frameEl && frameEl.parentNode) frameEl.parentNode.removeChild(frameEl);
        settle({
          logs: [],
          errors: [{ message: "Your code ran for more than 4 seconds and was stopped. That usually means a loop that never ends — check your loop's condition.", line: null }],
          checks: checkBodies.map((c) => ({ label: c.label, passed: false, hint: c.hint })),
          timedOut: true,
        });
      }

      // The four seconds are four seconds of the student's code running, so the clock restarts
      // once the sandbox page has actually been handed the document — loading it doesn't eat
      // into the budget on a slow connection.
      delivered.then(() => {
        if (!current || current.runId !== runId || !current.timer) return;
        clearTimeout(current.timer);
        current.timer = setTimeout(onTimeout, RUN_TIMEOUT_MS);
      });
      const timer = setTimeout(onTimeout, RUN_TIMEOUT_MS + SANDBOX_READY_TIMEOUT_MS);

      current = { runId, frame, onMessage, timer };
      window.addEventListener("message", onMessage);
    });
  }

  // A preview with no harness and no checks — used by the builder's live preview, where the
  // point is just to see the page.
  function preview({ html = "", css = "", js = "" } = {}) {
    teardown();
    host.innerHTML = "";
    const sandbox = createSandboxFrame(host, "Live preview");
    sandbox.send(buildDocument({ html, css, js: injectLoopGuard(js) })).catch(() => {
      // Nothing to report in a live preview beyond the frame staying blank; the run button
      // gives a proper message.
    });
    current = { runId: ++runSeq, frame: sandbox.frame, onMessage: () => {}, timer: null };
  }

  return { run, preview, teardown };
}
