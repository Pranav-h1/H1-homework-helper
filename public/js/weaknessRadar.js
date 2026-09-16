// Weakness Radar — subject-level accuracy as a shape, so the gaps are visible at a glance.
//
// The Knowledge Universe answers "which topics are weak?". This answers the coarser question
// underneath it: "which subject is dragging?" A radar is the right shape for that because a
// dent on one axis reads instantly, in a way six separate bars don't.
//
// It only draws when there are at least three subjects with enough answered questions to
// judge. Two axes isn't a shape, and plotting a subject off one lucky quiz would put a dent
// in the chart that means nothing — so below the bar it says how many more are needed
// instead of drawing something misleading.
import { getBrainState, MIN_QUESTIONS_FOR_BAND } from "./secondBrain.js";
import { getAllSubjects } from "./subjectsStore.js";
import { switchView } from "./nav.js";
import { setSubject } from "./state.js";

const NS = "http://www.w3.org/2000/svg";
const SIZE = 300;
const CENTRE = SIZE / 2;
const RADIUS = 104;
const MIN_AXES = 3;
const RINGS = [25, 50, 75, 100];

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

function subjectLabelFor(key) {
  const found = getAllSubjects().find((s) => s.key === key);
  return found ? found.label : key;
}

function pointAt(angle, distance) {
  return {
    x: CENTRE + Math.cos(angle) * distance,
    y: CENTRE + Math.sin(angle) * distance,
  };
}

