// Typesets maths that markdown.js left as [data-tex] elements, using KaTeX.
//
// KaTeX is only downloaded the first time something on screen actually contains maths. Until
// it arrives — or if it can't (offline, blocked) — the readable plain-text fallback markdown.js
// wrote stays in place, so maths is never shown as raw LaTeX and never goes missing.
//
// Safety: KaTeX runs with trust disabled, so commands that could produce links, classes, ids
// or styles (\href, \url, \htmlClass …) are refused, and macro expansion is capped so a
// pathological expression can't hang the page.
const KATEX_VERSION = "0.18.7";
const KATEX_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/`;

let katexPromise = null;
let scheduled = false;

function loadKatex() {
  if (!katexPromise) {
    katexPromise = (async () => {
      if (!document.querySelector("link[data-katex]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = KATEX_BASE + "katex.min.css";
        link.crossOrigin = "anonymous";
        link.dataset.katex = "1";
        document.head.appendChild(link);
      }
      const mod = await import(KATEX_BASE + "katex.min.mjs");
      return mod.default || mod;
    })().catch((err) => {
      // Let a later render try again (e.g. once the connection is back).
      katexPromise = null;
      throw err;
    });
  }
  return katexPromise;
}

const OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  maxSize: 40,
  maxExpand: 500,
  output: "htmlAndMathml",
};

export async function renderMathIn(root = document) {
  const pending = [...root.querySelectorAll("[data-tex]:not([data-math])")];
  if (!pending.length) return;
  pending.forEach((el) => (el.dataset.math = "loading"));
  let katex;
  try {
    katex = await loadKatex();
  } catch {
    pending.forEach((el) => {
      // Keep the plain-text fallback; mark so it can be retried on the next pass.
      delete el.dataset.math;
      el.classList.add("math-fallback");
    });
    return;
  }
  pending.forEach((el) => {
    if (!el.isConnected) return;
    const display = el.dataset.display === "1";
    try {
      katex.render(el.dataset.tex, el, { ...OPTIONS, displayMode: display });
      el.dataset.math = "done";
      el.classList.remove("math-fallback");
      // Long display equations scroll sideways inside their own box instead of widening the
      // page; a keyboard user needs to be able to reach that scroll.
      if (display) {
        el.tabIndex = 0;
        el.setAttribute("role", "math");
        el.setAttribute("aria-label", el.dataset.tex);
      }
    } catch {
      el.dataset.math = "fallback";
      el.classList.add("math-fallback");
    }
  });
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderMathIn(document);
  });
}

// One observer for the whole app, so any view that renders markdown (the tutor, lessons,
// explanations, notes) gets typeset maths without each having to remember to ask.
export function watchMath() {
  if (typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.hasAttribute("data-tex") || node.querySelector("[data-tex]:not([data-math])")) {
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
}
