// Coding challenges: the list, and the screen for solving one.
import { CHALLENGES, DIFFICULTIES, SOLUTION_UNLOCK_ATTEMPTS, difficultyInfo, getChallenge } from "./pythonChallenges.js";
import {
  getChallengeState,
  saveChallengeDraft,
  resetChallengeCode,
  noteChallengeProgress,
  recordChallengeAttempt,
  getChallengeStats,
} from "./challengeStore.js";
import { createPythonWorkspace, renderCheckList } from "./pythonWorkspace.js";
import { renderMarkdown } from "./markdown.js";
import { decorateCodeBlocks } from "./codeBlocks.js";
import { highlight } from "./codeEditor.js";
import { invalidateBrain } from "./secondBrain.js";
import { isEnabled as gamificationEnabled } from "./gamification.js";
import { confirmDanger } from "./modal.js";
import { showToast } from "./toast.js";
import { selectSubtabInView } from "./subtabs.js";

const root = document.getElementById("codeChallengesRoot");

let view = { screen: "list", id: null };
let filter = { difficulty: "all", status: "all" };
let workspace = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el("button", className, label);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function prose(md) {
  const wrap = el("div", "code-prose");
  wrap.innerHTML = renderMarkdown(md || "");
  decorateCodeBlocks(wrap, { runPython: false });
  return wrap;
}

