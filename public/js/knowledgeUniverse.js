// The Knowledge Universe — every topic H1 has real evidence about, laid out as orbits
// around the subject it belongs to.
//
// The old knowledge map read only quiz events, so a topic you'd built a deck for but never
// been quizzed on simply didn't exist on it. This reads getTopicIntel(), which folds quizzes,
// flashcard scheduling state and the mistake book together — so the map shows everything the
// Brain actually knows, and nothing it doesn't.
//
// Encoding, stated in the legend so none of it is a mystery:
//   colour  — mastery band (and grey for "not enough answers to say yet")
//   size    — how many questions that judgement rests on
//   dashed  — not revisited recently
import { getTopicIntel } from "./secondBrain.js";
import { getAllSubjects } from "./subjectsStore.js";
import { switchView } from "./nav.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";

const NS = "http://www.w3.org/2000/svg";

// Cell width is set by the widest thing in it, which is a label, not a node: a ring-2 node
// sits 130px out, and its label runs another ~75px past that. 420 keeps both inside the cell
// so neighbouring subjects never overlap. Two columns rather than three for the same reason.
const CELL_W = 420;
// Height needs far less than width: vertically a cell only has to hold the outer ring plus
// the subject name, while horizontally it has to hold a label running off each side. Square
// cells left most of the map as empty space.
const CELL_H = 320;
const MAX_COLS = 2;
const SUN_R = 26;
const RING_1 = 80;
const RING_2 = 115;
const RING_STAGGER = 15;
const RING_CAPACITY = 8;
const LABEL_CHARS = 11;
// Past this a subject's orbits are too dense to read, so the rest are counted rather than
// drawn — an unreadable tangle is worse than an honest "+7 more".
const MAX_NODES_PER_SUBJECT = RING_CAPACITY * 2;

const STATUS_COLOR = {
  weak: "var(--danger)",
  shaky: "var(--warning)",
  solid: "var(--success)",
  unknown: "var(--text-faint)",
};

const STATUS_LABEL = {
  weak: "Needs work",
  shaky: "Getting there",
  solid: "Solid",
  unknown: "Not enough answers yet",
};

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function truncate(text, len) {
  return text.length > len ? text.slice(0, len - 1) + "…" : text;
}

// Node size encodes how much evidence there is, not how good the score is — a big red node
// means "we're sure this is weak", a small grey one means "barely tested".
function nodeRadius(topic) {
  const evidence = topic.total + topic.cardsTotal;
  if (evidence <= 0) return 6;
  return Math.min(15, 6 + Math.sqrt(evidence) * 1.4);
}

function subjectLabelFor(key) {
  const found = getAllSubjects().find((s) => s.key === key);
  return found ? found.label : key || "General";
}

