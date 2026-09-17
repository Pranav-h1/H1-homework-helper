// Parent-side control of the Python worker.
//
// Owns the worker's lifecycle, the run timeout, and the restart after a runaway loop. The
// worker itself (pyWorker.js) explains why Python runs on a thread rather than in the
// preview iframe the web tracks use.
const RUN_TIMEOUT_MS = 10000;
// Python's first use downloads ~10MB. That's a one-off the browser then caches, but it has
// to be visible rather than looking like the app hung.
const BOOT_TIMEOUT_MS = 90000;

let seq = 0;

export function createPythonRunner({ onBoot } = {}) {
  let worker = null;
  let ready = false;
  let pending = null;

  function spawn() {
    worker = new Worker("/js/pyWorker.js");
    worker.onmessage = (event) => {
      const d = event.data || {};
      if (d.type === "boot") {
        if (d.stage === "ready") ready = true;
        if (onBoot) onBoot(d.stage, d.message);
        return;
      }
      if (d.type === "result" && pending && d.runId === pending.runId) {
        const settle = pending;
        pending = null;
        clearTimeout(settle.timer);
        settle.resolve({
          output: d.output || "",
          truncated: Boolean(d.truncated),
          error: d.error || null,
          checks: d.checks || [],
          elapsedMs: d.elapsedMs || 0,
          timedOut: false,
          stopped: false,
          restarted: false,
        });
      }
    };
    worker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const settle = pending;
      pending = null;
      // Whatever broke the worker, the next Run gets a fresh one.
      restart();
      if (!settle) return;
      clearTimeout(settle.timer);
      settle.resolve({
        output: "",
        error: { message: (e && e.message) || "Python stopped unexpectedly.", line: null, type: "WorkerError" },
        checks: settle.checks.map((c) => ({ label: c.label, passed: false, hint: c.hint || "" })),
        timedOut: false,
        stopped: false,
        restarted: true,
      });
    };
  }

  function ensure() {
    if (!worker) spawn();
    return worker;
  }

  // Kick off the download as soon as a Python lesson is opened, so the wait happens while
  // the student is still reading the explanation rather than after they press Run.
  function warmup() {
    ensure().postMessage({ type: "warmup" });
  }

  function restart() {
    if (worker) worker.terminate();
    worker = null;
    ready = false;
    spawn();
    // Straight back to warming up: the wasm is in the browser cache now, so this is quick.
    worker.postMessage({ type: "warmup" });
  }

  // What a check looks like on the wire: either a boolean Python expression (`body`) or a test
  // case (`call` evaluated and compared with `expect`), which reports expected vs actual.
  function serialiseCheck(c) {
    const out = { label: c.label, hint: c.hint || "" };
    if (c.stdin !== undefined) out.stdin = c.stdin;
    if (c.call !== undefined) {
      out.call = c.call;
      out.expect = c.expect;
    } else {
      out.body = c.body;
    }
    return out;
  }

  // The student pressed Stop. The only way to stop running Python is to end the worker.
  function stop() {
    if (!pending) return false;
    const settle = pending;
    pending = null;
    clearTimeout(settle.timer);
    restart();
    settle.resolve({
      output: "",
      error: null,
      checks: settle.checks.map((c) => ({ label: c.label, passed: false, hint: c.hint || "" })),
      timedOut: false,
      stopped: true,
      restarted: true,
    });
    return true;
  }

  function run({ code = "", checks = [], stdin = "", files = null } = {}) {
    // A run still in flight is still occupying the worker's only thread — a new message would
    // just queue behind it (behind an infinite loop, forever). End it properly first.
    if (pending) stop();
    const w = ensure();
    const runId = ++seq;

    return new Promise((resolve) => {
      const timer = setTimeout(
        () => {
          if (!pending || pending.runId !== runId) return;
          pending = null;
          // Terminating is the only way to actually stop running Python here — there's no
          // interrupt available without cross-origin isolation. The restart costs a moment,
          // and the student is told that's what happened rather than left guessing.
          restart();
          resolve({
            output: "",
            error: {
              message:
                "Your code ran for more than " +
                RUN_TIMEOUT_MS / 1000 +
                " seconds and was stopped. That usually means a loop that never ends — check that its condition can become false, and that something inside the loop changes. Python has been restarted.",
              line: null,
              type: "Timeout",
            },
            checks: checks.map((c) => ({ label: c.label, passed: false, hint: c.hint || "" })),
            timedOut: true,
            restarted: true,
          });
        },
        ready ? RUN_TIMEOUT_MS : BOOT_TIMEOUT_MS
      );

      pending = { runId, resolve, timer, checks };
      w.postMessage({ type: "run", runId, code, stdin, files: files || {}, checks: checks.map(serialiseCheck) });
    });
  }

  function dispose() {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    if (worker) worker.terminate();
    worker = null;
    ready = false;
  }

  return { run, stop, warmup, dispose, isReady: () => ready, isRunning: () => Boolean(pending) };
}

// ---------------------------------------------------------------------------
// One Python for the whole app
// ---------------------------------------------------------------------------
// Lessons, challenges and projects all share a single worker: booting CPython costs seconds and
// tens of megabytes, so moving from a lesson to a challenge shouldn't pay that again. Anything
// that wants to show boot progress subscribes rather than owning the runner.
let shared = null;
let lastStage = null;
const bootListeners = new Set();

export function getSharedPythonRunner() {
  if (!shared) {
    lastStage = null;
    shared = createPythonRunner({
      onBoot: (stage, message) => {
        lastStage = { stage, message };
        bootListeners.forEach((fn) => {
          try {
            fn(stage, message);
          } catch {
            // A listener belonging to a view that's gone mustn't stop the others hearing it.
          }
        });
      },
    });
  }
  return shared;
}

export function onPythonBoot(fn) {
  bootListeners.add(fn);
  return () => bootListeners.delete(fn);
}

export function getPythonBootStage() {
  if (!shared) return null;
  if (shared.isReady()) return { stage: "ready" };
  return lastStage;
}

export function hasSharedPythonRunner() {
  return Boolean(shared);
}

export function disposeSharedPythonRunner() {
  if (!shared) return;
  shared.dispose();
  shared = null;
  lastStage = null;
}
