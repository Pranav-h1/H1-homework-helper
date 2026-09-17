// Makes code blocks in rendered answers useful: a language label, syntax highlighting, a Copy
// button, and — for Python — "Run in Code Lab", which opens the code in a real Python editor.
//
// Applied after renderMarkdown, to any container. Idempotent, so re-rendering a message and
// decorating it again doesn't stack a second toolbar on each block.
import { highlight, normaliseLanguage } from "./codeEditor.js";
import { showToast } from "./toast.js";

const LABELS = { python: "Python", py: "Python", javascript: "JavaScript", js: "JavaScript", ts: "TypeScript", typescript: "TypeScript", html: "HTML", css: "CSS", json: "JSON", java: "Java", c: "C", "c++": "C++", cpp: "C++", "c#": "C#", sql: "SQL", bash: "Terminal", sh: "Terminal", shell: "Terminal" };

// Only guess when the fence didn't say, and only from things that are unmistakably Python —
// a wrong "Run in Code Lab" button on JavaScript would be worse than none.
function looksLikePython(text) {
  return /^\s*(def |import |from \w+ import |print\(|for \w+ in |while .+:\s*$|if .+:\s*$|class \w+[:(])/m.test(text) && !/[;{}]\s*$/m.test(text);
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  btn.classList.add("copied");
  btn.querySelector("span").textContent = "Copied";
  setTimeout(() => {
    btn.classList.remove("copied");
    btn.querySelector("span").textContent = "Copy";
  }, 1600);
}

// Options:
//   runPython — false to leave the Run button off (e.g. inside Code Lab, where it would
//               navigate away from the lesson), or a function(code) to run it somewhere else.
export function decorateCodeBlocks(container, { runPython, runLabel = "Run in Code Lab" } = {}) {
  if (!container) return;
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.dataset.decorated) return;
    const codeEl = pre.querySelector("code");
    if (!codeEl) return;
    pre.dataset.decorated = "1";

    const text = codeEl.textContent;
    let lang = pre.dataset.lang || "";
    if (!lang && looksLikePython(text)) lang = "python";
    const norm = normaliseLanguage(lang);
    if (norm) codeEl.innerHTML = highlight(text, norm);

    const wrap = document.createElement("div");
    wrap.className = "code-block";
    const bar = document.createElement("div");
    bar.className = "code-block-bar";
    const label = document.createElement("span");
    label.className = "code-block-lang";
    label.textContent = LABELS[lang] || (lang ? lang.toUpperCase() : "Code");
    bar.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    if (norm === "python" && runPython !== false) {
      const run = document.createElement("button");
      run.type = "button";
      run.className = "code-block-btn code-block-run";
      run.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg><span></span>';
      run.querySelector("span").textContent = runLabel;
      run.addEventListener("click", () => {
        if (typeof runPython === "function") runPython(text);
        else window.dispatchEvent(new CustomEvent("h1:open-python", { detail: { code: text, source: "AI Tutor" } }));
      });
      actions.appendChild(run);
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-block-btn";
    copyBtn.setAttribute("aria-label", `Copy ${label.textContent} code`);
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
    copyBtn.addEventListener("click", () => copy(text, copyBtn).catch(() => showToast("Couldn't copy.", "error")));
    actions.appendChild(copyBtn);

    bar.appendChild(actions);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(bar);
    wrap.appendChild(pre);
  });
}
