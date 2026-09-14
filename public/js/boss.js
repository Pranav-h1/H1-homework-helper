// Boss Battle — a hard, mixed quiz assembled from the topics the student is actually
// weakest at, with stakes.
//
// The boss is never generic. It's built from real weak/shaky topics the Second Brain has
// enough evidence to name, so there's nothing to fight until there's something real to fight
// about — and the intro screen says exactly which topics it drew from and why.
//
// Crucially, the result is logged per topic, not against some invented "Boss Battle" label.
// Each question comes back tagged with which of the requested topics it covers (see the
// server's topic-tag rule), so beating the boss moves the same numbers a normal quiz would.
// Questions the model failed to tag are counted in the fight but left out of the per-topic
// log rather than attributed to a guess.
import { getTopicIntel, invalidateBrain } from "./secondBrain.js";
import { fetchQuiz, friendlyErrorMessage } from "./api.js";
import { logEvent } from "./progress.js";
import { addMistake } from "./mistakeBookStore.js";
import { appState } from "./state.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { isEnabled as gamificationEnabled } from "./gamification.js";

const intro = document.getElementById("bossIntro");
const fight = document.getElementById("bossFight");
const results = document.getElementById("bossResults");

const introBody = document.getElementById("bossIntroBody");
const startBtn = document.getElementById("bossStartBtn");
const loading = document.getElementById("bossLoading");

const hpBar = document.getElementById("bossHpFill");
const hpLabel = document.getElementById("bossHpLabel");
const livesRow = document.getElementById("bossLives");
const comboLabel = document.getElementById("bossCombo");
const bossName = document.getElementById("bossName");
const bossTopicTag = document.getElementById("bossTopicTag");
const questionCounter = document.getElementById("bossCounter");
const questionText = document.getElementById("bossQuestion");
const optionsWrap = document.getElementById("bossOptions");
const shortWrap = document.getElementById("bossShortWrap");
const shortInput = document.getElementById("bossShortInput");
const checkBtn = document.getElementById("bossCheckBtn");
const selfGrade = document.getElementById("bossSelfGrade");
const selfRightBtn = document.getElementById("bossSelfRightBtn");
const selfWrongBtn = document.getElementById("bossSelfWrongBtn");
const modelAnswer = document.getElementById("bossModelAnswer");
const feedback = document.getElementById("bossFeedback");
const nextBtn = document.getElementById("bossNextBtn");
const quitBtn = document.getElementById("bossQuitBtn");

const resultTitle = document.getElementById("bossResultTitle");
const resultSub = document.getElementById("bossResultSub");
const resultBreakdown = document.getElementById("bossResultBreakdown");
const againBtn = document.getElementById("bossAgainBtn");
const backBtn = document.getElementById("bossBackBtn");

// A boss needs at least two real weaknesses to be built from — one topic is just a quiz.
const MIN_TOPICS = 2;
const MAX_TOPICS = 3;
const QUESTION_COUNT = 10;
const STARTING_LIVES = 3;

let state = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Weakest first, then shaky. Only graded topics qualify: H1 won't call something a weakness
// on the strength of two answers.
function candidateTopics() {
  const intel = getTopicIntel();
  return [...intel.weak, ...intel.shaky].slice(0, MAX_TOPICS);
}

function bossTitle(topics) {
  if (topics.length === 1) return `The ${topics[0].topic} Boss`;
  const names = topics.map((t) => t.topic);
  return `The ${names.slice(0, -1).join(", ")} & ${names[names.length - 1]} Boss`;
}