export function renderWeaknessRadar(container) {
  if (!container) return;
  container.innerHTML = "";

  const state = getBrainState();
  // A subject qualifies on the same evidence bar a topic does — one shared definition of
  // "enough answers to judge", not a second one invented here.
  const subjects = state.stats.subjectStats
    .filter((s) => s.avgScorePct !== null && s.quizTotal >= MIN_QUESTIONS_FOR_BAND)
    .map((s) => ({ ...s, label: subjectLabelFor(s.subject) }))
    .sort((a, b) => a.avgScorePct - b.avgScorePct);

  if (subjects.length < MIN_AXES) {
    const need = MIN_AXES - subjects.length;
    container.appendChild(
      el(
        "p",
        "brain-empty-line",
        subjects.length === 0
          ? `No subject has ${MIN_QUESTIONS_FOR_BAND} answered quiz questions yet, so there's nothing to compare. Take a quiz in a couple of subjects and the radar appears.`
          : `${subjects.length} subject${subjects.length === 1 ? " has" : "s have"} enough answers to plot (${subjects
              .map((s) => s.label)
              .join(", ")}). A radar needs at least ${MIN_AXES} to be a shape worth reading — ${need} more to go.`
      )
    );
    return;
  }

  const stage = el("div", "radar-stage");
  const svg = svgEl("svg", {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    class: "radar-svg",
    role: "img",
    "aria-label": `Accuracy radar across ${subjects.length} subjects: ${subjects.map((s) => `${s.label} ${s.avgScorePct}%`).join(", ")}`,
  });

  const step = (Math.PI * 2) / subjects.length;
  // Start at the top rather than at 3 o'clock, so the shape reads the way a chart should.
  const angleFor = (i) => i * step - Math.PI / 2;
  const labelAngle = -Math.PI / 2 + step / 2;

  // Grid rings, labelled — an unlabelled radar can't be read off, only admired.
  RINGS.forEach((pct) => {
    const r = (pct / 100) * RADIUS;
    const pts = subjects.map((_, i) => {
      const p = pointAt(angleFor(i), r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    });
    svg.appendChild(
      svgEl("polygon", {
        points: pts.join(" "),
        fill: "none",
        stroke: "var(--border)",
        "stroke-width": pct === 100 ? 1.2 : 0.8,
        opacity: pct === 100 ? 0.9 : 0.5,
      })
    );
    // Ring labels go on the bisector between the first two axes, never along one. Stacked up
    // the vertical axis they sat directly under the top subject's own label and percentage.
    const lp = pointAt(labelAngle, r);
    const label = svgEl("text", {
      x: lp.x,
      y: lp.y - 3,
      "text-anchor": "middle",
      "font-size": "8.5",
      fill: "var(--text-faint)",
    });
    label.textContent = `${pct}%`;
    svg.appendChild(label);
  });

  // Spokes.
  subjects.forEach((_, i) => {
    const p = pointAt(angleFor(i), RADIUS);
    svg.appendChild(
      svgEl("line", { x1: CENTRE, y1: CENTRE, x2: p.x, y2: p.y, stroke: "var(--border)", "stroke-width": 0.8, opacity: 0.6 })
    );
  });

  // The accuracy shape itself.
  const shapePts = subjects.map((s, i) => pointAt(angleFor(i), (s.avgScorePct / 100) * RADIUS));
  svg.appendChild(
    svgEl("polygon", {
      points: shapePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
      fill: "rgba(var(--accent-1-rgb), 0.22)",
      stroke: "var(--accent-1)",
      "stroke-width": 2,
      "stroke-linejoin": "round",
    })
  );

  const tooltip = el("div", "radar-tooltip");
  tooltip.hidden = true;

  subjects.forEach((s, i) => {
    const angle = angleFor(i);
    const p = shapePts[i];
    const colour = s.avgScorePct < 60 ? "var(--danger)" : s.avgScorePct < 80 ? "var(--warning)" : "var(--success)";

    const node = svgEl("g", { class: "radar-node", tabindex: "0", role: "button" });
    node.setAttribute(
      "aria-label",
      `${s.label}: ${s.avgScorePct}% across ${s.quizTotal} quiz questions in ${s.quizzes} quiz${s.quizzes === 1 ? "" : "zes"}. Open this subject.`
    );
    node.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 5, fill: colour, stroke: "var(--bg)", "stroke-width": 1.5 }));

    // Axis label, pushed just outside the outer ring and anchored by which side it's on.
    const lp = pointAt(angle, RADIUS + 16);
    const cos = Math.cos(angle);
    const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
    const text = svgEl("text", {
      x: lp.x,
      y: lp.y + 3,
      "text-anchor": anchor,
      "font-size": "10",
      "font-weight": "600",
      fill: "var(--text-muted)",
      class: "radar-axis-label",
    });
    text.textContent = s.label.length > 12 ? s.label.slice(0, 11) + "…" : s.label;
    node.appendChild(text);

    const pctText = svgEl("text", {
      x: lp.x,
      y: lp.y + 15,
      "text-anchor": anchor,
      "font-size": "9.5",
      fill: colour,
    });
    pctText.textContent = `${s.avgScorePct}%`;
    node.appendChild(pctText);

    const show = (evt) => {
      tooltip.innerHTML = "";
      tooltip.appendChild(el("strong", null, s.label));
      tooltip.appendChild(
        el("span", null, `${s.avgScorePct}% across ${s.quizTotal} quiz question${s.quizTotal === 1 ? "" : "s"}`)
      );
      const extra = [];
      if (s.quizzes) extra.push(`${s.quizzes} quiz${s.quizzes === 1 ? "" : "zes"}`);
      if (s.questions) extra.push(`${s.questions} question${s.questions === 1 ? "" : "s"} asked`);
      if (s.studyMinutes) extra.push(`${s.studyMinutes} focus min`);
      if (extra.length) tooltip.appendChild(el("span", null, extra.join(" · ")));
      tooltip.hidden = false;
      const box = stage.getBoundingClientRect();
      const px = (evt.clientX !== undefined ? evt.clientX : box.left + box.width / 2) - box.left;
      const py = (evt.clientY !== undefined ? evt.clientY : box.top + box.height / 2) - box.top;
      tooltip.style.left = `${Math.min(Math.max(6, px + 12), Math.max(6, box.width - 200))}px`;
      tooltip.style.top = `${Math.max(6, py - 6)}px`;
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    const open = () => {
      setSubject(s.subject);
      switchView("subjects");
    };

    node.addEventListener("mouseenter", show);
    node.addEventListener("mousemove", show);
    node.addEventListener("mouseleave", hide);
    node.addEventListener("focus", show);
    node.addEventListener("blur", hide);
    node.addEventListener("click", open);
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    svg.appendChild(node);
  });

  stage.appendChild(svg);
  stage.appendChild(tooltip);
  container.appendChild(stage);

  // The shape alone doesn't say what to do about it, so name the dent in words.
  const worst = subjects[0];
  const best = subjects[subjects.length - 1];
  const gap = best.avgScorePct - worst.avgScorePct;
  const summary =
    gap >= 15
      ? `${worst.label} is your thinnest side at ${worst.avgScorePct}%, ${gap} points below ${best.label}. That gap is where the easiest marks are.`
      : `Your subjects are within ${gap} point${gap === 1 ? "" : "s"} of each other (${worst.avgScorePct}%–${best.avgScorePct}%) — no single subject is dragging.`;
  container.appendChild(el("p", "radar-summary", summary));
  container.appendChild(
    el(
      "p",
      "radar-note",
      `Plotted from quiz accuracy only, and only for subjects with at least ${MIN_QUESTIONS_FOR_BAND} answered questions. Subjects you haven't been quizzed on aren't shown rather than being drawn at zero.`
    )
  );
}
