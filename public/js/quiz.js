import { fetchQuiz, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";
import { showToast } from "./toast.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { addMistake } from "./mistakeBookStore.js";

const RECENT_KEY = "h1-recent-quizzes";
const MAX_RECENT = 6;
const TIME_PER_QUESTION = 30;

const quizSetup = document.getElementById("quizSetup");
const quizTopic = document.getElementById("quizTopic");
const quizDifficultyGroup = document.getElementById("quizDifficulty");
const quizCountGroup = document.getElementById("quizCount");
const quizTypeGroup = document.getElementById("quizType");
const quizTimedToggle = document.getElementById("quizTimedToggle");
const quizStartBtn = document.getElementById("quizStartBtn");
const quizPlay = document.getElementById("quizPlay");
const quizProgressFill = document.getElementById("quizProgressFill");
const quizProgressText = document.getElementById("quizProgressText");
const quizQuestionText = document.getElementById("quizQuestionText");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const quizNextBtn = document.getElementById("quizNextBtn");
const quizTimer = document.getElementById("quizTimer");
const quizShortAnswerWrap = document.getElementById("quizShortAnswerWrap");
const quizShortAnswerInput = document.getElementById("quizShortAnswerInput");
const quizCheckAnswerBtn = document.getElementById("quizCheckAnswerBtn");
const quizSelfGrade = document.getElementById("quizSelfGrade");
const quizModelAnswer = document.getElementById("quizModelAnswer");
const quizSelfWrongBtn = document.getElementById("quizSelfWrongBtn");
const quizSelfRightBtn = document.getElementById("quizSelfRightBtn");
const quizResults = document.getElementById("quizResults");
const quizScoreRing = document.getElementById("quizScoreRing");
const quizScoreText = document.getElementById("quizScoreText");
const quizResultTitle = document.getElementById("quizResultTitle");
const quizResultSummary = document.getElementById("quizResultSummary");
const quizReview = document.getElementById("quizReview");
const quizRetryBtn = document.getElementById("quizRetryBtn");
const quizRetryIncorrectBtn = document.getElementById("quizRetryIncorrectBtn");
const quizNewBtn = document.getElementById("quizNewBtn");
const quizRecentWrap = document.getElementById("quizRecent");
const quizRecentList = document.getElementById("quizRecentList");

function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

function syncToggle(el, on) {
  el.classList.toggle("on", on);
  el.setAttribute("aria-checked", String(on));
}

const quizState = {
  topic: "",
  difficulty: "easy",
  count: 5,
  questionType: "mcq",
  timed: false,
  questions: [],
  index: 0,
  score: 0,
  answered: false,
  answers: [],
  timerId: null,
  timeLeft: TIME_PER_QUESTION,
};

quizDifficultyGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    quizState.difficulty = btn.dataset.value;
    syncSegmented(quizDifficultyGroup, quizState.difficulty);
  });
});

quizCountGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    quizState.count = Number(btn.dataset.value);
    syncSegmented(quizCountGroup, btn.dataset.value);
  });
});

quizTypeGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    quizState.questionType = btn.dataset.value;
    syncSegmented(quizTypeGroup, quizState.questionType);
  });
});

quizTimedToggle.addEventListener("click", () => {
  quizState.timed = !quizState.timed;
  syncToggle(quizTimedToggle, quizState.timed);
});
quizTimedToggle.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    quizTimedToggle.click();
  }
});

function loadRecent() {
  return safeGetJson(RECENT_KEY, []);
}

function saveRecent(entry) {
  const list = loadRecent();
  list.unshift(entry);
  safeSetJson(RECENT_KEY, list.slice(0, MAX_RECENT));
}

function renderRecent() {
  const list = loadRecent();
  if (list.length === 0) {
    quizRecentWrap.hidden = true;
    return;
  }
  quizRecentWrap.hidden = false;
  quizRecentList.innerHTML = "";
  list.forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "recent-chip";
    chip.textContent = `${entry.topic} · ${entry.score}/${entry.total}`;
    chip.addEventListener("click", () => {
      quizTopic.value = entry.topic;
      quizState.difficulty = entry.difficulty;
      quizState.count = entry.total;
      syncSegmented(quizDifficultyGroup, entry.difficulty);
      syncSegmented(quizCountGroup, String(entry.total));
      quizTopic.focus();
    });
    quizRecentList.appendChild(chip);
  });
}