function show(panel) {
  intro.hidden = panel !== intro;
  fight.hidden = panel !== fight;
  results.hidden = panel !== results;
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

export function renderBoss() {
  if (!intro) return;
  // Mid-fight, leaving and coming back shouldn't wipe the battle.
  if (state && !state.finished) return;

  invalidateBrain();
  show(intro);
  introBody.innerHTML = "";
  loading.hidden = true;

  const topics = candidateTopics();

  if (topics.length < MIN_TOPICS) {
    startBtn.disabled = true;
    startBtn.textContent = "Not available yet";
    const intel = getTopicIntel();
    introBody.appendChild(el("h2", null, "No boss to fight yet"));
    introBody.appendChild(
      el(
        "p",
        "boss-intro-line",
        `A Boss Battle is built from the topics you're actually weakest at, so H1 needs at least ${MIN_TOPICS} of them on record before it can make one. Right now it has ${topics.length}.`
      )
    );
    introBody.appendChild(
      el(
        "p",
        "boss-intro-line",
        `A topic only counts once you've answered at least 4 questions on it and scored under 80% — ${intel.graded.length} of your ${intel.topics.length} topic${intel.topics.length === 1 ? " has" : "s have"} enough answers to judge at all. Take a few quizzes and one will assemble itself.`
      )
    );
    const go = el("button", "btn btn-primary", "Go to Quiz Lab");
    go.type = "button";
    go.addEventListener("click", () => switchView("quiz"));
    const row = el("div", "boss-intro-actions");
    row.appendChild(go);
    introBody.appendChild(row);
    return;
  }

  startBtn.disabled = false;
  startBtn.textContent = "Start the battle";

  introBody.appendChild(el("div", "boss-sigil", "👾"));
  introBody.appendChild(el("h2", null, bossTitle(topics)));
  introBody.appendChild(
    el(
      "p",
      "boss-intro-line",
      `${QUESTION_COUNT} hard questions across the topics below. Every right answer takes a chunk off the boss; every wrong one costs a life, and you have ${STARTING_LIVES}.`
    )
  );

  const list = el("div", "boss-topic-list");
  topics.forEach((t) => {
    const row = el("div", "boss-topic-row");
    const left = el("div");
    left.appendChild(el("strong", null, t.topic));
    left.appendChild(
      el("p", "boss-topic-why", `${t.accuracyPct}% across ${t.total} questions — that's why it's here.`)
    );
    row.appendChild(left);
    const pct = el("span", "boss-topic-pct", `${t.accuracyPct}%`);
    pct.dataset.status = t.status;
    row.appendChild(pct);
    list.appendChild(row);
  });
  introBody.appendChild(list);

  introBody.appendChild(
    el(
      "p",
      "boss-intro-note",
      "Results count for real: each question is tagged with the topic it tests, and your score is logged against those topics the same way a normal quiz is. Win or lose, this moves your Learning Brain."
    )
  );
}

// ---------------------------------------------------------------------------
// Fight
// ---------------------------------------------------------------------------

async function startBattle() {
  const topics = candidateTopics();
  if (topics.length < MIN_TOPICS) return;

  loading.hidden = false;
  startBtn.disabled = true;
  startBtn.textContent = "Summoning…";

  try {
    const names = topics.map((t) => t.topic);
    const questions = await fetchQuiz(names.join(", "), "hard", QUESTION_COUNT, appState.subject, {
      questionType: "mixed",
      topics: names,
    });

    state = {
      title: bossTitle(topics),
      topics: names,
      questions,
      index: 0,
      maxHp: questions.length,
      hp: questions.length,
      lives: STARTING_LIVES,
      combo: 0,
      bestCombo: 0,
      answered: false,
      finished: false,
      // Per-topic tallies, so the result can be logged honestly rather than as one blob.
      perTopic: Object.fromEntries(names.map((n) => [n, { correct: 0, total: 0 }])),
      untagged: 0,
    };
    show(fight);
    renderQuestion();
  } catch (err) {
    loading.hidden = true;
    startBtn.disabled = false;
    startBtn.textContent = "Start the battle";
    showToast(friendlyErrorMessage(err), "error", 4000);
  }
}

function renderLives() {
  livesRow.innerHTML = "";
  for (let i = 0; i < STARTING_LIVES; i++) {
    const heart = el("span", `boss-life${i < state.lives ? "" : " lost"}`, "♥");
    heart.setAttribute("aria-hidden", "true");
    livesRow.appendChild(heart);
  }
  livesRow.setAttribute("aria-label", `${state.lives} of ${STARTING_LIVES} lives left`);
}

function renderHp() {
  const pct = Math.max(0, Math.round((state.hp / state.maxHp) * 100));
  hpBar.style.width = `${pct}%`;
  hpLabel.textContent = `${state.hp} / ${state.maxHp}`;
  hpBar.parentElement.setAttribute("aria-valuenow", String(state.hp));
}

function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;

  bossName.textContent = state.title;
  bossTopicTag.textContent = q.topic || "Mixed";
  bossTopicTag.hidden = false;
  questionCounter.textContent = `Question ${state.index + 1} of ${state.questions.length}`;
  questionText.textContent = q.question;
  comboLabel.textContent = state.combo >= 2 ? `${state.combo}× combo` : "";
  renderHp();
  renderLives();

  feedback.hidden = true;
  feedback.textContent = "";
  nextBtn.disabled = true;
  nextBtn.textContent = state.index === state.questions.length - 1 ? "Finish" : "Next";
  selfGrade.hidden = true;
  modelAnswer.textContent = "";

  const isShort = q.type === "shortanswer";
  shortWrap.hidden = !isShort;
  optionsWrap.hidden = isShort;
  optionsWrap.innerHTML = "";

  if (isShort) {
    shortInput.value = "";
    shortInput.disabled = false;
    checkBtn.hidden = false;
    shortInput.focus();
    return;
  }

  q.options.forEach((opt, i) => {
    const btn = el("button", "boss-option", opt);
    btn.type = "button";
    btn.addEventListener("click", () => answer(i));
    optionsWrap.appendChild(btn);
  });
}

