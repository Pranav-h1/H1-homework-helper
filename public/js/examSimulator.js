// Exam Simulator — a serious, timed, multi-topic exam distinct from the casual Quiz Lab:
// no per-question feedback (you find out at the end, like a real exam), a question
// navigator, mark-for-review, an overall countdown, and topic-by-topic + AI analysis on
// the results screen. Reuses the same real /api/quiz generation the rest of H1 uses —
// nothing here fabricates questions, scores, or analysis.
import { fetchQuiz, sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent, getStats } from "./progress.js";
import { addMistake, getMistakePatterns } from "./mistakeBookStore.js";
import { switchView } from "./nav.js";
import { confirmDanger } from "./modal.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { generatePracticeFromSource } from "./moreTools.js";
import { prefillStudyPlan } from "./planner.js";

const STATE_KEY = "h1-exam-in-progress";

const examSetup = document.getElementById("examSetup");
const examResumeBanner = document.getElementById("examResumeBanner");
const examResumeText = document.getElementById("examResumeText");
const examResumeBtn = document.getElementById("examResumeBtn");
const examDiscardBtn = document.getElementById("examDiscardBtn");
const examPresets = document.getElementById("examPresets");
const examTitleInput = document.getElementById("examTitle");
const examTopicsInput = document.getElementById("examTopics");
const examDifficultyGroup = document.getElementById("examDifficulty");
const examCountGroup = document.getElementById("examCount");
const examTypeGroup = document.getElementById("examType");
const examTimeLimitGroup = document.getElementById("examTimeLimit");
const examQuestionCountPreview = document.getElementById("examQuestionCountPreview");
const examStartBtn = document.getElementById("examStartBtn");

const examPlay = document.getElementById("examPlay");
const examPlayTitle = document.getElementById("examPlayTitle");
const examPlayProgressText = document.getElementById("examPlayProgressText");
const examTimerBadge = document.getElementById("examTimerBadge");
const examSubmitBtn = document.getElementById("examSubmitBtn");
const examNavGrid = document.getElementById("examNavGrid");
const examQuestionText = document.getElementById("examQuestionText");
const examQuestionTopic = document.getElementById("examQuestionTopic");
const examOptions = document.getElementById("examOptions");
const examShortAnswerWrap = document.getElementById("examShortAnswerWrap");
const examShortAnswerInput = document.getElementById("examShortAnswerInput");
const examCheckAnswerBtn = document.getElementById("examCheckAnswerBtn");
const examSelfGrade = document.getElementById("examSelfGrade");
const examModelAnswer = document.getElementById("examModelAnswer");
const examSelfWrongBtn = document.getElementById("examSelfWrongBtn");
const examSelfRightBtn = document.getElementById("examSelfRightBtn");
const examMarkReviewBtn = document.getElementById("examMarkReviewBtn");
const examPrevBtn = document.getElementById("examPrevBtn");
const examNextBtn = document.getElementById("examNextBtn");

const examResults = document.getElementById("examResults");
const examScoreRing = document.getElementById("examScoreRing");
const examScoreText = document.getElementById("examScoreText");
const examResultTitle = document.getElementById("examResultTitle");
const examResultSummary = document.getElementById("examResultSummary");
const examStatsGrid = document.getElementById("examStatsGrid");
const examTopicAnalysis = document.getElementById("examTopicAnalysis");
const examAiAnalysisBtn = document.getElementById("examAiAnalysisBtn");
const examAiAnalysisResult = document.getElementById("examAiAnalysisResult");
const examReview = document.getElementById("examReview");
const examResultActions = document.getElementById("examResultActions");

let exam = null; // the live exam object while setup/play/results are shown
let timerId = null;

function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

