// Python for Code Lab, running as real CPython (Pyodide) inside a Web Worker.
//
// A worker, not an iframe, for one concrete reason: the web tracks discovered that a busy
// script in a sandboxed iframe freezes the entire tab, and the parent's own timeout can never
// fire. A worker is a separate thread, so `while True:` freezes nothing, and the parent can
// terminate it outright — which is the only way to actually stop running Python, since
// interrupting it properly needs SharedArrayBuffer and that needs cross-origin isolation
// headers this app doesn't (and shouldn't need to) set.
//
// The worker runs on H1's own origin, so once Pyodide has finished downloading, everything
// student code could use to reach the network or storage is removed from the global scope.
// After that point `import js; js.fetch(...)` has nothing to call.

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const MAX_OUTPUT_CHARS = 100000;

// The network gate. Installed before Pyodide is loaded, so any reference to `fetch` that Pyodide
// keeps for itself (pyodide.http.pyfetch holds one, loadPackage uses one) is this function, not
// the browser's. It lets through the Python download and nothing else, and once Python is ready
// it lets through nothing at all. The real fetch lives only in this closure, which Python's
// `import js` can't see.
const realFetch = self.fetch.bind(self);
let networkOpen = true;
function gatedFetch(input, init) {
  const url = typeof input === "string" ? input : input && typeof input.url === "string" ? input.url : String(input);
  if (networkOpen && url.startsWith(PYODIDE_URL)) return realFetch(input, init);
  return Promise.reject(new TypeError("Network access is switched off inside H1's Python sandbox."));
}
Object.defineProperty(self, "fetch", { value: gatedFetch, writable: true, configurable: true });

let pyodide = null;
let booting = null;

function post(msg) {
  self.postMessage(msg);
}

// Pyodide needs fetch and WebAssembly while it loads. Once it's up, student code has no
// legitimate reason to touch the network or storage, so those doors get closed.
//
// Hiding a name on the global object isn't enough: `fetch` and the `indexedDB` getter also live
// on WorkerGlobalScope.prototype, where `import js` can still reach them — and a nested Worker
// would start with a fresh copy of everything. So each name is removed from every object on the
// global's prototype chain, and the ways to spawn a new context or talk to other tabs go too.
// (Tested from Python by trying each route; see the sandbox tests.)
const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "EventSource",
  "RTCPeerConnection",
  "webkitRTCPeerConnection",
  "indexedDB",
  "IDBFactory",
  "caches",
  "CacheStorage",
  "importScripts",
  "openDatabase",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "WorkerGlobalScope",
  "DedicatedWorkerGlobalScope",
];

function blockEverywhere(start, name) {
  for (let obj = start; obj; obj = Object.getPrototypeOf(obj)) {
    if (!Object.prototype.hasOwnProperty.call(obj, name)) continue;
    try {
      Object.defineProperty(obj, name, { value: undefined, writable: false, configurable: false });
    } catch (e) {
      try {
        delete obj[name];
      } catch (e2) {
        // Nothing else to try for this one; the checks in the sandbox test cover what matters.
      }
    }
  }
}

function harden() {
  networkOpen = false;
  BLOCKED_GLOBALS.forEach((name) => blockEverywhere(self, name));
  // The origin-private file system is reachable from a worker through navigator.storage.
  if (self.navigator && self.navigator.storage) {
    blockEverywhere(self.navigator.storage, "getDirectory");
  }
  if (typeof StorageManager !== "undefined") blockEverywhere(StorageManager.prototype, "getDirectory");
}