function answerLabel(q) {
  return q.type === "shortanswer" ? q.correctAnswer : q.options[q.correctIndex];
}

function tally(q, correct) {
  if (q.topic && state.perTopic[q.topic]) {
    state.perTopic[q.topic].total += 1;
    if (correct) state.perTopic[q.topic].correct += 1;
  } else {
    // Untagged: still part of the fight, but not attributed to any topic.
    state.untagged += 1;
  }
}

function resolve(q, correct, studentAnswer) {
  state.answered = true;
  logEvent("question", { source: "boss", correct });
  tally(q, correct);

  if (correct) {
    state.hp = Math.max(0, state.hp - 1);
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
  } else {
    state.combo = 0;
    state.lives -= 1;
    addMistake({
      question: q.question,
      subject: appState.subject,
      topic: q.topic || state.topics[0],
      studentAnswer,
      correctAnswer: answerLabel(q),
      explanation: q.explanation || "",
    });
  }

  renderHp();
  renderLives();
  comboLabel.textContent = state.combo >= 2 ? `${state.combo}× combo` : "";

  feedback.hidden = false;
  feedback.dataset.correct = String(correct);
  const hit = correct
    ? state.hp === 0
      ? "Direct hit — the boss is down!"
      : `Hit! ${state.hp} left.`
    : state.lives === 0
      ? "That one landed on you. No lives left."
      : `Missed — ${state.lives} ${state.lives === 1 ? "life" : "lives"} left.`;
  feedback.textContent = `${hit} ${q.explanation || (correct ? "" : `Correct answer: ${answerLabel(q)}`)}`.trim();

  nextBtn.disabled = false;
  if (state.hp === 0 || state.lives === 0) nextBtn.textContent = "See the result";
}

function answer(selectedIndex) {
  if (state.answered) return;
  const q = state.questions[state.index];
  const correct = selectedIndex === q.correctIndex;

  [...optionsWrap.children].forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add("correct");
    else if (i === selectedIndex) btn.classList.add("wrong");
  });

  resolve(q, correct, q.options[selectedIndex]);
}

function gradeShort(correct) {
  if (state.answered) return;
  selfGrade.hidden = true;
  const q = state.questions[state.index];
  resolve(q, correct, shortInput.value.trim() || "(left blank, self-graded incorrect)");
}