function parseTopics(text) {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function updateCountPreview() {
  const topics = parseTopics(examTopicsInput.value);
  const perTopic = Number(examCountGroup.querySelector(".segmented-btn.active")?.dataset.value || 5);
  if (topics.length === 0) {
    examQuestionCountPreview.textContent = "Enter at least one topic to see the total question count.";
    return;
  }
  examQuestionCountPreview.textContent = `This exam will have ${perTopic * topics.length} questions across ${topics.length} topic${topics.length === 1 ? "" : "s"}.`;
}

examTopicsInput.addEventListener("input", updateCountPreview);

examDifficultyGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => syncSegmented(examDifficultyGroup, btn.dataset.value));
});
examCountGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    syncSegmented(examCountGroup, btn.dataset.value);
    updateCountPreview();
  });
});
examTypeGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => syncSegmented(examTypeGroup, btn.dataset.value));
});
examTimeLimitGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => syncSegmented(examTimeLimitGroup, btn.dataset.value));
});

// Presets tune difficulty/type/timing, which are reasonable to standardize — topics stay
// whatever the student already typed, except Revision/Weak Areas, whose entire point is to
// pull topics from real recorded data (never invented).
examPresets.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = btn.dataset.preset;
    syncSegmented(examPresets, undefined);
    btn.classList.add("active");
    if (preset === "quick") {
      syncSegmented(examDifficultyGroup, "easy");
      syncSegmented(examCountGroup, "5");
      syncSegmented(examTypeGroup, "mcq");
      syncSegmented(examTimeLimitGroup, "10");
    } else if (preset === "standard") {
      syncSegmented(examDifficultyGroup, "medium");
      syncSegmented(examCountGroup, "10");
      syncSegmented(examTypeGroup, "mixed");
      syncSegmented(examTimeLimitGroup, "30");
    } else if (preset === "difficult") {
      syncSegmented(examDifficultyGroup, "hard");
      syncSegmented(examCountGroup, "10");
      syncSegmented(examTypeGroup, "mixed");
      syncSegmented(examTimeLimitGroup, "45");
    } else if (preset === "revision") {
      const patterns = getMistakePatterns();
      if (patterns.length === 0) {
        showToast("No repeated mistakes recorded yet — take a few quizzes first.", "error", 4000);
      } else {
        examTopicsInput.value = patterns.map((p) => p.topic).join(", ");
      }
      syncSegmented(examDifficultyGroup, "medium");
      syncSegmented(examCountGroup, "5");
      syncSegmented(examTypeGroup, "mixed");
      syncSegmented(examTimeLimitGroup, "20");
    } else if (preset === "weak") {
      const weak = getStats().weakTopics;
      if (weak.length === 0) {
        showToast("No weak topics detected yet — take a few quizzes first.", "error", 4000);
      } else {
        examTopicsInput.value = weak.map((t) => t.topic).join(", ");
      }
      syncSegmented(examDifficultyGroup, "medium");
      syncSegmented(examCountGroup, "5");
      syncSegmented(examTypeGroup, "mcq");
      syncSegmented(examTimeLimitGroup, "20");
    }
    updateCountPreview();
  });
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function persistExam() {
  if (!exam) return;
  safeSetJson(STATE_KEY, { ...exam, timerId: undefined });
}

function clearPersistedExam() {
  safeSetJson(STATE_KEY, null);
}

