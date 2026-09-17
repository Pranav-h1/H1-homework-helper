// H1's code editor: line numbers, syntax highlighting, and the keys a code box should have.
//
// It's a real <textarea> with a highlighted copy of the same text drawn exactly underneath it.
// Keeping the textarea means typing, selection, undo, IME input, autocorrect-off, screen
// readers and every existing test that sets `.value` all keep working — nothing is emulated.
// The highlighter is a small tokenizer per language rather than a dependency, and the same
// `highlight()` is used for code blocks in AI answers, so code looks the same everywhere.

const PY_KEYWORDS = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(" "));
const PY_BUILTINS = new Set("print input len range int float str bool list dict set tuple type abs sum min max sorted reversed enumerate zip map filter round open isinstance any all ord chr help dir id iter next pow divmod hex bin format repr super object Exception ValueError TypeError KeyError IndexError ZeroDivisionError NameError".split(" "));
const JS_KEYWORDS = new Set("break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of true false null undefined".split(" "));
const JS_BUILTINS = new Set("console document window Math JSON Array Object String Number Boolean Promise Map Set Date parseInt parseFloat setTimeout setInterval fetch localStorage alert".split(" "));

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function span(cls, text) {
  return `<span class="tok-${cls}">${esc(text)}</span>`;
}