function disposeWorkspace() {
  if (workspace) {
    workspace.dispose();
    workspace = null;
  }
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function diffPill(id) {
  const info = difficultyInfo(id);
  return el("span", `ch-diff ch-diff-${id}`, info.label);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function renderList() {
  disposeWorkspace();
  root.innerHTML = "";
  const stats = getChallengeStats(CHALLENGES);

  const hero = el("div", "code-hero");
  hero.appendChild(el("h2", null, "Coding challenges"));
  hero.appendChild(
    el(
      "p",
      "code-hero-sub",
      "Short Python problems, marked by real tests. When a test fails you'll see exactly what your code returned next to what was expected — which is most of what debugging is."
    )
  );
  root.appendChild(hero);

  const statRow = el("div", "ch-stats");
  const stat = (value, label, sub) => {
    const s = el("div", "ch-stat");
    s.appendChild(el("div", "ch-stat-value", value));
    s.appendChild(el("div", "ch-stat-label", label));
    if (sub) s.appendChild(el("div", "ch-stat-sub", sub));
    return s;
  };
  statRow.appendChild(stat(`${stats.solved}/${stats.total}`, "Solved"));
  if (gamificationEnabled()) statRow.appendChild(stat(String(stats.xp), "XP from challenges"));
  statRow.appendChild(stat(stats.streak ? `${stats.streak} day${stats.streak === 1 ? "" : "s"}` : "—", "Solve streak", stats.streak ? null : "Solve one today to start"));
  statRow.appendChild(stat(String(stats.attempts), "Test runs"));
  root.appendChild(statRow);

  const bar = el("div", "ch-filters");
  const diffGroup = el("div", "ch-chip-group");
  diffGroup.setAttribute("role", "group");
  diffGroup.setAttribute("aria-label", "Filter by difficulty");
  [{ id: "all", label: "All" }, ...DIFFICULTIES].forEach((d) => {
    const counts = d.id === "all" ? { solved: stats.solved, total: stats.total } : stats.byDifficulty[d.id] || { solved: 0, total: 0 };
    const chip = button("", `ch-chip${filter.difficulty === d.id ? " active" : ""}`, () => {
      filter.difficulty = d.id;
      renderList();
    });
    chip.setAttribute("aria-pressed", String(filter.difficulty === d.id));
    chip.appendChild(el("span", null, d.label));
    chip.appendChild(el("span", "ch-chip-count", `${counts.solved}/${counts.total}`));
    diffGroup.appendChild(chip);
  });
  bar.appendChild(diffGroup);
  const statusSel = el("select", "tool-input ch-status");
  statusSel.setAttribute("aria-label", "Filter by status");
  [
    ["all", "All challenges"],
    ["unsolved", "Not solved yet"],
    ["solved", "Solved"],
  ].forEach(([v, label]) => {
    const o = el("option", null, label);
    o.value = v;
    if (filter.status === v) o.selected = true;
    statusSel.appendChild(o);
  });
  statusSel.addEventListener("change", () => {
    filter.status = statusSel.value;
    renderList();
  });
  bar.appendChild(statusSel);
  root.appendChild(bar);

  const shown = CHALLENGES.filter((c) => {
    if (filter.difficulty !== "all" && c.difficulty !== filter.difficulty) return false;
    const solved = Boolean(getChallengeState(c.id).solvedAt);
    if (filter.status === "solved" && !solved) return false;
    if (filter.status === "unsolved" && solved) return false;
    return true;
  });

  if (!shown.length) {
    const empty = el("div", "ch-empty");
    empty.appendChild(el("p", null, filter.status === "solved" ? "Nothing solved here yet — pick one and give it a go." : "Everything here is solved. Nice work."));
    empty.appendChild(
      button("Show all challenges", "btn btn-ghost brain-btn-sm", () => {
        filter = { difficulty: "all", status: "all" };
        renderList();
      })
    );
    root.appendChild(empty);
  } else {
    const grid = el("div", "ch-grid");
    shown.forEach((c) => {
      const st = getChallengeState(c.id);
      const card = el("button", `ch-card${st.solvedAt ? " solved" : ""}`);
      card.type = "button";
      const top = el("div", "ch-card-top");
      top.appendChild(diffPill(c.difficulty));
      const status = st.solvedAt ? "✓ Solved" : st.attempts ? `Tried ${st.attempts}×` : "";
      if (status) top.appendChild(el("span", `ch-card-status${st.solvedAt ? " ok" : ""}`, status));
      card.appendChild(top);
      card.appendChild(el("div", "ch-card-title", c.title));
      const foot = el("div", "ch-card-foot");
      foot.appendChild(el("span", "ch-card-topic", c.topic));
      if (gamificationEnabled()) foot.appendChild(el("span", "ch-card-xp", `${difficultyInfo(c.difficulty).xp} XP`));
      card.appendChild(foot);
      card.addEventListener("click", () => openChallenge(c.id));
      grid.appendChild(card);
    });
    root.appendChild(grid);
  }

  if (stats.recent.length) {
    const hist = el("div", "ch-history");
    hist.appendChild(el("div", "builder-templates-label", "Recent test runs"));
    const list = el("div", "ch-history-list");
    stats.recent.forEach((h) => {
      const c = getChallenge(h.id);
      if (!c) return;
      const row = button("", `ch-history-row${h.solved ? " ok" : ""}`, () => openChallenge(c.id));
      row.appendChild(el("span", "ch-history-mark", h.solved ? "✓" : "✗"));
      row.appendChild(el("span", "ch-history-title", c.title));
      row.appendChild(el("span", "ch-history-score", h.solved ? "all tests passed" : `${h.passed} of ${h.total} tests`));
      row.appendChild(el("span", "ch-history-time", timeAgo(h.at)));
      list.appendChild(row);
    });
    hist.appendChild(list);
    root.appendChild(hist);
  }
}

// ---------------------------------------------------------------------------
// Solving
// ---------------------------------------------------------------------------

function renderChallenge(id) {
  disposeWorkspace();
  const c = getChallenge(id);
  if (!c) {
    view = { screen: "list", id: null };
    return renderList();
  }
  root.innerHTML = "";
  const info = difficultyInfo(c.difficulty);
  const idx = CHALLENGES.indexOf(c);
  const next = CHALLENGES.slice(idx + 1).find((x) => !getChallengeState(x.id).solvedAt) || null;

  const crumb = el("div", "code-crumb");
  crumb.appendChild(
    button("← All challenges", "btn btn-ghost brain-btn-sm", () => {
      view = { screen: "list", id: null };
      renderList();
    })
  );
  root.appendChild(crumb);

  const layout = el("div", "pyl-layout ch-layout");
  const top = el("div", "pyl-teach pyl-teach-top");
  const bottom = el("div", "pyl-teach pyl-teach-bottom");
  const work = el("div", "pyl-work");

  const head = el("header", "pyl-head");
  const pills = el("div", "ch-head-pills");
  pills.appendChild(diffPill(c.difficulty));
  pills.appendChild(el("span", "ch-card-topic", c.topic));
  if (gamificationEnabled()) pills.appendChild(el("span", "ch-card-xp", `${info.xp} XP`));
  head.appendChild(pills);
  head.appendChild(el("h2", "code-lesson-heading", c.title));
  top.appendChild(head);

  const task = el("section", "pyl-section");
  task.appendChild(prose(c.prompt));
  const examples = c.checks.filter((k) => k.call !== undefined).slice(0, 3);
  if (examples.length) {
    const ex = el("div", "ch-examples");
    ex.appendChild(el("div", "pyl-label", "Examples"));
    examples.forEach((k) => {
      const row = el("div", "ch-example");
      const call = el("code");
      call.innerHTML = highlight(k.call, "python");
      row.appendChild(call);
      row.appendChild(el("span", "ch-arrow", "→"));
      const exp = el("code");
      exp.innerHTML = highlight(k.expect, "python");
      row.appendChild(exp);
      ex.appendChild(row);
    });
    task.appendChild(ex);
  }
  top.appendChild(task);

  // Hints
  const hints = el("section", "pyl-section pyl-hints");
  const hHead = el("div", "pyl-row-head");
  hHead.appendChild(el("div", "pyl-label", "Hints"));
  const hCount = el("span", "pyl-count");
  hHead.appendChild(hCount);
  hints.appendChild(hHead);
  const hList = el("ol", "pyl-hint-list");
  hints.appendChild(hList);
  const hBtn = button("", "btn btn-ghost brain-btn-sm", () => {
    const st = getChallengeState(c.id);
    noteChallengeProgress(c.id, { hintsShown: Math.min(c.hints.length, st.hintsShown + 1) });
    renderHints(true);
  });
  hints.appendChild(hBtn);
  function renderHints(markNew) {
    const st = getChallengeState(c.id);
    const shown = Math.min(st.hintsShown, c.hints.length);
    hList.innerHTML = "";
    c.hints.slice(0, shown).forEach((h) => {
      const li = el("li", "pyl-hint");
      li.appendChild(prose(h));
      hList.appendChild(li);
    });
    if (markNew && hList.lastElementChild) hList.lastElementChild.classList.add("is-new");
    hCount.textContent = `${shown} of ${c.hints.length} used`;
    hBtn.hidden = shown >= c.hints.length;
    hBtn.textContent = shown ? "Show the next hint" : "Show a hint";
  }
  renderHints(false);
  bottom.appendChild(hints);

  // Solution + explanation
  const sol = el("section", "pyl-section pyl-solution");
  sol.appendChild(el("div", "pyl-label", "Solution"));
  const solBody = el("div", "pyl-solution-body");
  sol.appendChild(solBody);
  const explain = el("section", "pyl-section ch-explain");
  function renderSolution() {
    const st = getChallengeState(c.id);
    solBody.innerHTML = "";
    explain.innerHTML = "";
    explain.hidden = !(st.solvedAt || st.solutionViewedAt);
    if (!explain.hidden) {
      explain.appendChild(el("div", "pyl-label", "How it works"));
      explain.appendChild(prose(c.explanation));
    }
    if (st.solutionViewedAt || st.solvedAt) {
      if (!st.solutionViewedAt && st.solvedAt) {
        solBody.appendChild(el("p", "pyl-note", "You solved it — compare your approach with this one."));
      }
      const wrap = el("div", "code-block");
      const barEl = el("div", "code-block-bar");
      barEl.appendChild(el("span", "code-block-lang", "Python"));
      wrap.appendChild(barEl);
      const pre = el("pre");
      pre.dataset.decorated = "1";
      const code = el("code");
      code.innerHTML = highlight(c.solution, "python");
      pre.appendChild(code);
      wrap.appendChild(pre);
      solBody.appendChild(wrap);
      if (st.solutionViewedAt && !st.solvedAt && gamificationEnabled()) {
        solBody.appendChild(el("p", "pyl-note", "You can still solve it for the record — but a solve after seeing the solution doesn't earn XP."));
      }
      return;
    }
    const left = SOLUTION_UNLOCK_ATTEMPTS - st.failedAttempts;
    if (left > 0) {
      solBody.appendChild(el("p", "pyl-note", `The solution unlocks after ${SOLUTION_UNLOCK_ATTEMPTS} attempts at the tests (${st.failedAttempts} of ${SOLUTION_UNLOCK_ATTEMPTS} so far). The hints are open now.`));
      return;
    }
    solBody.appendChild(el("p", "pyl-note", gamificationEnabled() ? "Unlocked. Looking now means this one won't earn XP when you solve it." : "Unlocked."));
    solBody.appendChild(
      button("Show the solution", "btn btn-ghost brain-btn-sm", () => {
        noteChallengeProgress(c.id, { solutionViewed: true });
        renderSolution();
      })
    );
  }
  bottom.appendChild(sol);
  bottom.appendChild(explain);
  renderSolution();

  const st0 = getChallengeState(c.id);
  const resetBtn = button("Reset", "pyw-tool", () => {
    confirmDanger("Reset to the starter code?", "Your code for this challenge goes back to how it started. Your attempts and history are kept.", "Reset", () => {
      resetChallengeCode(c.id);
      if (workspace) workspace.setCode(c.starter);
      showToast("Back to the starter code.", "success", 2000);
    });
  });
  resetBtn.title = "Reset to the starter code";

  workspace = createPythonWorkspace({
    code: st0.code !== null ? st0.code : c.starter,
    checks: c.checks,
    checkLabel: "Run tests",
    fileName: "solution.py",
    extraTools: [resetBtn],
    context: () => `Coding challenge "${c.title}": ${c.prompt}`,
    onChange: ({ code }) => saveChallengeDraft(c.id, code),
    onCheck: (res, host) => {
      const outcome = recordChallengeAttempt(c, res.checks);
      invalidateBrain();
      host.innerHTML = "";
      const summary = el("div", `code-result-summary${outcome.allPassed ? " passed" : ""}`);
      summary.appendChild(el("strong", null, outcome.allPassed ? "All tests passed" : `${outcome.passed} of ${outcome.total} tests passed`));
      if (outcome.justSolved) {
        const note = outcome.xp && gamificationEnabled() ? `Solved! +${outcome.xp} XP` : "Solved!";
        summary.appendChild(el("span", "code-result-note", note));
        host.classList.remove("pyw-celebrate");
        void host.offsetWidth;
        host.classList.add("pyw-celebrate");
      } else if (outcome.allPassed) {
        summary.appendChild(el("span", "code-result-note", "Already solved — and still passing."));
      } else if (res.error) {
        summary.appendChild(el("span", "code-result-note", "Your code stopped with an error before the tests could run properly — the explanation is above."));
      } else {
        const left = SOLUTION_UNLOCK_ATTEMPTS - outcome.failedAttempts;
        summary.appendChild(el("span", "code-result-note", left > 0 ? "Look at what your code returned for the failing tests — the difference usually points straight at the bug." : "The solution is unlocked below if you want it."));
      }
      host.appendChild(summary);
      renderCheckList(host, res.checks);
      if (outcome.allPassed) {
        const row = el("div", "code-next-row");
        if (next) {
          row.appendChild(button(`Next: ${next.title} →`, "btn btn-primary", () => openChallenge(next.id)));
        }
        row.appendChild(
          button("All challenges", "btn btn-ghost", () => {
            view = { screen: "list", id: null };
            renderList();
          })
        );
        host.appendChild(row);
      }
      renderSolution();
    },
  });
  work.appendChild(workspace.root);

  layout.appendChild(top);
  layout.appendChild(work);
  layout.appendChild(bottom);
  root.appendChild(layout);
}

export function openChallenge(id) {
  if (!root) return;
  selectSubtabInView("code", "challenges");
  view = { screen: "challenge", id };
  renderChallenge(id);
  const top = document.getElementById("view-code");
  if (top) top.scrollIntoView({ block: "start" });
}

export function renderChallenges() {
  if (!root) return;
  // Re-entering the tab shouldn't throw away an open challenge and whatever is running in it.
  if (view.screen === "challenge" && workspace && workspace.root.isConnected) return;
  if (view.screen === "challenge") return renderChallenge(view.id);
  renderList();
}

export function showChallengeList() {
  if (!root) return;
  selectSubtabInView("code", "challenges");
  view = { screen: "list", id: null };
  renderList();
}

export function initChallenges() {
  if (!root) return;
  renderList();
  const tab = document.querySelector('[data-view-panel="code"] [data-subtab="challenges"]');
  if (tab) tab.addEventListener("click", () => renderChallenges());
}
