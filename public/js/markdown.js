// Minimal, dependency-free markdown renderer for AI output.
//
// Safety model: everything the model wrote is HTML-escaped. The only markup that reaches the
// page is markup this file builds itself. Code and maths are lifted out of the text *before*
// anything else runs (so no other rule can touch their contents), escaped, and put back at
// the end.
//
// Maths is emitted as an element carrying the raw TeX in `data-tex` plus a readable plain-text
// fallback; mathRender.js swaps in properly typeset KaTeX output when it can load it.

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[c];
  });
}

// Placeholders use private-use characters: nothing a model writes, and no markdown rule, will
// ever match or split them.
const INLINE_OPEN = "";
const INLINE_CLOSE = "";
const BLOCK_OPEN = "";
const BLOCK_CLOSE = "";

const LATEX_SYMBOLS = [
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\cdot/g, "·"],
  [/\\pm/g, "±"],
  [/\\mp/g, "∓"],
  [/\\leq?(?![a-z])/g, "≤"],
  [/\\geq?(?![a-z])/g, "≥"],
  [/\\neq/g, "≠"],
  [/\\approx/g, "≈"],
  [/\\infty/g, "∞"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\delta/g, "δ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\sigma/g, "σ"],
  [/\\Delta/g, "Δ"],
  [/\\degree/g, "°"],
  [/\\rightarrow|\\to(?![a-z])/g, "→"],
  [/\\Rightarrow/g, "⇒"],
];

// A readable plain-text version of some TeX: used as the fallback shown until (or unless) the
// typeset version loads, and for stray TeX commands a model left outside any delimiters.
function texToText(text) {
  let out = text;
  LATEX_SYMBOLS.forEach(([pattern, symbol]) => {
    out = out.replace(pattern, symbol);
  });
  // Flatten exponent/subscript braces first so a nested case like \sqrt{a^{2}+b^{2}} leaves
  // \sqrt{a^2+b^2} — a single brace-pair the sqrt/frac patterns below can then match.
  out = out.replace(/\^\{([^{}]+)\}/g, "^$1");
  out = out.replace(/_\{([^{}]+)\}/g, "_$1");
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");
  out = out.replace(/\\sqrt/g, "√");
  out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  out = out.replace(/\\(left|right)(?![a-z])/g, "");
  out = out.replace(/\\[,;!: ]/g, " ");
  return out;
}

// Inline formatting on already-escaped text. Code and maths were lifted out before escaping, so
// these rules can't reach inside them.
function inline(text) {
  return (
    text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, "<em>$1</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      // Links: only http(s), and the URL was escaped with everything else, so it can't close
      // the attribute. They open in a new tab and don't hand H1's window to the target.
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)"<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  );
}

