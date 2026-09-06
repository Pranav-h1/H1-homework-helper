// Minimal, dependency-free markdown-ish renderer for AI chat output.
// Always escapes HTML first, then layers a small safe formatting subset on top —
// nothing here ever injects raw text as HTML.

export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (c) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[c];
  });
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
}

var BLOCK_TOKEN_PREFIX = "H1CODEBLOCK";

const LATEX_SYMBOLS = [
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\cdot/g, "·"],
  [/\\pm/g, "±"],
  [/\\leq?/g, "≤"],
  [/\\geq?/g, "≥"],
  [/\\neq/g, "≠"],
  [/\\approx/g, "≈"],
  [/\\infty/g, "∞"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\degree/g, "°"],
];

// The system prompt asks the AI to write math with plain symbols instead of LaTeX, but model
// compliance isn't perfectly reliable — this is a defensive cleanup pass so a stray "$2x=14$"
// or "\times" never reaches the student as raw markup. Applied only to prose, never to fenced
// code (a code sample legitimately showing LaTeX shouldn't be rewritten).
function cleanLatexArtifacts(text) {
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
  // Strip LaTeX math delimiters but keep the (now-cleaned) content inside them.
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, "$1");
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, "$1");
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, "$1");
  out = out.replace(/\$([^$\n]+?)\$/g, "$1");
  return out;
}

export function renderMarkdown(raw) {
  const text = escapeHtml(String(raw)).replace(/\r\n/g, "\n");

  // Pull fenced code blocks out first, on their own guaranteed line, so nothing
  // else in this function reformats their contents.
  const blocks = [];
  const withBlocksExtracted = text.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, function (_m, _lang, code) {
    const idx = blocks.length;
    blocks.push("<pre><code>" + code.replace(/\n$/, "") + "</code></pre>");
    return "\n" + BLOCK_TOKEN_PREFIX + idx + "\n";
  });

  const lines = cleanLatexArtifacts(withBlocksExtracted).split("\n");
  const htmlParts = [];
  let listBuffer = [];
  let listType = null;
  let paragraphBuffer = [];

  function isTableRow(line) {
    return line.includes("|") && line.trim().length > 0;
  }

  function isTableSeparator(line) {
    return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
  }

  function splitRow(line) {
    let t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|")) t = t.slice(0, -1);
    return t.split("|").map((c) => c.trim());
  }

  function flushList() {
    if (listBuffer.length) {
      htmlParts.push("<" + listType + ">" + listBuffer.join("") + "</" + listType + ">");
      listBuffer = [];
      listType = null;
    }
  }

  function flushParagraph() {
    if (paragraphBuffer.length) {
      htmlParts.push("<p>" + paragraphBuffer.join("<br>") + "</p>");
      paragraphBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      htmlParts.push("<hr>");
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      flushList();
      const headerCells = splitRow(trimmed);
      let j = i + 2;
      const bodyRows = [];
      while (j < lines.length && isTableRow(lines[j].trim()) && lines[j].trim()) {
        bodyRows.push(splitRow(lines[j]));
        j++;
      }
      const thead = "<thead><tr>" + headerCells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead>";
      const tbody =
        "<tbody>" +
        bodyRows.map((row) => "<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody>";
      htmlParts.push(`<div class="table-scroll"><table>${thead}${tbody}</table></div>`);
      i = j - 1;
      continue;
    }

    if (trimmed.indexOf(BLOCK_TOKEN_PREFIX) === 0) {
      const blockIdx = Number(trimmed.slice(BLOCK_TOKEN_PREFIX.length));
      flushParagraph();
      flushList();
      htmlParts.push(blocks[blockIdx]);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length + 2, 5); // "#" -> h3, "##" -> h4, "###"/"####" -> h5
      htmlParts.push(`<h${level}>` + inline(headingMatch[2]) + `</h${level}>`);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listBuffer.push("<li>" + inline(bulletMatch[1]) + "</li>");
      continue;
    }

    const numberMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
    if (numberMatch) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listBuffer.push("<li>" + inline(numberMatch[1]) + "</li>");
      continue;
    }

    flushList();
    paragraphBuffer.push(inline(trimmed));
  }
  flushParagraph();
  flushList();

  return htmlParts.join("\n");
}