// The runner. Loaded once per worker.
//
// • The student's code is compiled with the filename "your code", so tracebacks point at
//   their own line numbers rather than at this wrapper.
// • input() reads from the lines typed into the Input box and echoes them into the output,
//   so the transcript reads like a real terminal session. Running out of input raises a
//   clear EOFError instead of hanging — there's no keyboard to wait for in a worker.
// • Each run gets its own empty folder in Pyodide's in-memory filesystem, so open("x.txt",
//   "w") genuinely writes a file, and one run's files don't leak into the next.
const RUNNER_PY = `
import sys, io, os, builtins, traceback, shutil, linecache

__h1_run_count = [0]

# A traceback as a student would see it running their own file: only their frames (and any
# library frames their code called into), never this runner's, and with their source lines
# printed — registering the source with linecache is what makes Python able to show them.
def __h1_format_error(e):
    frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename != "<exec>"]
    body = "".join(traceback.StackSummary.from_list(frames).format()) if frames else ""
    head = "Traceback (most recent call last):\\n" if body else ""
    return head + body + "".join(traceback.format_exception_only(type(e), e))

def __h1_run(src, stdin_text, files):
    __h1_run_count[0] += 1
    linecache.cache["your code"] = (len(src), None, src.splitlines(True), "your code")
    workdir = "/tmp/h1run"
    try:
        shutil.rmtree(workdir)
    except Exception:
        pass
    os.makedirs(workdir, exist_ok=True)
    os.chdir(workdir)
    for name, content in (files or {}).items():
        with open(name, "w", encoding="utf-8") as fh:
            fh.write(content)

    buf = io.StringIO()
    pending = list(stdin_text.split("\\n")) if stdin_text else []
    if pending and pending[-1] == "":
        pending.pop()

    def fake_input(prompt=""):
        buf.write(str(prompt))
        if not pending:
            buf.write("\\n")
            raise EOFError("Your program asked for input, but there are no more lines in the Input box.")
        value = pending.pop(0)
        buf.write(value + "\\n")
        return value

    ns = {"__name__": "__main__", "__builtins__": builtins}
    err = None
    old_out, old_err, old_input = sys.stdout, sys.stderr, builtins.input
    sys.stdout = buf
    sys.stderr = buf
    builtins.input = fake_input
    try:
        exec(compile(src, "your code", "exec"), ns)
    except SystemExit:
        pass
    except BaseException as e:
        err = __h1_format_error(e)
    finally:
        sys.stdout, sys.stderr = old_out, old_err
        builtins.input = old_input
    return buf.getvalue(), ns, err

def __h1_scope(ns, out, user_src):
    scope = dict(ns)
    scope["output"] = out
    scope["lines"] = out.splitlines()
    scope["__h1_src"] = user_src
    return scope

def __h1_check(ns, out, user_src, expr):
    scope = __h1_scope(ns, out, user_src)
    silent = io.StringIO()
    old = sys.stdout
    sys.stdout = silent
    try:
        return {"passed": bool(eval(expr, scope))}
    except BaseException as e:
        return {"passed": False, "error": type(e).__name__ + ": " + str(e)}
    finally:
        sys.stdout = old

# Test-case equality, spelled out: True is not 1 (a function that should return a bool must),
# but 6.0 does equal 6 (an average is allowed to come back as a float).
def __h1_equal(actual, expected):
    if isinstance(expected, bool) or isinstance(actual, bool):
        return type(actual) is type(expected) and actual == expected
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(actual - expected) < 1e-9
    return actual == expected

def __h1_case(ns, out, user_src, call, expect):
    scope = __h1_scope(ns, out, user_src)
    silent = io.StringIO()
    old = sys.stdout
    sys.stdout = silent
    try:
        expected = eval(expect, scope)
    except BaseException as e:
        sys.stdout = old
        return {"passed": False, "error": "Test setup error: " + str(e)}
    try:
        actual = eval(call, scope)
        return {"passed": __h1_equal(actual, expected), "actual": repr(actual), "expected": repr(expected)}
    except BaseException as e:
        return {"passed": False, "actual": type(e).__name__ + ": " + str(e), "expected": repr(expected), "raised": True}
    finally:
        sys.stdout = old
`;

async function boot() {
  if (pyodide) return pyodide;
  if (booting) return booting;
  booting = (async () => {
    post({ type: "boot", stage: "downloading" });
    // eslint-disable-next-line no-undef
    if (typeof loadPyodide === "undefined") importScripts(PYODIDE_URL + "pyodide.js");
    post({ type: "boot", stage: "starting" });
    // eslint-disable-next-line no-undef
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
    pyodide.runPython(RUNNER_PY);
    harden();
    post({ type: "boot", stage: "ready" });
    return pyodide;
  })().catch((err) => {
    // Forget the failure, so pressing Run again once the connection is back actually retries
    // instead of replaying the same error until the page is reloaded.
    booting = null;
    pyodide = null;
    throw err;
  });
  return booting;
}