async function startExam() {
  const topics = parseTopics(examTopicsInput.value);
  if (topics.length === 0) {
    showToast("Enter at least one topic.", "error");
    examTopicsInput.focus();
    return;
  }
  const difficulty = examDifficultyGroup.querySelector(".segmented-btn.active").dataset.value;
  const perTopicCount = Number(examCountGroup.querySelector(".segmented-btn.active").dataset.value);
  const questionType = examTypeGroup.querySelector(".segmented-btn.active").dataset.value;
  const timeLimitMinutes = Number(examTimeLimitGroup.querySelector(".segmented-btn.active").dataset.value);
  const title = examTitleInput.value.trim() || `${topics.length > 1 ? "Multi-topic" : topics[0]} Exam`;

  examStartBtn.disabled = true;
  examStartBtn.querySelector("span").textContent = "Building exam…";
  try {
    const perTopicResults = await Promise.all(
      topics.map((topic) =>
        fetchQuiz(topic, difficulty, perTopicCount, appState.subject, { questionType }).then((questions) =>
          questions.map((q) => ({ ...q, topic }))
        )
      )
    );
    const questions = shuffle(perTopicResults.flat());
    if (questions.length === 0) throw new Error("No questions were generated.");

    exam = {
      title,
      topics,
      subject: appState.subject,
      difficulty,
      questionType,
      timeLimitMinutes,
      questions,
      index: 0,
      answers: {},
      marked: {},
      startedAt: Date.now(),
      timeLeftSec: timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null,
    };
    persistExam();
    examSetup.hidden = true;
    examResults.hidden = true;
    examPlay.hidden = false;
    examPlayTitle.textContent = exam.title;
    renderExamQuestion();
    startExamTimer();
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    examStartBtn.disabled = false;
    examStartBtn.querySelector("span").textContent = "Start Exam";
  }
}
examStartBtn.addEventListener("click", startExam);

function stopExamTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startExamTimer() {
  stopExamTimer();
  if (exam.timeLeftSec === null) {
    examTimerBadge.hidden = true;
    return;
  }
  examTimerBadge.hidden = false;
  examTimerBadge.textContent = formatTime(exam.timeLeftSec);
  timerId = setInterval(() => {
    exam.timeLeftSec -= 1;
    examTimerBadge.textContent = formatTime(Math.max(0, exam.timeLeftSec));
    examTimerBadge.classList.toggle("low", exam.timeLeftSec <= 60);
    if (exam.timeLeftSec <= 0) {
      stopExamTimer();
      showToast("Time's up — submitting your exam.", "success", 3000);
      finishExam();
    }
  }, 1000);
}

function renderNavGrid() {
  examNavGrid.innerHTML = "";
  exam.questions.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "exam-nav-item";
    if (exam.answers[i] !== undefined) btn.classList.add("answered");
    if (exam.marked[i]) btn.classList.add("marked");
    if (i === exam.index) btn.classList.add("current");
    btn.textContent = String(i + 1);
    btn.setAttribute("role", "listitem");
    btn.addEventListener("click", () => {
      exam.index = i;
      renderExamQuestion();
    });
    examNavGrid.appendChild(btn);
  });
}

function renderExamQuestion() {
  const q = exam.questions[exam.index];
  const total = exam.questions.length;
  examPlayProgressText.textContent = `Question ${exam.index + 1} of ${total}`;
  examQuestionText.textContent = q.question;
  examQuestionTopic.textContent = q.topic;
  examPrevBtn.disabled = exam.index === 0;
  examNextBtn.querySelector("span").textContent = exam.index === total - 1 ? "Finish" : "Next";
  examMarkReviewBtn.classList.toggle("marked", Boolean(exam.marked[exam.index]));
  examMarkReviewBtn.textContent = exam.marked[exam.index] ? "🚩 Marked for review" : "🚩 Mark for review";

  const isShortAnswer = q.type === "shortanswer";
  examOptions.hidden = isShortAnswer;
  examShortAnswerWrap.hidden = !isShortAnswer;
  examSelfGrade.hidden = true;
  examCheckAnswerBtn.hidden = false;

  const saved = exam.answers[exam.index];

  if (isShortAnswer) {
    examShortAnswerInput.value = saved ? saved.text || "" : "";
    examCheckAnswerBtn.hidden = Boolean(saved && saved.graded);
    if (saved && saved.graded) {
      examSelfGrade.hidden = false;
      examModelAnswer.textContent = `Model answer: ${q.correctAnswer}`;
    }
  } else {
    examOptions.innerHTML = "";
    const letters = ["A", "B", "C", "D", "E", "F"];
    q.options.forEach((optionText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(saved && saved.selectedIndex === i));
      if (saved && saved.selectedIndex === i) btn.classList.add("selected");
      btn.innerHTML = `<span class="quiz-option-letter">${letters[i] || i + 1}</span><span></span>`;
      btn.querySelector("span:last-child").textContent = optionText;
      btn.addEventListener("click", () => selectExamOption(i));
      examOptions.appendChild(btn);
    });
  }

  renderNavGrid();
}