function stopTimer() {
  if (quizState.timerId) {
    clearInterval(quizState.timerId);
    quizState.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  if (!quizState.timed) {
    quizTimer.hidden = true;
    return;
  }
  quizState.timeLeft = TIME_PER_QUESTION;
  quizTimer.hidden = false;
  quizTimer.textContent = `${quizState.timeLeft}s`;
  quizTimer.classList.remove("low");
  quizState.timerId = setInterval(() => {
    quizState.timeLeft -= 1;
    quizTimer.textContent = `${quizState.timeLeft}s`;
    if (quizState.timeLeft <= 10) quizTimer.classList.add("low");
    if (quizState.timeLeft <= 0) {
      stopTimer();
      if (!quizState.answered) autoFailCurrentQuestion();
    }
  }, 1000);
}

function autoFailCurrentQuestion() {
  const q = quizState.questions[quizState.index];
  quizState.answered = true;
  quizState.answers.push({ selectedIndex: -1, correct: false });
  logEvent("question", { source: "quiz", correct: false });
  if (q.type === "shortanswer") {
    quizShortAnswerInput.disabled = true;
    quizCheckAnswerBtn.disabled = true;
  } else {
    quizOptions.querySelectorAll(".quiz-option").forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.correctIndex) btn.classList.add("correct");
    });
  }
  quizFeedback.hidden = false;
  quizFeedback.textContent = "Time's up! " + (q.explanation || `Correct answer: ${q.type === "shortanswer" ? q.correctAnswer : q.options[q.correctIndex]}`);
  quizNextBtn.disabled = false;
}

function renderQuizQuestion() {
  const total = quizState.questions.length;
  const q = quizState.questions[quizState.index];
  quizProgressFill.style.width = `${(quizState.index / total) * 100}%`;
  quizProgressText.textContent = `Question ${quizState.index + 1} of ${total}`;
  quizQuestionText.textContent = q.question;
  quizFeedback.hidden = true;
  quizFeedback.textContent = "";
  quizNextBtn.disabled = true;
  quizNextBtn.querySelector("span").textContent = quizState.index === total - 1 ? "See results" : "Next";

  const isShortAnswer = q.type === "shortanswer";
  quizOptions.hidden = isShortAnswer;
  quizShortAnswerWrap.hidden = !isShortAnswer;

  if (isShortAnswer) {
    quizShortAnswerInput.value = "";
    quizShortAnswerInput.disabled = false;
    quizCheckAnswerBtn.disabled = false;
    quizCheckAnswerBtn.hidden = false;
    quizSelfGrade.hidden = true;
  } else {
    quizOptions.innerHTML = "";
    const letters = ["A", "B", "C", "D", "E", "F"];
    q.options.forEach((optionText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.innerHTML = `<span class="quiz-option-letter">${letters[i] || i + 1}</span><span></span>`;
      btn.querySelector("span:last-child").textContent = optionText;
      btn.addEventListener("click", () => selectQuizOption(i));
      quizOptions.appendChild(btn);
    });
  }

  startTimer();
}

function selectQuizOption(i) {
  if (quizState.answered) return;
  stopTimer();
  quizState.answered = true;
  const q = quizState.questions[quizState.index];
  const correct = i === q.correctIndex;
  if (correct) quizState.score += 1;
  quizState.answers.push({ selectedIndex: i, correct });
  logEvent("question", { source: "quiz", correct });

  const optionButtons = quizOptions.querySelectorAll(".quiz-option");
  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctIndex) btn.classList.add("correct");
    else if (idx === i) btn.classList.add("incorrect");
  });

  quizFeedback.hidden = false;
  quizFeedback.textContent = q.explanation || (correct ? "Correct!" : "Not quite — check the highlighted answer.");
  quizNextBtn.disabled = false;
}

quizCheckAnswerBtn.addEventListener("click", () => {
  const q = quizState.questions[quizState.index];
  quizShortAnswerInput.disabled = true;
  quizCheckAnswerBtn.hidden = true;
  quizModelAnswer.textContent = `Model answer: ${q.correctAnswer}`;
  quizSelfGrade.hidden = false;
});

function gradeShortAnswer(correct) {
  if (quizState.answered) return;
  stopTimer();
  quizState.answered = true;
  if (correct) quizState.score += 1;
  quizState.answers.push({ selectedIndex: -1, correct });
  logEvent("question", { source: "quiz", correct });
  quizSelfGrade.hidden = true;
  quizFeedback.hidden = false;
  const q = quizState.questions[quizState.index];
  quizFeedback.textContent = q.explanation || (correct ? "Nice work!" : "That's okay — keep practicing.");
  quizNextBtn.disabled = false;
}
quizSelfRightBtn.addEventListener("click", () => gradeShortAnswer(true));
quizSelfWrongBtn.addEventListener("click", () => gradeShortAnswer(false));