// Turns a Python traceback into the last line a student needs, plus the line number in their
// own file. The full traceback travels with it, because hiding the real error teaches nothing.
function summariseTraceback(tb, source) {
  if (!tb) return null;
  const lines = tb.trimEnd().split("\n");
  const message = lines[lines.length - 1] || "Error";
  // The deepest frame in the student's own file is the line to point them at, even when the
  // error surfaced inside a library their code called.
  let line = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/File "your code", line (\d+)/);
    if (m) {
      line = Number(m[1]);
      break;
    }
  }
  const typeMatch = message.match(/^([A-Za-z_][\w.]*)(?::|$)/);
  // Taken from the source itself rather than parsed out of the traceback text, so it's right
  // whatever shape the traceback took.
  const codeLine = line && source ? (String(source).split("\n")[line - 1] || "").trim() : "";
  return { message, type: typeMatch ? typeMatch[1] : "Error", line, codeLine, traceback: tb };
}

function toJs(proxy) {
  if (proxy && typeof proxy.toJs === "function") {
    const v = proxy.toJs({ dict_converter: Object.fromEntries });
    if (proxy.destroy) proxy.destroy();
    return v;
  }
  return proxy;
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type === "warmup") {
    try {
      await boot();
    } catch (err) {
      post({ type: "boot", stage: "failed", message: String(err && err.message ? err.message : err) });
    }
    return;
  }

  if (data.type !== "run") return;
  const runId = data.runId;
  const checks = data.checks || [];
  const failAll = (message, type = "Error") => ({
    type: "result",
    runId,
    output: "",
    error: { message, type, line: null, codeLine: "", traceback: "" },
    checks: checks.map((c) => ({ label: c.label, passed: false, hint: c.hint || "" })),
  });

  try {
    await boot();
  } catch (err) {
    post(failAll("Python couldn't be downloaded. It needs the internet the first time you use it — check your connection and try again.", "LoadError"));
    return;
  }

  const t0 = performance.now();
  let result = null;
  try {
    const run = pyodide.globals.get("__h1_run");
    const filesProxy = pyodide.toPy(data.files || {});
    result = run(data.code || "", data.stdin || "", filesProxy);
    filesProxy.destroy();
    run.destroy();
    const output = result.get(0);
    const ns = result.get(1);
    const err = result.get(2);
    const elapsedMs = Math.round(performance.now() - t0);

    const checkFn = pyodide.globals.get("__h1_check");
    const caseFn = pyodide.globals.get("__h1_case");
    // A check can ask for the program to be run again with different input — that's how a
    // decision is tested on several values instead of trusting the one in the Input box.
    // Re-runs are cached by their input, so checks sharing an input share one run.
    const reruns = new Map();
    const runFn = pyodide.globals.get("__h1_run");
    const contextFor = (c) => {
      if (c.stdin === undefined) return { ns, out: output };
      if (!reruns.has(c.stdin)) {
        const fp = pyodide.toPy(data.files || {});
        const r = runFn(data.code || "", c.stdin, fp);
        fp.destroy();
        reruns.set(c.stdin, { proxy: r, ns: r.get(1), out: r.get(0) });
      }
      return reruns.get(c.stdin);
    };
    const outcomes = checks.map((c) => {
      try {
        const ctx = contextFor(c);
        const r = c.call !== undefined ? toJs(caseFn(ctx.ns, ctx.out, data.code || "", c.call, c.expect)) : toJs(checkFn(ctx.ns, ctx.out, data.code || "", c.body));
        return { label: c.label, hint: c.hint || "", passed: Boolean(r.passed), actual: r.actual, expected: r.expected, error: r.error || "", stdin: c.stdin };
      } catch (e) {
        return { label: c.label, hint: c.hint || "", passed: false, error: String(e && e.message ? e.message : e) };
      }
    });
    reruns.forEach((r) => {
      if (r.ns && r.ns.destroy) r.ns.destroy();
      if (r.proxy && r.proxy.destroy) r.proxy.destroy();
    });
    runFn.destroy();
    checkFn.destroy();
    caseFn.destroy();
    if (ns && ns.destroy) ns.destroy();

    // A print inside a long loop can produce megabytes. The checks above already saw all of it;
    // the page only needs enough to show, and says when it was cut.
    let shown = output || "";
    let truncated = false;
    if (shown.length > MAX_OUTPUT_CHARS) {
      shown = shown.slice(0, MAX_OUTPUT_CHARS);
      truncated = true;
    }
    post({ type: "result", runId, output: shown, truncated, error: summariseTraceback(err, data.code || ""), checks: outcomes, elapsedMs });
  } catch (err) {
    post(failAll(String(err && err.message ? err.message : err)));
  } finally {
    if (result && result.destroy) result.destroy();
  }
};