// Unlike Quiz Lab, selecting an option here does NOT reveal correct/incorrect — a real exam
// doesn't tell you until it's graded. Only a "selected" style shows what you picked.
function selectExamOption(i) {
  exam.answers[exam.index] = { selectedIndex: i };
  examOptions.querySelectorAll(".quiz-option").forEach((btn, idx) => {
    btn.classList.toggle("selected", idx === i);
    btn.setAttribute("aria-checked", String(idx === i));
  });
  persistExam();
  renderNavGrid();
}

examShortAnswerInput.addEventListener("input", () => {
  const text = examShortAnswerInput.value;
  exam.answers[exam.index] = { text, graded: false };
  persistExam();
  renderNavGrid();
});

// Short-answer can't be auto-graded reliably, so — same honest approach Quiz Lab already
// uses — the student compares their own answer to the model answer right away.
examCheckAnswerBtn.addEventListener("click", () => {
  const q = exam.questions[exam.index];
  examCheckAnswerBtn.hidden = true;
  examSelfGrade.hidden = false;
  examModelAnswer.textContent = `Model answer: ${q.correctAnswer}`;
});

function gradeShortAnswer(correct) {
  const text = exam.answers[exam.index]?.text || "";
  exam.answers[exam.index] = { text, graded: true, correct };
  persistExam();
  renderNavGrid();
}
examSelfRightBtn.addEventListener("click", () => gradeShortAnswer(true));
examSelfWrongBtn.addEventListener("click", () => gradeShortAnswer(false));

examMarkReviewBtn.addEventListener("click", () => {
  exam.marked[exam.index] = !exam.marked[exam.index];
  persistExam();
  renderExamQuestion();
});

examPrevBtn.addEventListener("click", () => {
  if (exam.index > 0) {
    exam.index -= 1;
    renderExamQuestion();
  }
});

examNextBtn.addEventListener("click", () => {
  if (exam.index < exam.questions.length - 1) {
    exam.index += 1;
    renderExamQuestion();
  } else {
    confirmSubmit();
  }
});

function confirmSubmit() {
  const total = exam.questions.length;
  const answered = Object.keys(exam.answers).length;
  const unanswered = total - answered;
  const body = unanswered > 0 ? `${unanswered} question${unanswered === 1 ? "" : "s"} still unanswered. You can't change answers after submitting.` : "You can't change answers after submitting.";
  confirmDanger("Submit this exam?", body, "Submit exam", () => finishExam());
}
examSubmitBtn.addEventListener("click", confirmSubmit);

function isCorrect(q, answer) {
  if (!answer) return false;
  if (q.type === "shortanswer") return Boolean(answer.graded && answer.correct);
  return answer.selectedIndex === q.correctIndex;
}

function questionAnswerLabel(q) {
  return q.type === "shortanswer" ? q.correctAnswer : q.options[q.correctIndex];
}

