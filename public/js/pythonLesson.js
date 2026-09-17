// The Python course: the level-by-level course page and the lesson screen.
//
// A lesson runs in the order people actually learn: read the idea, run an example, try the
// challenge, open hints one at a time, see the solution if needed, then a quick quiz. Every
// tick on the page is something that really happened — a check that passed on real Python, a
// quiz question answered — and hints and solutions are recorded rather than hidden, because
// "I needed the answer for this one" is useful to know later, not something to be ashamed of.
import { PY_LEVELS } from "./pythonCurriculum.js";
import { getTrack, getLesson } from "./codeCurriculum.js";
import {
  getLessonState,
  isComplete,
  saveDraft,
  resetLesson,
  recordAttempt,
  noteLessonProgress,
  recordQuizAnswer,
  getTrackProgress,
} from "./codeProgressStore.js";
import { createPythonWorkspace, renderCheckList, runSnippet } from "./pythonWorkspace.js";
import { renderMarkdown } from "./markdown.js";
import { decorateCodeBlocks } from "./codeBlocks.js";
import { highlight } from "./codeEditor.js";
import { sendChat, friendlyErrorMessage } from "./api.js";
import { logEvent } from "./progress.js";
import { showToast } from "./toast.js";
import { confirmDanger } from "./modal.js";
import { invalidateBrain } from "./secondBrain.js";
import { isEnabled as gamificationEnabled } from "./gamification.js";

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

function prose(md, className = "code-prose") {
  const wrap = el("div", className);
  wrap.innerHTML = renderMarkdown(md || "");
  decorateCodeBlocks(wrap, { runPython: false });
  return wrap;
}

function codeBlock(code, label = "Python") {
  const wrap = el("div", "code-block");
  const bar = el("div", "code-block-bar");
  bar.appendChild(el("span", "code-block-lang", label));
  const actions = el("div", "code-block-actions");
  bar.appendChild(actions);
  wrap.appendChild(bar);
  const pre = el("pre");
  pre.dataset.decorated = "1";
  const c = el("code");
  c.innerHTML = highlight(code, "python");
  pre.appendChild(c);
  wrap.appendChild(pre);
  return { wrap, actions };
}

function copyButton(text) {
  const b = button("Copy", "code-block-btn", async () => {
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = "Copied";
      b.classList.add("copied");
      setTimeout(() => {
        b.textContent = "Copy";
        b.classList.remove("copied");
      }, 1500);
    } catch {
      showToast("Couldn't copy — select the code and copy it manually.", "error", 2400);
    }
  });
  return b;
}

function levelOf(id) {
  return PY_LEVELS.find((l) => l.id === id) || { id, title: "", blurb: "" };
}

export function disposePythonLesson() {
  if (workspace) {
    workspace.dispose();
    workspace = null;
  }
}

function nextUp(lessons) {
  return lessons.find((l) => !isComplete(l.id)) || null;
}

// ---------------------------------------------------------------------------
// Course page
// ---------------------------------------------------------------------------