function initials(label) {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function summaryLine(t) {
  const bits = [];
  if (t.accuracyPct !== null) bits.push(`${t.accuracyPct}% over ${t.total} question${t.total === 1 ? "" : "s"}`);
  else if (t.total > 0) bits.push(`${t.total} question${t.total === 1 ? "" : "s"} answered`);
  if (t.attempts > 0) bits.push(`${t.attempts} quiz${t.attempts === 1 ? "" : "zes"}`);
  if (t.cardsTotal > 0) bits.push(`${t.cardsDue}/${t.cardsTotal} cards due`);
  if (t.mistakes > 0) bits.push(`${t.mistakes} mistake${t.mistakes === 1 ? "" : "s"} saved`);
  if (t.daysSinceStudied !== null) bits.push(t.daysSinceStudied === 0 ? "studied today" : `last touched ${t.daysSinceStudied}d ago`);
  return bits.join(" · ");
}

export function renderKnowledgeUniverse(container) {
  if (!container) return;
  container.innerHTML = "";

  const intel = getTopicIntel();
  if (intel.topics.length === 0) {
    container.appendChild(
      el(
        "p",
        "context-empty",
        "Nothing to map yet. Every quiz you take and every deck you build adds a topic here — H1 won't invent subjects you haven't studied."
      )
    );
    return;
  }

  // Group by subject. A topic's subject comes from the activity that created it, so this is
  // the student's own filing, not a guess.
  const bySubject = {};
  intel.topics.forEach((t) => {
    const key = t.subject || "general";
    if (!bySubject[key]) bySubject[key] = [];
    bySubject[key].push(t);
  });
  // Busiest subject first, so the eye lands on where the work actually is.
  const groups = Object.entries(bySubject)
    .map(([key, topics]) => ({ key, label: subjectLabelFor(key), topics }))
    .sort((a, b) => b.topics.length - a.topics.length);

  const cols = Math.min(MAX_COLS, groups.length);
  const rows = Math.ceil(groups.length / cols);
  const width = cols * CELL_W;
  const height = rows * CELL_H;

  const stage = el("div", "universe-stage");
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    class: "universe-svg",
    // "group", not "img": an img role hides everything inside it from screen readers, and the
    // topic nodes in here are real buttons.
    role: "group",
    "aria-label": `Knowledge map of ${intel.topics.length} topics across ${groups.length} subjects`,
  });
  // Never shrink below its natural size — a scaled-down map is an unreadable one. On a
  // narrow screen the stage scrolls horizontally instead.
  svg.style.minWidth = `${width}px`;
  svg.style.maxWidth = `${width}px`;

  const defs = svgEl("defs");
  const grad = svgEl("linearGradient", { id: "kuSun", x1: "0", y1: "0", x2: "1", y2: "1" });
  const s1 = svgEl("stop", { offset: "0" });
  s1.style.stopColor = "var(--accent-1)";
  const s2 = svgEl("stop", { offset: "1" });
  s2.style.stopColor = "var(--accent-2)";
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const tooltip = el("div", "universe-tooltip");
  tooltip.hidden = true;

  const detail = el("div", "universe-detail");
  detail.hidden = true;

  function showDetail(t) {
    detail.innerHTML = "";
    detail.hidden = false;

    const head = el("div", "universe-detail-head");
    const titles = el("div");
    titles.appendChild(el("h3", null, t.topic));
    titles.appendChild(el("p", "universe-detail-sub", `${t.subjectLabel} · ${STATUS_LABEL[t.status]}`));
    head.appendChild(titles);
    const close = el("button", "icon-btn", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close topic details");
    close.addEventListener("click", () => {
      detail.hidden = true;
    });
    head.appendChild(close);
    detail.appendChild(head);

    detail.appendChild(el("p", "universe-detail-stats", summaryLine(t) || "No measurements recorded for this topic yet."));

    if (t.trend && t.trend.direction !== "steady") {
      detail.appendChild(
        el(
          "p",
          "universe-detail-trend",
          `${t.trend.direction === "improving" ? "Improving" : "Slipping"}: your earlier quizzes on this averaged ${t.trend.before}%, your recent ones ${t.trend.after}%.`
        )
      );
    }
    if (!t.graded) {
      detail.appendChild(
        el(
          "p",
          "universe-detail-note",
          `H1 won't put a score on this yet — it takes at least 4 answered questions, and there ${t.total === 1 ? "has been 1" : `have been ${t.total}`} so far.`
        )
      );
    }
    if (t.isStale && t.daysSinceStudied !== null) {
      detail.appendChild(el("p", "universe-detail-note", `Not revisited in ${t.daysSinceStudied} days.`));
    }

    const actions = el("div", "universe-detail-actions");
    const quiz = el("button", "btn btn-primary brain-btn-sm", "Quiz me on this");
    quiz.type = "button";
    quiz.addEventListener("click", () => {
      switchView("quiz");
      startQuizWithTopic(t.topic);
    });
    const cards = el("button", "btn btn-ghost brain-btn-sm", "Flashcards");
    cards.type = "button";
    cards.addEventListener("click", () => {
      switchView("flashcards");
      startFlashcardsWithTopic(t.topic);
    });
    actions.appendChild(quiz);
    actions.appendChild(cards);
    detail.appendChild(actions);
  }

  groups.forEach((group, gi) => {
    const col = gi % cols;
    const row = Math.floor(gi / cols);
    // Centre a final row that doesn't fill its columns, rather than leaving a lone subject
    // hard left with half the map empty beside it.
    const itemsInRow = Math.min(cols, groups.length - row * cols);
    const rowOffset = ((cols - itemsInRow) * CELL_W) / 2;
    const cx = rowOffset + col * CELL_W + CELL_W / 2;
    const cy = row * CELL_H + CELL_H / 2;

    const g = svgEl("g");

    // Faint orbit guides, so the rings read as structure rather than scattered dots.
    const shown = group.topics.slice(0, MAX_NODES_PER_SUBJECT);
    const hidden = group.topics.length - shown.length;
    const usedRings = shown.length > RING_CAPACITY ? [RING_1, RING_2] : [RING_1];
    usedRings.forEach((r) => {
      g.appendChild(svgEl("circle", { cx, cy, r, fill: "none", stroke: "var(--border)", "stroke-width": 1, opacity: 0.5 }));
    });

    const ring1 = shown.slice(0, RING_CAPACITY);
    const ring2 = shown.slice(RING_CAPACITY);

    const place = (list, baseRadius) => {
      list.forEach((t, i) => {
        const angle = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
        // Alternate the radius slightly so neighbouring labels don't sit on top of each other.
        const r = baseRadius + (i % 2 === 0 ? 0 : RING_STAGGER);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const color = STATUS_COLOR[t.status];
        const radius = nodeRadius(t);

        g.appendChild(
          svgEl("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: color, "stroke-width": 1.5, opacity: 0.35 })
        );

        const node = svgEl("g", { class: "universe-node", tabindex: "0", role: "button" });
        node.setAttribute("aria-label", `${t.topic}. ${STATUS_LABEL[t.status]}. ${summaryLine(t)}`);

        if (t.isStale) {
          // A dashed stroke applied to the node itself turns a 6px circle into a cog. The
          // staleness marker is a separate ring sitting outside the dot instead.
          node.appendChild(
            svgEl("circle", {
              cx: x,
              cy: y,
              r: radius + 4,
              fill: "none",
              stroke: color,
              "stroke-width": 1.2,
              "stroke-dasharray": "2.5 3",
              opacity: 0.85,
              class: "universe-stale-ring",
            })
          );
        }
        const dot = svgEl("circle", {
          cx: x,
          cy: y,
          r: radius,
          fill: color,
          "fill-opacity": t.graded ? 0.9 : 0.45,
          stroke: color,
          "stroke-width": 1,
          class: "universe-dot",
        });
        node.appendChild(dot);

        // Anchor labels away from the centre so they don't run back over the sun. The gap
        // has to clear the staleness ring too, which sits 4px outside the dot.
        const labelGap = radius + (t.isStale ? 10 : 6);
        const labelX = x + (Math.cos(angle) >= 0 ? labelGap : -labelGap);
        const label = svgEl("text", {
          x: labelX,
          y: y + 3.5,
          "text-anchor": Math.cos(angle) >= 0 ? "start" : "end",
          "font-size": "9.5",
          fill: "var(--text-muted)",
        });
        label.textContent = truncate(t.topic, LABEL_CHARS);
        node.appendChild(label);

        const show = (evt) => {
          tooltip.innerHTML = "";
          tooltip.appendChild(el("strong", null, t.topic));
          tooltip.appendChild(el("span", "universe-tooltip-status", STATUS_LABEL[t.status]));
          const line = summaryLine(t);
          if (line) tooltip.appendChild(el("span", null, line));
          tooltip.hidden = false;
          const box = stage.getBoundingClientRect();
          const px = (evt.clientX !== undefined ? evt.clientX : box.left + box.width / 2) - box.left;
          const py = (evt.clientY !== undefined ? evt.clientY : box.top + box.height / 2) - box.top;
          tooltip.style.left = `${Math.min(Math.max(8, px + 12), box.width - 220)}px`;
          tooltip.style.top = `${Math.max(8, py - 8)}px`;
        };
        const hide = () => {
          tooltip.hidden = true;
        };

        node.addEventListener("mousemove", show);
        node.addEventListener("mouseenter", show);
        node.addEventListener("mouseleave", hide);
        node.addEventListener("focus", show);
        node.addEventListener("blur", hide);
        node.addEventListener("click", () => showDetail(t));
        node.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showDetail(t);
          }
        });

        g.appendChild(node);
      });
    };

    place(ring1, RING_1);
    place(ring2, RING_2);

    g.appendChild(svgEl("circle", { cx, cy, r: SUN_R, fill: "url(#kuSun)" }));
    const sunText = svgEl("text", {
      x: cx,
      y: cy + 4,
      "text-anchor": "middle",
      "font-size": "12",
      "font-weight": "700",
    });
    sunText.style.fill = "var(--accent-contrast)";
    sunText.textContent = initials(group.label);
    g.appendChild(sunText);

    const nameText = svgEl("text", {
      x: cx,
      y: cy + SUN_R + 17,
      "text-anchor": "middle",
      "font-size": "11.5",
      "font-weight": "700",
      fill: "var(--text)",
    });
    nameText.textContent = group.label;
    g.appendChild(nameText);

    if (hidden > 0) {
      const moreText = svgEl("text", {
        x: cx,
        y: cy + SUN_R + 32,
        "text-anchor": "middle",
        "font-size": "10",
        fill: "var(--text-faint)",
      });
      moreText.textContent = `+${hidden} more topic${hidden === 1 ? "" : "s"} not shown`;
      g.appendChild(moreText);
    }

    svg.appendChild(g);
  });

  stage.appendChild(svg);
  stage.appendChild(tooltip);
  container.appendChild(stage);
  container.appendChild(detail);

  // The legend isn't decoration: every visual channel above encodes something, and a map you
  // have to guess at is worse than a list.
  const legend = el("div", "universe-legend");
  [
    ["weak", "Needs work — under 60%"],
    ["shaky", "Getting there — 60-79%"],
    ["solid", "Solid — 80%+"],
    ["unknown", "Not scored — under 4 answers"],
  ].forEach(([status, text]) => {
    const item = el("span", "universe-legend-item");
    const swatch = el("span", "universe-legend-dot");
    swatch.style.background = STATUS_COLOR[status];
    item.appendChild(swatch);
    item.appendChild(el("span", null, text));
    legend.appendChild(item);
  });
  const sizeNote = el("span", "universe-legend-item");
  sizeNote.appendChild(el("span", "universe-legend-dot universe-legend-dot-lg"));
  sizeNote.appendChild(el("span", null, "Bigger = more questions behind the judgement"));
  legend.appendChild(sizeNote);
  const staleNote = el("span", "universe-legend-item");
  staleNote.appendChild(el("span", "universe-legend-dot universe-legend-dot-dashed"));
  staleNote.appendChild(el("span", null, "Dashed = not revisited recently"));
  legend.appendChild(staleNote);
  container.appendChild(legend);
}