function finishExam() {
  stopExamTimer();
  clearPersistedExam();
  examPlay.hidden = true;
  examResults.hidden = false;

  const total = exam.questions.length;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const byTopic = {};

  exam.questions.forEach((q, i) => {
    const answer = exam.answers[i];
    const wasAnswered = answer !== undefined && (q.type !== "shortanswer" || answer.text?.trim());
    const ok = isCorrect(q, answer);
    if (!wasAnswered) unanswered += 1;
    else if (ok) correct += 1;
    else incorrect += 1;

    if (!byTopic[q.topic]) byTopic[q.topic] = { total: 0, correct: 0 };
    byTopic[q.topic].total += 1;
    if (ok) byTopic[q.topic].correct += 1;

    if (wasAnswered && !ok) {
      addMistake({
        question: q.question,
        subject: exam.subject,
        topic: q.topic,
        studentAnswer: q.type === "shortanswer" ? answer?.text || "" : answer?.selectedIndex >= 0 ? q.options[answer.selectedIndex] : "No answer",
        correctAnswer: questionAnswerLabel(q),
        explanation: q.explanation || "",
      });
    }
  });

  const pct = Math.round((correct / total) * 100);
  const timeUsedSec = Math.round((Date.now() - exam.startedAt) / 1000);
  const avgSecPerQuestion = Math.round(timeUsedSec / total);

  examScoreRing.style.setProperty("--pct", pct);
  examScoreText.textContent = `${correct}/${total}`;
  examResultTitle.textContent = pct >= 80 ? "Excellent! 🎉" : pct >= 50 ? "Good effort! 👍" : "Keep practicing! 💪";
  examResultSummary.textContent = `${exam.title} — ${pct}% (${correct} correct, ${incorrect} incorrect, ${unanswered} unanswered).`;

  logEvent("quiz_completed", { topic: exam.title, score: correct, total, difficulty: exam.difficulty, exam: true });

  examStatsGrid.innerHTML = "";
  [
    [String(correct), "Correct"],
    [String(incorrect), "Incorrect"],
    [String(unanswered), "Unanswered"],
    [formatTime(timeUsedSec), "Time used"],
    [`${avgSecPerQuestion}s`, "Avg / question"],
  ].forEach(([value, label]) => {
    const card = document.createElement("div");
    card.className = "progress-stat-card";
    card.innerHTML = `<div class="progress-stat-value"></div><div class="progress-stat-label"></div>`;
    card.querySelector(".progress-stat-value").textContent = value;
    card.querySelector(".progress-stat-label").textContent = label;
    examStatsGrid.appendChild(card);
  });

  examTopicAnalysis.innerHTML = "";
  Object.entries(byTopic).forEach(([topic, t]) => {
    const topicPct = Math.round((t.correct / t.total) * 100);
    const color = topicPct >= 70 ? "var(--success)" : topicPct >= 40 ? "var(--warning)" : "var(--danger)";
    const label = topicPct >= 70 ? "Strong" : topicPct >= 40 ? "Needs practice" : "Weak";
    const row = document.createElement("div");
    row.className = "exam-topic-row";
    row.innerHTML = `<span class="exam-topic-row-label"></span><span class="exam-topic-row-bar"><span class="exam-topic-row-fill"></span></span><span class="exam-topic-row-pct"></span>`;
    row.querySelector(".exam-topic-row-label").textContent = topic;
    const fill = row.querySelector(".exam-topic-row-fill");
    fill.style.width = `${topicPct}%`;
    fill.style.background = color;
    row.querySelector(".exam-topic-row-pct").textContent = `${topicPct}% — ${label}`;
    examTopicAnalysis.appendChild(row);
  });

  examAiAnalysisResult.innerHTML = "";
  examAiAnalysisBtn.hidden = false;
  examAiAnalysisBtn.disabled = false;

  examReview.innerHTML = "";
  exam.questions.forEach((q, i) => {
    const answer = exam.answers[i];
    const ok = isCorrect(q, answer);
    const item = document.createElement("div");
    item.className = `quiz-review-item ${ok ? "right" : "wrong"}`;
    item.innerHTML = `<span class="quiz-review-icon">${ok ? "✅" : "❌"}</span><div class="quiz-review-text"><strong></strong><span></span></div>`;
    item.querySelector("strong").textContent = `[${q.topic}] ${q.question}`;
    item.querySelector("span").textContent = `Correct answer: ${questionAnswerLabel(q)}`;
    examReview.appendChild(item);
  });

  buildResultActions(byTopic);
}