function nextQuestion() {
  if (state.hp === 0 || state.lives === 0 || state.index === state.questions.length - 1) {
    finish();
    return;
  }
  state.index += 1;
  renderQuestion();
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function finish() {
  state.finished = true;
  const won = state.hp === 0;

  // One quiz_completed per topic that actually had questions — this is what makes a Boss
  // Battle count toward the same accuracy the Brain reports everywhere else.
  Object.entries(state.perTopic).forEach(([topic, t]) => {
    if (t.total === 0) return;
    logEvent("quiz_completed", {
      topic,
      score: t.correct,
      total: t.total,
      difficulty: "hard",
      boss: true,
      subject: appState.subject,
    });
  });

  invalidateBrain();
  show(results);

  resultTitle.textContent = won ? "Boss defeated" : "The boss won this round";
  resultSub.textContent = won
    ? `You cleared ${state.maxHp} hard questions with ${state.lives} ${state.lives === 1 ? "life" : "lives"} to spare${state.bestCombo >= 3 ? `, best run ${state.bestCombo} in a row` : ""}.`
    : `You got ${state.maxHp - state.hp} of ${state.maxHp} hits in before running out of lives. Every wrong answer went into your mistake book — that's the rematch plan.`;

  resultBreakdown.innerHTML = "";
  const heading = el("h3", "boss-breakdown-heading", "What this changed");
  resultBreakdown.appendChild(heading);

  const logged = Object.entries(state.perTopic).filter(([, t]) => t.total > 0);
  if (logged.length === 0) {
    resultBreakdown.appendChild(el("p", "boss-breakdown-note", "No questions came back tagged with a topic, so nothing was logged against your topics — H1 won't guess which one a question belonged to."));
  } else {
    logged.forEach(([topic, t]) => {
      const pct = Math.round((t.correct / t.total) * 100);
      const row = el("div", "boss-breakdown-row");
      row.appendChild(el("span", "boss-breakdown-topic", topic));
      row.appendChild(el("span", "boss-breakdown-score", `${t.correct}/${t.total} · ${pct}%`));
      resultBreakdown.appendChild(row);
    });
    resultBreakdown.appendChild(
      el("p", "boss-breakdown-note", `Logged against ${logged.length === 1 ? "that topic" : "those topics"} like any other quiz, so your Learning Brain has already updated.`)
    );
  }
  if (state.untagged > 0) {
    resultBreakdown.appendChild(
      el(
        "p",
        "boss-breakdown-note",
        `${state.untagged} question${state.untagged === 1 ? "" : "s"} came back without a topic tag and ${state.untagged === 1 ? "was" : "were"} left out of the per-topic log rather than attributed to a guess.`
      )
    );
  }

  if (won && gamificationEnabled()) showToast("Boss defeated — XP from every question you got right.", "success", 3000);
}

// ---------------------------------------------------------------------------

export function initBoss() {
  if (!intro) return;

  startBtn.addEventListener("click", startBattle);
  nextBtn.addEventListener("click", nextQuestion);
  selfRightBtn.addEventListener("click", () => gradeShort(true));
  selfWrongBtn.addEventListener("click", () => gradeShort(false));

  checkBtn.addEventListener("click", () => {
    const q = state.questions[state.index];
    shortInput.disabled = true;
    checkBtn.hidden = true;
    modelAnswer.textContent = `Model answer: ${q.correctAnswer}`;
    selfGrade.hidden = false;
  });

  shortInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !checkBtn.hidden) {
      e.preventDefault();
      checkBtn.click();
    }
  });

  quitBtn.addEventListener("click", () => {
    // Abandoning mid-fight logs nothing: a half-finished battle isn't a measurement, and
    // recording it would drag the student's real accuracy down for quitting.
    state = null;
    renderBoss();
    showToast("Battle abandoned — nothing was logged.", "success", 2600);
  });

  againBtn.addEventListener("click", () => {
    state = null;
    renderBoss();
  });

  backBtn.addEventListener("click", () => {
    state = null;
    switchView("brain");
  });
}