export function renderMarkdown(raw) {
  // The placeholder characters are removed from the input so nothing written can forge one.
  let src = String(raw == null ? "" : raw)
    .replace(/\r\n?/g, "\n")
    .replace(/[-]/g, "");
  const tokens = [];
  const inlineToken = (html) => {
    tokens.push(html);
    return INLINE_OPEN + (tokens.length - 1) + INLINE_CLOSE;
  };
  const blockToken = (html) => {
    tokens.push(html);
    return "\n" + BLOCK_OPEN + (tokens.length - 1) + BLOCK_CLOSE + "\n";
  };

  // 1. Fenced code. The fence's language survives as a data attribute so code blocks can be
  //    highlighted and labelled after rendering (see codeBlocks.js).
  src = src.replace(/```([a-zA-Z0-9+#-]*)[^\S\n]*\n?([\s\S]*?)```/g, function (_m, lang, code) {
    const safeLang = (lang || "").toLowerCase().replace(/[^a-z0-9+#-]/g, "").slice(0, 20);
    return blockToken('<pre data-lang="' + safeLang + '"><code>' + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>");
  });

  // 2. Inline code.
  src = src.replace(/`([^`\n]+)`/g, (_m, code) => inlineToken("<code>" + escapeHtml(code) + "</code>"));

  // 3. Display maths — $$…$$ or \[…\]. On a line of its own it becomes a block; mid-sentence it
  //    stays inline so the paragraph isn't broken in two.
  const mathHtml = (tex, display, inFlow = false) => {
    const clean = tex.trim();
    // A display equation inside a list item has to be a span (styled as a block) so it can sit
    // inside the item's text instead of ending the list.
    const tag = display && !inFlow ? "div" : "span";
    const cls = display ? "math-block" : "math";
    return `<${tag} class="${cls}" data-tex="${escapeHtml(clean)}" data-display="${display ? 1 : 0}">${escapeHtml(texToText(clean))}</${tag}>`;
  };
  const onOwnLine = (m, offset, whole) => {
    const before = whole.slice(whole.lastIndexOf("\n", offset - 1) + 1, offset);
    const afterEnd = whole.indexOf("\n", offset + m.length);
    const after = whole.slice(offset + m.length, afterEnd === -1 ? whole.length : afterEnd);
    return !before.trim() && !after.trim();
  };
  // Any maths that's alone on its line is shown as a centred display equation, however it was
  // delimited — models often put a key formula on its own line in single dollars, and as
  // inline maths it would render small and cramped.
  const mathToken = (m, tex, offset, whole) => {
    if (!onOwnLine(m, offset, whole)) return inlineToken(mathHtml(tex, false));
    // Indented under a list item: display it, but inside that item.
    const indent = whole.slice(whole.lastIndexOf("\n", offset - 1) + 1, offset);
    if (/^[ \t]{2,}$/.test(indent)) return indent + inlineToken(mathHtml(tex, true, true));
    return blockToken(mathHtml(tex, true));
  };
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, mathToken);
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, mathToken);

  // 4. Inline maths — \(…\) or $…$. For dollars, the usual rules that keep prices out: the
  //    opening $ isn't followed by a space, the closing $ isn't preceded by one or followed by
  //    a digit, so "$5 and $10" stays text.
  src = src.replace(/\\\((.+?)\\\)/g, mathToken);
  src = src.replace(/(?<![\\$\w])\$(?![\s$])((?:\\\$|[^$\n])+?)(?<![\s\\])\$(?![\w$])/g, mathToken);

  // 5. Everything else is text: escape it, then tidy any stray TeX commands left in prose.
  const lines = texToText(escapeHtml(src)).split("\n");
  const html = [];
  let paragraph = [];
  let quote = [];
  // Open lists, innermost last: { type: "ul" | "ol", indent }
  const listStack = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push("<p>" + paragraph.join("<br>") + "</p>");
      paragraph = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push("<blockquote><p>" + quote.join("<br>") + "</p></blockquote>");
      quote = [];
    }
  };
  const closeListsTo = (depth) => {
    while (listStack.length > depth) {
      const l = listStack.pop();
      html.push("</li></" + l.type + ">");
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    closeListsTo(0);
  };

  const isTableRow = (line) => line.includes("|") && line.trim().length > 0;
  const isTableSeparator = (line) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
  const splitRow = (line) => {
    let t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushQuote();
      // A blank line inside a list doesn't end it if the list carries on right after.
      const next = lines.slice(i + 1).find((l) => l.trim());
      if (!next || !/^\s*([-*+]|\d+[.)])\s+/.test(next)) closeListsTo(0);
      continue;
    }

    const blockMatch = trimmed.match(new RegExp("^" + BLOCK_OPEN + "(\\d+)" + BLOCK_CLOSE + "$"));
    if (blockMatch) {
      flushAll();
      html.push(tokens[Number(blockMatch[1])]);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push("<hr>");
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushAll();
      const headerCells = splitRow(trimmed);
      let j = i + 2;
      const bodyRows = [];
      while (j < lines.length && lines[j].trim() && isTableRow(lines[j].trim())) {
        bodyRows.push(splitRow(lines[j]));
        j++;
      }
      const thead = "<thead><tr>" + headerCells.map((c) => `<th scope="col">${inline(c)}</th>`).join("") + "</tr></thead>";
      const tbody = "<tbody>" + bodyRows.map((row) => "<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
      // Focusable so a keyboard user can scroll a table wider than the screen.
      html.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="Table"><table>${thead}${tbody}</table></div>`);
      i = j - 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushAll();
      const level = Math.min(headingMatch[1].length + 2, 6); // "#" -> h3 … "####"+ -> h6
      html.push(`<h${level}>` + inline(headingMatch[2].replace(/\s+#+$/, "")) + `</h${level}>`);
      continue;
    }

    // Blockquotes (the ">" was escaped along with everything else).
    const quoteMatch = trimmed.match(/^&gt;\s?(.*)/);
    if (quoteMatch) {
      flushParagraph();
      closeListsTo(0);
      quote.push(inline(quoteMatch[1]));
      continue;
    }
    flushQuote();

    // Lists, nested by indentation.
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      const indent = listMatch[1].replace(/\t/g, "    ").length;
      const type = /\d/.test(listMatch[2]) ? "ol" : "ul";
      const start = type === "ol" ? parseInt(listMatch[2], 10) : 1;
      const open = type === "ol" && start > 1 ? `<ol start="${start}">` : "<" + type + ">";
      while (listStack.length && indent < listStack[listStack.length - 1].indent) closeListsTo(listStack.length - 1);
      const top = listStack[listStack.length - 1];
      if (!top || indent > top.indent) {
        html.push(open);
        listStack.push({ type, indent });
      } else if (top.type !== type) {
        closeListsTo(listStack.length - 1);
        html.push(open);
        listStack.push({ type, indent });
      } else {
        html.push("</li>");
      }
      html.push("<li>" + inline(listMatch[3]));
      continue;
    }

    // A plain line indented under a list item continues that item.
    if (listStack.length && /^\s{2,}\S/.test(line)) {
      html.push("<br>" + inline(trimmed));
      continue;
    }

    closeListsTo(0);
    paragraph.push(inline(trimmed));
  }
  flushAll();

  // Put the lifted-out code and maths back.
  return html
    .join("\n")
    .replace(new RegExp(INLINE_OPEN + "(\\d+)" + INLINE_CLOSE, "g"), (_m, idx) => tokens[Number(idx)]);
}