function buildResultActions(byTopic) {
  examResultActions.innerHTML = "";
  const weakestTopic = Object.entries(byTopic)
    .map(([topic, t]) => ({ topic, pct: Math.round((t.correct / t.total) * 100) }))
    .sort((a, b) => a.pct - b.pct)[0];

  const actions = [
    ["Review mistakes", () => switchView("progress")],
    weakestTopic && ["Practice weak areas", () => { switchView("tools"); generatePracticeFromSource(weakestTopic.topic, undefined); }],
    weakestTopic && ["Generate flashcards", () => startFlashcardsWithTopic(weakestTopic.topic)],
    weakestTopic && ["Create revision plan", () => { switchView("planner"); prefillStudyPlan(weakestTopic.topic); }],
    ["Take another exam", () => resetToSetup()],
  ].filter(Boolean);

  actions.forEach(([label, action], i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = i === actions.length - 1 ? "btn btn-primary" : "btn btn-ghost";
    btn.textContent = label;
    btn.addEventListener("click", action);
    examResultActions.appendChild(btn);
  });
}

examAiAnalysisBtn.addEventListener("click", async () => {
  examAiAnalysisBtn.disabled = true;
  examAiAnalysisResult.innerHTML = '<div class="loading-row"><span class="spinner"></span><span>Analyzing your exam…</span></div>';

  const wrongList = exam.questions
    .map((q, i) => ({ q, ok: isCorrect(q, exam.answers[i]) }))
    .filter((x) => !x.ok)
    .map((x) => `- [${x.q.topic}] ${x.q.question} (correct answer: ${questionAnswerLabel(x.q)})`)
    .join("\n");
  const correctCount = exam.questions.filter((q, i) => isCorrect(q, exam.answers[i])).length;

  const prompt = `Here is a student's REAL exam result — use ONLY this data, don't invent anything:\n\nExam: "${exam.title}"\nScore: ${correctCount}/${exam.questions.length}\nTopics covered: ${exam.topics.join(", ")}\n\nQuestions they got wrong:\n${wrongList || "(none — they got everything right)"}\n\nWrite a short analysis with exactly three short sections: "What went well", "Where mistakes happened" (name the likely weak concepts based on the wrong questions above), and "What to revise next". Keep each section to 1-3 sentences.`;

  try {
    const reply = await sendChat([{ role: "user", content: prompt }], exam.subject);
    examAiAnalysisResult.innerHTML = `<div class="bubble" style="background:var(--surface);border:1px solid var(--border)"></div>`;
    examAiAnalysisResult.querySelector(".bubble").innerHTML = renderMarkdown(reply);
  } catch (err) {
    examAiAnalysisResult.innerHTML = "";
    const errorCard = document.createElement("div");
    errorCard.className = "step-card";
    errorCard.style.borderColor = "var(--danger-border)";
    errorCard.textContent = friendlyErrorMessage(err);
    examAiAnalysisResult.appendChild(errorCard);
  } finally {
    examAiAnalysisBtn.disabled = false;
  }
});

function resetToSetup() {
  exam = null;
  examResults.hidden = true;
  examPlay.hidden = true;
  examSetup.hidden = false;
  checkForResumableExam();
}

function checkForResumableExam() {
  const saved = safeGetJson(STATE_KEY, null);
  if (!saved) {
    examResumeBanner.hidden = true;
    return;
  }
  const answered = Object.keys(saved.answers || {}).length;
  examResumeText.textContent = `"${saved.title}" — ${answered}/${saved.questions.length} answered.`;
  examResumeBanner.hidden = false;
}

examResumeBtn.addEventListener("click", () => {
  const saved = safeGetJson(STATE_KEY, null);
  if (!saved) return;
  exam = saved;
  examResumeBanner.hidden = true;
  examSetup.hidden = true;
  examPlay.hidden = false;
  examPlayTitle.textContent = exam.title;
  renderExamQuestion();
  startExamTimer();
});

examDiscardBtn.addEventListener("click", () => {
  clearPersistedExam();
  examResumeBanner.hidden = true;
});

export function initExamSimulator() {
  checkForResumableExam();
  updateCountPreview();
}