export function renderPythonCourse(root, nav) {
  disposePythonLesson();
  root.innerHTML = "";
  const lessons = getTrack("py");
  const overall = getTrackProgress(lessons);

  const crumb = el("div", "code-crumb");
  crumb.appendChild(button("← All tracks", "btn btn-ghost brain-btn-sm", nav.backToTracks));
  root.appendChild(crumb);

  const hero = el("div", "pyc-hero");
  const heroText = el("div", "pyc-hero-text");
  heroText.appendChild(el("div", "pyc-eyebrow", "Python course"));
  heroText.appendChild(el("h2", "pyc-title", "Learn Python from zero"));
  heroText.appendChild(
    el(
      "p",
      "code-hero-sub",
      `Real Python 3.12 running right here in your browser. ${PY_LEVELS.length} levels and ${lessons.length} lessons, from your very first print() to finished projects — and every challenge is marked by actually running your code.`
    )
  );
  const bar = el("div", "code-progress");
  const fill = el("div", "code-progress-fill");
  fill.style.width = `${overall.pct}%`;
  bar.appendChild(fill);
  heroText.appendChild(bar);
  heroText.appendChild(el("p", "code-progress-label", overall.done ? `${overall.done} of ${overall.total} lessons complete` : `${overall.total} lessons · start whenever you're ready`));
  hero.appendChild(heroText);

  const up = nextUp(lessons);
  const card = el("div", "pyc-next");
  if (up) {
    const st = getLessonState(up.id);
    const started = st.attempts > 0 || Boolean(st.code);
    card.appendChild(el("div", "pyc-next-k", overall.done === 0 && !started ? "Start here" : "Up next"));
    card.appendChild(el("div", "pyc-next-meta", `Level ${up.level} · Lesson ${up.index + 1}`));
    card.appendChild(el("div", "pyc-next-title", up.title));
    card.appendChild(el("p", "pyc-next-goal", up.goal));
    card.appendChild(button(started ? "Continue →" : "Start lesson →", "btn btn-primary", () => nav.openLesson(up.id)));
  } else {
    card.classList.add("done");
    card.appendChild(el("div", "pyc-next-k", "Course complete"));
    card.appendChild(el("div", "pyc-next-title", "Every lesson finished"));
    card.appendChild(el("p", "pyc-next-goal", "Keep your skills sharp with coding challenges, or build something of your own."));
    if (nav.openChallenges) card.appendChild(button("Try a challenge →", "btn btn-primary", nav.openChallenges));
  }
  hero.appendChild(card);
  root.appendChild(hero);

  const levels = el("div", "pyc-levels");
  PY_LEVELS.forEach((level) => {
    const inLevel = lessons.filter((l) => l.level === level.id);
    const p = getTrackProgress(inLevel);
    const complete = p.done === p.total && p.total > 0;
    const section = el("details", `pyc-level${complete ? " complete" : ""}`);
    // Finished levels fold away so the page opens on what's left to do.
    section.open = !complete;

    const sum = el("summary", "pyc-level-head");
    sum.appendChild(el("span", "pyc-level-num", complete ? "✓" : String(level.id)));
    const txt = el("div", "pyc-level-text");
    txt.appendChild(el("div", "pyc-level-k", `Level ${level.id}`));
    txt.appendChild(el("h3", "pyc-level-title", level.title));
    txt.appendChild(el("p", "pyc-level-blurb", level.blurb));
    sum.appendChild(txt);
    const side = el("div", "pyc-level-side");
    side.appendChild(el("span", "pyc-level-count", `${p.done} / ${p.total}`));
    const mini = el("div", "code-progress pyc-mini");
    const mf = el("div", "code-progress-fill");
    mf.style.width = `${p.pct}%`;
    mini.appendChild(mf);
    side.appendChild(mini);
    sum.appendChild(side);
    section.appendChild(sum);

    const list = el("div", "pyc-rows");
    inLevel.forEach((lesson) => {
      const st = getLessonState(lesson.id);
      const done = Boolean(st.completedAt);
      const isNext = up && up.id === lesson.id;
      const row = el("div", `pyc-row${done ? " done" : ""}${isNext ? " next" : ""}`);
      row.appendChild(el("span", "pyc-row-num", done ? "✓" : String(lesson.index + 1)));
      const main = el("div", "pyc-row-main");
      const title = el("div", "pyc-row-title", lesson.title);
      main.appendChild(title);
      main.appendChild(el("p", "pyc-row-goal", lesson.goal));
      row.appendChild(main);
      const meta = el("div", "pyc-row-side");
      const quizDone = (lesson.quiz || []).every((_, i) => st.quiz[i] !== undefined);
      if (done && quizDone && (lesson.quiz || []).length) meta.appendChild(el("span", "pyc-tag ok", "Quiz done"));
      else if (!done && (st.attempts > 0 || st.code)) meta.appendChild(el("span", "pyc-tag", "In progress"));
      const go = button(done ? "Review" : st.attempts > 0 || st.code ? "Continue" : "Start", `btn ${isNext ? "btn-primary" : "btn-ghost"} brain-btn-sm`, () => nav.openLesson(lesson.id));
      go.setAttribute("aria-label", `${go.textContent}: ${lesson.title}`);
      meta.appendChild(go);
      row.appendChild(meta);
      list.appendChild(row);
    });
    section.appendChild(list);
    levels.appendChild(section);
  });
  root.appendChild(levels);
}

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export function renderPythonLesson(root, lessonId, nav) {
  disposePythonLesson();
  const lesson = getLesson(lessonId);
  if (!lesson || lesson.track !== "py") return nav.backToCourse();
  root.innerHTML = "";
  const lessons = getTrack("py");
  const level = levelOf(lesson.level);
  let state = getLessonState(lesson.id);
  const refreshState = () => (state = getLessonState(lesson.id));

  // --- Crumb ---------------------------------------------------------------
  const crumb = el("div", "code-crumb");
  crumb.appendChild(button("← Python course", "btn btn-ghost brain-btn-sm", nav.backToCourse));
  crumb.appendChild(el("span", "code-crumb-step", `Level ${level.id} · Lesson ${lesson.index + 1} of ${lessons.length}`));
  root.appendChild(crumb);

  const layout = el("div", "pyl-layout");
  const teachTop = el("div", "pyl-teach pyl-teach-top");
  const teachBottom = el("div", "pyl-teach pyl-teach-bottom");
  const work = el("div", "pyl-work");

  // --- Header + steps --------------------------------------------------------
  const head = el("header", "pyl-head");
  head.appendChild(el("span", "pyl-level-pill", `Level ${level.id} · ${level.title}`));
  head.appendChild(el("h2", "code-lesson-heading", lesson.title));
  head.appendChild(el("p", "code-lesson-goal-big", lesson.goal));
  teachTop.appendChild(head);

  const steps = el("nav", "pyl-steps");
  steps.setAttribute("aria-label", "Lesson steps");
  teachTop.appendChild(steps);
  const sectionIds = {
    learn: `pyl-learn-${lesson.id}`,
    example: `pyl-example-${lesson.id}`,
    challenge: `pyl-challenge-${lesson.id}`,
    quiz: `pyl-quiz-${lesson.id}`,
  };
  function renderSteps() {
    refreshState();
    steps.innerHTML = "";
    const quizTotal = (lesson.quiz || []).length;
    const quizAnswered = Object.keys(state.quiz).length;
    // "Learn" is a place to jump to, not a box to tick — there's no honest way to know it was read.
    [
      ["learn", "Learn", null],
      ["example", "Example", Boolean(state.exampleRunAt)],
      ["challenge", "Challenge", Boolean(state.completedAt)],
      ["quiz", quizTotal ? `Quiz ${quizAnswered}/${quizTotal}` : "Quiz", quizTotal > 0 && quizAnswered === quizTotal],
    ].forEach(([key, label, done]) => {
      if (key === "example" && !lesson.example) return;
      if (key === "quiz" && !quizTotal) return;
      const s = button("", `pyl-step${done ? " done" : ""}${done === null ? " is-plain" : ""}`, () => {
        const target = document.getElementById(sectionIds[key]);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (done !== null) s.appendChild(el("span", "pyl-step-dot", done ? "✓" : ""));
      s.appendChild(el("span", "pyl-step-label", label));
      s.setAttribute("aria-label", done === null ? `Jump to ${label}` : `${label}${done ? " — done" : ""}`);
      steps.appendChild(s);
    });
  }
  renderSteps();

  // --- 1. Learn --------------------------------------------------------------
  const learn = el("section", "pyl-section");
  learn.id = sectionIds.learn;
  learn.appendChild(prose(lesson.concept));
  teachTop.appendChild(learn);

  // --- 2. Example ------------------------------------------------------------
  if (lesson.example) {
    const ex = el("section", "pyl-section pyl-example");
    ex.id = sectionIds.example;
    ex.appendChild(el("div", "pyl-label", "Example"));
    const block = codeBlock(lesson.example);
    const out = el("pre", "pyl-example-out");
    out.hidden = true;
    const runEx = button("▶ Run example", "code-block-btn code-block-run", async () => {
      runEx.disabled = true;
      out.hidden = false;
      out.className = "pyl-example-out";
      out.textContent = "Running…";
      const res = await runSnippet(lesson.example, { stdin: lesson.stdin || "", files: lesson.files || null });
      runEx.disabled = false;
      if (!out.isConnected) return;
      if (res.error) {
        out.classList.add("error");
        out.textContent = (res.output || "") + res.error.message;
      } else {
        out.textContent = res.output || "(nothing printed)";
      }
      noteLessonProgress(lesson.id, { exampleRun: true });
      renderSteps();
    });
    block.actions.appendChild(runEx);
    block.actions.appendChild(copyButton(lesson.example));
    ex.appendChild(block.wrap);
    if (lesson.stdin) ex.appendChild(el("p", "pyl-note", `This example reads input — it uses: ${lesson.stdin.split("\n").join(", ")}`));
    ex.appendChild(out);
    teachTop.appendChild(ex);
  }

  // --- 3. Challenge ----------------------------------------------------------
  const challenge = el("section", "pyl-section pyl-challenge");
  challenge.id = sectionIds.challenge;
  challenge.appendChild(el("div", "pyl-label", "Your challenge"));
  challenge.appendChild(prose(lesson.task));
  if (lesson.stdin) {
    challenge.appendChild(el("p", "pyl-note", "The Input box under the editor already has test answers in it. When you press Check, H1 also runs your program with other inputs to make sure it works for more than one case."));
  }
  teachTop.appendChild(challenge);

  // --- 4. Hints --------------------------------------------------------------
  const hints = el("section", "pyl-section pyl-hints");
  const hintHead = el("div", "pyl-row-head");
  hintHead.appendChild(el("div", "pyl-label", "Hints"));
  const hintCount = el("span", "pyl-count");
  hintHead.appendChild(hintCount);
  hints.appendChild(hintHead);
  const hintList = el("ol", "pyl-hint-list");
  hints.appendChild(hintList);
  const hintActions = el("div", "pyl-actions");
  const hintBtn = button("", "btn btn-ghost brain-btn-sm", () => {
    const n = Math.min((lesson.hints || []).length, state.hintsShown + 1);
    noteLessonProgress(lesson.id, { hintsShown: n });
    refreshState();
    renderHints(true);
  });
  hintActions.appendChild(hintBtn);
  const aiHintHost = el("div", "code-hint-host");
  const nudgeBtn = button("Ask H1 for a nudge", "btn btn-ghost brain-btn-sm", () => askForNudge(lesson, aiHintHost, nudgeBtn));
  hintActions.appendChild(nudgeBtn);
  hints.appendChild(hintActions);
  hints.appendChild(aiHintHost);
  function renderHints(focusLast) {
    const all = lesson.hints || [];
    const shown = Math.min(state.hintsShown, all.length);
    hintList.innerHTML = "";
    all.slice(0, shown).forEach((h) => {
      const li = el("li", "pyl-hint");
      li.appendChild(prose(h, "code-prose pyl-hint-text"));
      hintList.appendChild(li);
    });
    hintCount.textContent = `${shown} of ${all.length} used`;
    hintBtn.hidden = shown >= all.length;
    hintBtn.textContent = shown === 0 ? "Show a hint" : "Show the next hint";
    if (focusLast && hintList.lastElementChild) {
      hintList.lastElementChild.classList.add("is-new");
    }
  }
  renderHints(false);
  teachBottom.appendChild(hints);

  // --- 5. Solution -----------------------------------------------------------
  const sol = el("section", "pyl-section pyl-solution");
  sol.appendChild(el("div", "pyl-label", "Solution"));
  const solBody = el("div", "pyl-solution-body");
  sol.appendChild(solBody);
  function renderSolution() {
    refreshState();
    solBody.innerHTML = "";
    if (state.solutionViewedAt) {
      const block = codeBlock(lesson.solution);
      block.actions.appendChild(copyButton(lesson.solution));
      solBody.appendChild(block.wrap);
      solBody.appendChild(el("p", "pyl-note", "Type it out yourself rather than pasting it in — then change something and see what happens. That's what makes it stick."));
      return;
    }
    const reveal = () => {
      noteLessonProgress(lesson.id, { solutionViewed: true });
      renderSolution();
    };
    const b = button("Show the solution", "btn btn-ghost brain-btn-sm", () => {
      // Decided at the moment of asking: by now they may have run the checks or opened every
      // hint, and then there's nothing left to nudge them towards first.
      refreshState();
      if (state.attempts > 0 || state.hintsShown >= (lesson.hints || []).length) return reveal();
      solBody.innerHTML = "";
      const warn = el("div", "pyl-confirm");
      warn.appendChild(el("p", null, "Have a go first? Even a wrong attempt teaches you more than reading the answer — and the hints are there if you need them."));
      const row = el("div", "pyl-actions");
      row.appendChild(button("Show it anyway", "btn btn-ghost brain-btn-sm", reveal));
      row.appendChild(button("I'll try first", "btn btn-primary brain-btn-sm", () => {
        renderSolution();
        if (workspace) workspace.editor.focus();
      }));
      warn.appendChild(row);
      solBody.appendChild(warn);
    });
    solBody.appendChild(b);
  }
  renderSolution();
  teachBottom.appendChild(sol);

  // --- 6. Quiz ---------------------------------------------------------------
  if ((lesson.quiz || []).length) {
    const quiz = el("section", "pyl-section pyl-quiz");
    quiz.id = sectionIds.quiz;
    const qHead = el("div", "pyl-row-head");
    qHead.appendChild(el("div", "pyl-label", "Quick check"));
    const qScore = el("span", "pyl-count");
    qHead.appendChild(qScore);
    quiz.appendChild(qHead);
    const qList = el("div", "pyl-questions");
    quiz.appendChild(qList);

    const renderQuiz = () => {
      refreshState();
      qList.innerHTML = "";
      const total = lesson.quiz.length;
      const answered = Object.keys(state.quiz).length;
      const correct = lesson.quiz.filter((q, i) => state.quiz[i] === q.answer).length;
      qScore.textContent = answered === total ? `${correct} of ${total} right` : `${answered} of ${total} answered`;
      lesson.quiz.forEach((q, qi) => {
        const card = el("div", "pyl-q");
        const qid = `pyl-q-${lesson.id}-${qi}`;
        const qText = el("p", "pyl-q-text", q.q);
        qText.id = qid;
        card.appendChild(qText);
        const opts = el("div", "pyl-q-options");
        opts.setAttribute("role", "group");
        opts.setAttribute("aria-labelledby", qid);
        const chosen = state.quiz[qi];
        const isAnswered = chosen !== undefined;
        q.options.forEach((opt, oi) => {
          const o = button(opt, "pyl-q-opt", () => {
            const r = recordQuizAnswer(lesson, qi, oi);
            if (r && r.justFinished) {
              invalidateBrain();
              showToast(`Quick check done — ${r.score} of ${r.total} right.`, "success", 2600);
            }
            renderQuiz();
            renderSteps();
          });
          if (isAnswered) {
            o.disabled = true;
            if (oi === q.answer) o.classList.add("correct");
            if (oi === chosen && chosen !== q.answer) o.classList.add("wrong");
            if (oi === chosen) o.setAttribute("aria-pressed", "true");
          }
          opts.appendChild(o);
        });
        card.appendChild(opts);
        if (isAnswered) {
          const verdict = el("div", `pyl-q-why${chosen === q.answer ? " ok" : ""}`);
          verdict.appendChild(el("strong", null, chosen === q.answer ? "Correct. " : "Not quite. "));
          verdict.appendChild(document.createTextNode(q.why || ""));
          card.appendChild(verdict);
        }
        qList.appendChild(card);
      });
    };
    renderQuiz();
    teachBottom.appendChild(quiz);
  }

  // --- Prev / next -----------------------------------------------------------
  const pager = el("div", "pyl-pager");
  const prev = lessons[lesson.index - 1];
  const next = lessons[lesson.index + 1];
  if (prev) pager.appendChild(button(`← ${prev.title}`, "btn btn-ghost brain-btn-sm", () => nav.openLesson(prev.id)));
  else pager.appendChild(el("span"));
  if (next) pager.appendChild(button(`${next.title} →`, "btn btn-ghost brain-btn-sm", () => nav.openLesson(next.id)));
  teachBottom.appendChild(pager);

  // --- Workspace -------------------------------------------------------------
  const saved = state.code && typeof state.code === "object" ? state.code : {};
  const resetBtn = button("Reset", "pyw-tool", () => {
    confirmDanger("Reset to the starter code?", "Your code for this lesson goes back to how it started. Your progress, hints and quiz answers are kept.", "Reset", () => {
      resetLesson(lesson.id);
      if (workspace) {
        workspace.setCode(lesson.starter || "");
        workspace.setStdin(lesson.stdin || "");
      }
      showToast("Back to the starter code.", "success", 2000);
    });
  });
  resetBtn.title = "Reset to the starter code";

  // A lesson that reads input is marked against its own test input, not whatever the student
  // has typed into the Input box while experimenting — "Works for Asha, 15" has to mean that.
  const lessonChecks = (lesson.checks || []).map((c) => (lesson.stdin !== undefined && c.stdin === undefined ? { ...c, stdin: lesson.stdin } : c));

  workspace = createPythonWorkspace({
    code: typeof saved.py === "string" ? saved.py : lesson.starter || "",
    stdin: typeof saved.stdin === "string" ? saved.stdin : lesson.stdin || "",
    files: lesson.files || null,
    checks: lessonChecks,
    fileName: "main.py",
    extraTools: [resetBtn],
    context: () => `Python lesson "${lesson.title}". The challenge: ${lesson.task}`,
    onChange: ({ code, stdin }) => saveDraft(lesson.id, { py: code, stdin }),
    onCheck: (res, host) => {
      // Only checks written with their own input say "With input: …"; the ones pinned to the
      // lesson's default input above would just repeat it on every row.
      res.checks.forEach((c, i) => {
        if (lesson.checks[i] && lesson.checks[i].stdin === undefined) delete c.stdin;
      });
      const outcome = recordAttempt(lesson, res.checks);
      invalidateBrain();
      renderOutcome(host, res, outcome);
      renderSteps();
      renderSolution();
    },
  });
  work.appendChild(workspace.root);

  function renderOutcome(host, res, outcome) {
    host.innerHTML = "";
    const summary = el("div", `code-result-summary${outcome.allPassed ? " passed" : ""}`);
    summary.appendChild(el("strong", null, outcome.allPassed ? "All checks passed" : `${outcome.passed} of ${outcome.total} checks passed`));
    if (outcome.justCompleted) {
      summary.appendChild(el("span", "code-result-note", `Lesson complete${gamificationEnabled() ? " — XP earned" : ""}.`));
    } else if (outcome.allPassed) {
      summary.appendChild(el("span", "code-result-note", "Already complete — and it still works."));
    } else if (res.error) {
      summary.appendChild(el("span", "code-result-note", "Your program stopped with an error before the checks could see what it does — fix that first (it's explained above)."));
    } else if (outcome.firstResult) {
      summary.appendChild(el("span", "code-result-note", "Your first attempt is the one that counts in your Learning Brain. Retries are free — keep going."));
    }
    host.appendChild(summary);
    renderCheckList(host, res.checks);

    if (outcome.allPassed) {
      host.classList.remove("pyw-celebrate");
      // Restart the animation on repeat passes.
      void host.offsetWidth;
      if (outcome.justCompleted) host.classList.add("pyw-celebrate");
      const row = el("div", "code-next-row");
      const quizLeft = (lesson.quiz || []).some((_, i) => getLessonState(lesson.id).quiz[i] === undefined);
      if (quizLeft) {
        row.appendChild(
          button("Take the quick check", "btn btn-ghost", () => {
            const target = document.getElementById(sectionIds.quiz);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          })
        );
      }
      if (next) row.appendChild(button(`Next: ${next.title} →`, "btn btn-primary", () => nav.openLesson(next.id)));
      else {
        row.appendChild(el("span", "code-result-note", "That's the whole Python course finished. Brilliant work."));
        if (nav.openChallenges) row.appendChild(button("Try a coding challenge →", "btn btn-primary", nav.openChallenges));
      }
      host.appendChild(row);
    }
  }

  layout.appendChild(teachTop);
  layout.appendChild(work);
  layout.appendChild(teachBottom);
  root.appendChild(layout);
}

// ---------------------------------------------------------------------------
// AI nudge — points at what to change, never hands over the answer
// ---------------------------------------------------------------------------

async function askForNudge(lesson, host, btnEl) {
  btnEl.disabled = true;
  host.innerHTML = "";
  host.appendChild(el("p", "code-hint-loading", "Asking H1 for a nudge…"));
  const code = workspace ? workspace.getCode() : "";
  const message =
    `I'm learning Python and I'm stuck on this challenge. My current code is attached as main.py.\n\n` +
    `Challenge: ${lesson.task}\n\n` +
    `Give me ONE specific hint that points at what to change next. Do NOT write the solution and do not paste corrected code — I want to work it out myself.`;
  try {
    const reply = await sendChat(
      [{ role: "user", content: message.slice(0, 3900), documents: [{ name: "main.py", text: code || "(empty)" }] }],
      "coding",
      { mode: "examcoach", language: "en" }
    );
    logEvent("question", { source: "code_lab", subject: "coding", topic: lesson.title });
    host.innerHTML = "";
    const panel = el("div", "code-hint-panel");
    panel.appendChild(el("div", "code-hint-label", "A nudge from H1"));
    panel.appendChild(prose(reply));
    host.appendChild(panel);
  } catch (err) {
    host.innerHTML = "";
    host.appendChild(el("p", "code-hint-error", friendlyErrorMessage(err)));
  } finally {
    btnEl.disabled = false;
  }
}