// A tiny scanner: at each position, try each rule in order; the first that matches wins.
function scan(src, rules, wordFn) {
  let out = "";
  let i = 0;
  let prevWord = "";
  while (i < src.length) {
    let matched = false;
    for (const [cls, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i && m[0].length > 0) {
        out += cls ? span(cls, m[0]) : esc(m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const word = /[A-Za-z_$][\w$]*/y;
    word.lastIndex = i;
    const w = word.exec(src);
    if (w) {
      const after = src.slice(i + w[0].length).match(/^\s*\(/);
      out += wordFn(w[0], Boolean(after), prevWord);
      prevWord = w[0];
      i += w[0].length;
      continue;
    }
    const ch = src[i];
    if (!/\s/.test(ch)) prevWord = "";
    out += /[+\-*/%=<>!&|^~]/.test(ch) ? span("op", ch) : esc(ch);
    i++;
  }
  return out;
}

function highlightPython(src) {
  return scan(
    src,
    [
      ["com", /#[^\n]*/y],
      ["str", /(?:[rRbBfFuU]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))/y],
      ["str", /(?:[rRbBfFuU]{1,2})?(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/y],
      ["num", /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?j?)\b/y],
      ["dec", /@[A-Za-z_]\w*/y],
    ],
    (w, isCall, prev) => {
      if (prev === "def" || prev === "class") return span("def", w);
      if (PY_KEYWORDS.has(w)) return span("kw", w);
      if (w === "self") return span("self", w);
      if (PY_BUILTINS.has(w)) return span("builtin", w);
      if (isCall) return span("fn", w);
      return esc(w);
    }
  );
}

function highlightJs(src) {
  return scan(
    src,
    [
      ["com", /\/\/[^\n]*/y],
      ["com", /\/\*[\s\S]*?(?:\*\/|$)/y],
      ["str", /`(?:\\.|[^`\\])*`?/y],
      ["str", /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y],
      ["num", /\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/y],
    ],
    (w, isCall, prev) => {
      if (prev === "function" || prev === "class") return span("def", w);
      if (JS_KEYWORDS.has(w)) return span("kw", w);
      if (JS_BUILTINS.has(w)) return span("builtin", w);
      if (isCall) return span("fn", w);
      return esc(w);
    }
  );
}

function highlightCss(src) {
  let out = "";
  let depth = 0;
  let i = 0;
  const re = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|[{};:]|@[\w-]+|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|fr|deg)?|#[\da-fA-F]{3,8}\b|[\w-]+|\s+|./gy;
  let expectValue = false;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) break;
    const t = m[0];
    if (t.startsWith("/*")) out += span("com", t);
    else if (t[0] === '"' || t[0] === "'") out += span("str", t);
    else if (t === "{") {
      depth++;
      expectValue = false;
      out += esc(t);
    } else if (t === "}") {
      depth = Math.max(0, depth - 1);
      expectValue = false;
      out += esc(t);
    } else if (t === ":" && depth > 0) {
      expectValue = true;
      out += esc(t);
    } else if (t === ";") {
      expectValue = false;
      out += esc(t);
    } else if (t[0] === "@") out += span("kw", t);
    else if (/^#[\da-fA-F]{3,8}$/.test(t) && (depth > 0)) out += span("num", t);
    else if (/^-?\d*\.?\d+/.test(t) && depth > 0) out += span("num", t);
    else if (/^[\w-]+$/.test(t)) {
      if (depth === 0) out += span("sel", t);
      else if (!expectValue) out += span("prop", t);
      else out += span("val", t);
    } else out += depth === 0 && /[.#:>*+~[\]]/.test(t) ? span("sel", t) : esc(t);
    i += t.length;
  }
  return out;
}

function highlightHtml(src) {
  let out = "";
  const re = /<!--[\s\S]*?(?:-->|$)|<\/?[A-Za-z][\w-]*|\/?>|[\w-:@]+(?==)|"[^"]*"?|'[^']*'?|[^<>"'\w]+|[\w-]+|./gy;
  let inTag = false;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) break;
    const t = m[0];
    if (t.startsWith("<!--")) out += span("com", t);
    else if (/^<\/?[A-Za-z]/.test(t)) {
      inTag = true;
      out += span("tag", t);
    } else if (t === ">" || t === "/>") {
      inTag = false;
      out += span("tag", t);
    } else if (inTag && /^[\w-:@]+$/.test(t) && src[i + t.length] === "=") out += span("attr", t);
    else if (inTag && (t[0] === '"' || t[0] === "'")) out += span("str", t);
    else out += esc(t);
    i += t.length;
  }
  return out;
}

const LANG_ALIASES = { py: "python", python: "python", js: "javascript", javascript: "javascript", mjs: "javascript", jsx: "javascript", ts: "javascript", typescript: "javascript", json: "javascript", html: "html", htm: "html", xml: "html", svg: "html", css: "css", scss: "css" };

export function normaliseLanguage(lang) {
  return LANG_ALIASES[(lang || "").toLowerCase()] || "";
}

// Returns HTML. Unknown languages are escaped but not coloured.
export function highlight(code, lang) {
  const l = normaliseLanguage(lang);
  const src = code || "";
  if (src.length > 60000) return esc(src);
  if (l === "python") return highlightPython(src);
  if (l === "javascript") return highlightJs(src);
  if (l === "css") return highlightCss(src);
  if (l === "html") return highlightHtml(src);
  return esc(src);
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

const INDENT = { python: "    ", javascript: "  ", html: "  ", css: "  " };
const COMMENT = { python: "# ", javascript: "// " };

export function createCodeEditor({ value = "", language = "python", ariaLabel = "Code editor", onInput, onRun, className = "" } = {}) {
  let lang = normaliseLanguage(language) || language;
  const root = document.createElement("div");
  root.className = `ce ${className}`.trim();
  root.dataset.lang = lang;

  const gutter = document.createElement("div");
  gutter.className = "ce-gutter";
  gutter.setAttribute("aria-hidden", "true");
  const gutterInner = document.createElement("div");
  gutterInner.className = "ce-gutter-inner";
  gutter.appendChild(gutterInner);

  const body = document.createElement("div");
  body.className = "ce-body";
  const pre = document.createElement("pre");
  pre.className = "ce-highlight";
  pre.setAttribute("aria-hidden", "true");
  const code = document.createElement("code");
  pre.appendChild(code);

  const ta = document.createElement("textarea");
  ta.className = "ce-input code-editor";
  ta.value = value;
  ta.spellcheck = false;
  ta.setAttribute("autocapitalize", "off");
  ta.setAttribute("autocomplete", "off");
  ta.setAttribute("autocorrect", "off");
  ta.setAttribute("aria-label", ariaLabel);
  ta.setAttribute("aria-multiline", "true");
  ta.wrap = "off";

  body.appendChild(pre);
  body.appendChild(ta);
  root.appendChild(gutter);
  root.appendChild(body);

  // The line an error points at. Drawn behind the text (it lives inside the highlight layer, so
  // it scrolls with it) and on the gutter number, and cleared as soon as the code changes —
  // after an edit the old line number may no longer mean anything.
  const lineMark = document.createElement("div");
  lineMark.className = "ce-line-mark";
  lineMark.hidden = true;
  pre.insertBefore(lineMark, code);
  let markedLine = null;

  let frame = 0;
  let lastLines = 0;
  function paint() {
    frame = 0;
    const text = ta.value;
    // A trailing newline needs a visible line, or the last row of the overlay collapses.
    code.innerHTML = highlight(text, lang) + (text.endsWith("\n") || text === "" ? " " : "");
    const lines = text.split("\n").length;
    if (lines !== lastLines) {
      lastLines = lines;
      let html = "";
      for (let n = 1; n <= lines; n++) html += `<span>${n}</span>`;
      gutterInner.innerHTML = html;
    }
    applyMark();
    syncScroll();
  }
  function lineHeightPx() {
    return parseFloat(getComputedStyle(ta).lineHeight) || 22;
  }
  function applyMark() {
    gutterInner.querySelectorAll(".is-marked").forEach((s) => s.classList.remove("is-marked"));
    if (!markedLine || markedLine > lastLines) {
      lineMark.hidden = true;
      return;
    }
    const padTop = parseFloat(getComputedStyle(ta).paddingTop) || 0;
    lineMark.hidden = false;
    lineMark.style.top = `${padTop + (markedLine - 1) * lineHeightPx()}px`;
    lineMark.style.height = `${lineHeightPx()}px`;
    const num = gutterInner.children[markedLine - 1];
    if (num) num.classList.add("is-marked");
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }
  function syncScroll() {
    pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    gutterInner.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  // Replaces the selection like typing would, so the browser's undo stack keeps working.
  function insert(text, selStart = ta.selectionStart, selEnd = ta.selectionEnd) {
    ta.focus();
    ta.setSelectionRange(selStart, selEnd);
    const ok = document.execCommand && document.execCommand("insertText", false, text);
    if (!ok) {
      ta.value = ta.value.slice(0, selStart) + text + ta.value.slice(selEnd);
      ta.selectionStart = ta.selectionEnd = selStart + text.length;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function selectedLineRange() {
    const v = ta.value;
    const start = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let end = v.indexOf("\n", ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === "\n" ? 1 : 0));
    if (end === -1) end = v.length;
    return { start, end };
  }

  let escapePressed = false;

  ta.addEventListener("keydown", (e) => {
    const unit = INDENT[lang] || "  ";

    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (onRun) onRun();
      return;
    }

    if (e.key === "Escape") {
      // Tab indents in here, so Escape is the way out for keyboard users: the next Tab moves
      // focus instead of inserting spaces.
      escapePressed = true;
      return;
    }

    if (e.key === "Tab") {
      if (escapePressed) {
        escapePressed = false;
        return;
      }
      e.preventDefault();
      const { start, end } = selectedLineRange();
      const multiLine = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes("\n");
      if (e.shiftKey || multiLine) {
        const block = ta.value.slice(start, end);
        const lines = block.split("\n");
        const changed = lines
          .map((l) => {
            if (!e.shiftKey) return unit + l;
            if (l.startsWith(unit)) return l.slice(unit.length);
            return l.replace(/^[ \t]{1,4}/, "");
          })
          .join("\n");
        insert(changed, start, end);
        ta.setSelectionRange(start, start + changed.length);
      } else {
        insert(unit);
      }
      return;
    }
    escapePressed = false;

    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      const v = ta.value;
      const lineStart = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const before = v.slice(lineStart, ta.selectionStart);
      let indent = (before.match(/^[ \t]*/) || [""])[0];
      const trimmed = before.trimEnd();
      if ((lang === "python" && trimmed.endsWith(":")) || (lang !== "python" && /[{([]$/.test(trimmed))) indent += unit;
      e.preventDefault();
      insert("\n" + indent);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "/" && COMMENT[lang]) {
      e.preventDefault();
      const mark = COMMENT[lang];
      const { start, end } = selectedLineRange();
      const lines = ta.value.slice(start, end).split("\n");
      const allCommented = lines.every((l) => !l.trim() || l.trimStart().startsWith(mark.trim()));
      const changed = lines
        .map((l) => {
          if (!l.trim()) return l;
          if (allCommented) return l.replace(new RegExp(`^(\\s*)${mark.trim().replace(/[/]/g, "\\/")} ?`), "$1");
          const pad = (l.match(/^\s*/) || [""])[0];
          return pad + mark + l.slice(pad.length);
        })
        .join("\n");
      insert(changed, start, end);
      ta.setSelectionRange(start, start + changed.length);
    }
  });

  ta.addEventListener("input", () => {
    if (markedLine) {
      markedLine = null;
      applyMark();
    }
    schedule();
    if (onInput) onInput(ta.value);
  });
  ta.addEventListener("scroll", syncScroll);

  paint();

  return {
    root,
    textarea: ta,
    getValue: () => ta.value,
    setValue(v) {
      ta.value = v;
      paint();
      if (onInput) onInput(v);
    },
    setLanguage(l) {
      lang = normaliseLanguage(l) || l;
      root.dataset.lang = lang;
      paint();
    },
    focus: () => ta.focus(),
    refresh: paint,
    markLine(n) {
      markedLine = Number(n) > 0 ? Number(n) : null;
      applyMark();
    },
    // Selects the line and scrolls it to the middle of the editor.
    goToLine(n) {
      const lines = ta.value.split("\n");
      const idx = Math.max(1, Math.min(Number(n) || 1, lines.length)) - 1;
      let start = 0;
      for (let i = 0; i < idx; i++) start += lines[i].length + 1;
      ta.focus();
      ta.setSelectionRange(start, start + lines[idx].length);
      ta.scrollTop = Math.max(0, idx * lineHeightPx() - ta.clientHeight / 2 + lineHeightPx());
      syncScroll();
    },
  };
}