quizNextBtn.addEventListener("click", () => {
  const total = quizState.questions.length;
  if (quizState.index + 1 < total) {
    quizState.index += 1;
    quizState.answered = false;
    renderQuizQuestion();
  } else {
    showQuizResults();
  }
});

function questionAnswerLabel(q) {
  if (q.type === "shortanswer") return q.correctAnswer;
  return q.options[q.correctIndex];
}

function showQuizResults() {
  stopTimer();
  quizPlay.hidden = true;
  quizResults.hidden = false;
  const total = quizState.questions.length;
  const pct = Math.round((quizState.score / total) * 100);
  quizScoreRing.style.setProperty("--pct", pct);
  quizScoreText.textContent = `${quizState.score}/${total}`;
  quizResultTitle.textContent = pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Good effort! 👍" : "Keep practicing! 💪";
  quizResultSummary.textContent = `${quizState.score} correct, ${total - quizState.score} incorrect — ${pct}% on "${quizState.topic}" (${quizState.difficulty}).`;

  saveRecent({ topic: quizState.topic, difficulty: quizState.difficulty, score: quizState.score, total, date: Date.now() });
  logEvent("quiz_completed", { topic: quizState.topic, score: quizState.score, total, difficulty: quizState.difficulty });

  const hasIncorrect = quizState.answers.some((a) => !a.correct);
  quizRetryIncorrectBtn.hidden = !hasIncorrect;

  quizReview.innerHTML = "";
  quizState.questions.forEach((q, i) => {
    const answer = quizState.answers[i];
    const item = document.createElement("div");
    item.className = `quiz-review-item ${answer.correct ? "right" : "wrong"}`;
    item.innerHTML = `
      <span class="quiz-review-icon">${answer.correct ? "✅" : "❌"}</span>
      <div class="quiz-review-text">
        <strong></strong>
        <span></span>
      </div>`;
    item.querySelector("strong").textContent = q.question;
    item.querySelector("span").textContent = `Correct answer: ${questionAnswerLabel(q)}`;
    quizReview.appendChild(item);

    if (!answer.correct) {
      const studentAnswer =
        q.type === "shortanswer" ? "(short answer, self-graded incorrect)" : answer.selectedIndex >= 0 ? q.options[answer.selectedIndex] : "No answer (time ran out)";
      addMistake({
        question: q.question,
        subject: appState.subject,
        topic: quizState.topic,
        studentAnswer,
        correctAnswer: questionAnswerLabel(q),
        explanation: q.explanation || "",
      });
    }
  });
}

async function startQuiz(sourceText) {
  const topic = quizTopic.value.trim();
  if (!topic) {
    showToast("Enter a topic to start a quiz.", "error");
    quizTopic.focus();
    return;
  }
  quizStartBtn.disabled = true;
  quizStartBtn.querySelector("span").textContent = "Generating…";
  try {
    const questions = await fetchQuiz(topic, quizState.difficulty, quizState.count, appState.subject, {
      questionType: quizState.questionType,
      sourceText,
    });
    quizState.topic = topic;
    quizState.questions = questions;
    quizState.index = 0;
    quizState.score = 0;
    quizState.answered = false;
    quizState.answers = [];
    quizSetup.hidden = true;
    quizResults.hidden = true;
    quizPlay.hidden = false;
    renderQuizQuestion();
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    quizStartBtn.disabled = false;
    quizStartBtn.querySelector("span").textContent = "Start Quiz";
  }
}

quizStartBtn.addEventListener("click", startQuiz);

quizRetryBtn.addEventListener("click", () => {
  quizState.index = 0;
  quizState.score = 0;
  quizState.answered = false;
  quizState.answers = [];
  quizResults.hidden = true;
  quizPlay.hidden = false;
  renderQuizQuestion();
});

quizRetryIncorrectBtn.addEventListener("click", () => {
  const incorrectQuestions = quizState.questions.filter((_, i) => !quizState.answers[i].correct);
  if (incorrectQuestions.length === 0) return;
  quizState.questions = incorrectQuestions;
  quizState.index = 0;
  quizState.score = 0;
  quizState.answered = false;
  quizState.answers = [];
  quizResults.hidden = true;
  quizPlay.hidden = false;
  renderQuizQuestion();
});

quizNewBtn.addEventListener("click", () => {
  quizResults.hidden = true;
  quizPlay.hidden = true;
  quizSetup.hidden = false;
  renderRecent();
});

export function initQuiz() {
  renderRecent();
}

export function startQuizWithTopic(topic, sourceText) {
  quizTopic.value = topic;
  quizSetup.hidden = false;
  quizPlay.hidden = true;
  quizResults.hidden = true;
  if (sourceText) startQuiz(sourceText);
}
