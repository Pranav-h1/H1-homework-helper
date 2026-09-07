import { fetchSummary, fetchPractice, fetchVocabulary, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";
import { showToast } from "./toast.js";
import { logEvent } from "./progress.js";
import { switchView } from "./nav.js";
import { selectSubtabInView } from "./subtabs.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { saveQuickNote } from "./notes.js";

function syncSegmented(groupEl, value) {
  groupEl.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

function loadingRow(text) {
  const row = document.createElement("div");
  row.className = "loading-row";
  row.innerHTML = `<span class="spinner"></span><span></span>`;
  row.querySelector("span:last-child").textContent = text;
  return row;
}

function errorBlock(message, onRetry) {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "step-card";
  card.style.borderColor = "var(--danger-border)";
  card.innerHTML = `<div class="step-text" style="color:var(--danger)"></div>`;
  card.querySelector(".step-text").textContent = message;
  wrap.appendChild(card);
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "btn btn-ghost";
  retryBtn.style.marginTop = "12px";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", onRetry);
  wrap.appendChild(retryBtn);
  return wrap;
}

let lastSummaryText = "";
let lastSummaryData = null;

function summarizeFeature() {
  const input = document.getElementById("summarizeInput");
  const submitBtn = document.getElementById("summarizeSubmitBtn");
  const lengthGroup = document.getElementById("summarizeLength");
  const result = document.getElementById("summarizeResult");
  let length = "normal";

  lengthGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      length = btn.dataset.value;
      syncSegmented(lengthGroup, length);
    });
  });

  async function run(text) {
    lastSummaryText = text;
    submitBtn.disabled = true;
    result.innerHTML = "";
    result.appendChild(loadingRow("Reading and summarizing…"));
    try {
      const data = await fetchSummary(text, appState.subject, length);
      lastSummaryData = data;
      result.innerHTML = "";

      if (data.summary) {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = "<h3>Summary</h3><p></p>";
        card.querySelector("p").textContent = data.summary;
        result.appendChild(card);
      }
      if (data.keyPoints.length) {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = '<h3>Key points</h3><ul class="result-list"></ul>';
        const ul = card.querySelector("ul");
        data.keyPoints.forEach((p) => {
          const li = document.createElement("li");
          li.textContent = p;
          ul.appendChild(li);
        });
        result.appendChild(card);
      }
      if (data.terms.length) {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = '<h3>Important terms</h3><div class="term-chip-row"></div>';
        const row = card.querySelector(".term-chip-row");
        data.terms.forEach((t) => {
          const chip = document.createElement("div");
          chip.className = "term-chip";
          chip.innerHTML = "<strong></strong><span></span>";
          chip.querySelector("strong").textContent = t.term + ":";
          chip.querySelector("span").textContent = t.meaning;
          row.appendChild(chip);
        });
        result.appendChild(card);
      }
      if (data.revision.length) {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = '<h3>Quick revision</h3><ul class="result-list"></ul>';
        const ul = card.querySelector("ul");
        data.revision.forEach((r) => {
          const li = document.createElement("li");
          li.textContent = r;
          ul.appendChild(li);
        });
        result.appendChild(card);
      }
      if (data.possibleQuestions.length) {
        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = '<h3>Possible questions</h3><ul class="result-list"></ul>';
        const ul = card.querySelector("ul");
        data.possibleQuestions.forEach((q) => {
          const li = document.createElement("li");
          li.textContent = q;
          ul.appendChild(li);
        });
        result.appendChild(card);
      }

      const actions = document.createElement("div");
      actions.className = "message-action-bar";
      actions.style.marginTop = "4px";
      const quizBtn = document.createElement("button");
      quizBtn.type = "button";
      quizBtn.className = "icon-btn-sm";
      quizBtn.textContent = "Make quiz";
      quizBtn.addEventListener("click", () => {
        switchView("quiz");
        startQuizWithTopic("this summary", text.slice(0, 4000));
      });
      const flashBtn = document.createElement("button");
      flashBtn.type = "button";
      flashBtn.className = "icon-btn-sm";
      flashBtn.textContent = "Make flashcards";
      flashBtn.addEventListener("click", () => {
        switchView("flashcards");
        startFlashcardsWithTopic("this summary", text.slice(0, 4000));
      });
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "icon-btn-sm";
      saveBtn.textContent = "Save to notes";
      saveBtn.addEventListener("click", () => {
        const body = [
          data.summary,
          data.keyPoints.length ? "\nKey points:\n" + data.keyPoints.map((p) => `- ${p}`).join("\n") : "",
          data.revision.length ? "\nQuick revision:\n" + data.revision.map((p) => `- ${p}`).join("\n") : "",
        ]
          .filter(Boolean)
          .join("\n");
        saveQuickNote("Summary", body);
        showToast("Saved to Notes.", "success");
      });
      actions.appendChild(quizBtn);
      actions.appendChild(flashBtn);
      actions.appendChild(saveBtn);
      result.appendChild(actions);
    } catch (err) {
      result.innerHTML = "";
      result.appendChild(errorBlock(friendlyErrorMessage(err), () => run(lastSummaryText)));
    } finally {
      submitBtn.disabled = false;
    }
  }

  submitBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) {
      showToast("Paste some text to summarize.", "error");
      input.focus();
      return;
    }
    run(text);
  });

  return { run, setInput: (text) => { input.value = text; } };
}

function practiceFeature() {
  const topicInput = document.getElementById("practiceTopic");
  const countGroup = document.getElementById("practiceCount");
  const startBtn = document.getElementById("practiceStartBtn");
  const result = document.getElementById("practiceResult");
  let count = 5;

  countGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      count = Number(btn.dataset.value);
      syncSegmented(countGroup, btn.dataset.value);
    });
  });

  async function run(topic, sourceText) {
    startBtn.disabled = true;
    result.innerHTML = "";
    result.appendChild(loadingRow("Writing practice questions…"));
    try {
      const questions = await fetchPractice(topic, count, appState.subject, { sourceText });
      result.innerHTML = "";
      questions.forEach((q) => {
        const card = document.createElement("div");
        card.className = "practice-card";
        card.innerHTML =
          '<div class="practice-question"></div><button type="button" class="icon-btn-sm">Reveal answer</button><div class="practice-answer" hidden></div>';
        card.querySelector(".practice-question").textContent = q.question;
        const answerEl = card.querySelector(".practice-answer");
        answerEl.textContent = q.answer;
        const btn = card.querySelector("button");
        btn.addEventListener("click", () => {
          const wasHidden = answerEl.hidden;
          answerEl.hidden = !answerEl.hidden;
          btn.textContent = answerEl.hidden ? "Reveal answer" : "Hide answer";
          if (wasHidden) logEvent("question", { source: "practice" });
        });
        result.appendChild(card);
      });
    } catch (err) {
      result.innerHTML = "";
      result.appendChild(errorBlock(friendlyErrorMessage(err), () => run(topic, sourceText)));
    } finally {
      startBtn.disabled = false;
    }
  }

  startBtn.addEventListener("click", () => {
    const topic = topicInput.value.trim();
    if (!topic) {
      showToast("Enter a topic to generate practice questions.", "error");
      topicInput.focus();
      return;
    }
    run(topic);
  });

  return {
    runFromSource: (topic, sourceText) => {
      topicInput.value = topic;
      run(topic, sourceText);
    },
  };
}

function vocabularyFeature() {
  const form = document.getElementById("vocabularyForm");
  const input = document.getElementById("vocabularyInput");
  const languageGroup = document.getElementById("vocabularyLanguage");
  const translateGroup = document.getElementById("vocabularyTranslate");
  const submitBtn = document.getElementById("vocabularySubmitBtn");
  const result = document.getElementById("vocabularyResult");
  let language = "english";
  let translateTo = "";

  languageGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      language = btn.dataset.value;
      syncSegmented(languageGroup, language);
    });
  });
  translateGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      translateTo = btn.dataset.value;
      syncSegmented(translateGroup, translateTo);
    });
  });

  async function run(word) {
    submitBtn.disabled = true;
    result.innerHTML = "";
    result.appendChild(loadingRow("Looking that up…"));
    try {
      const data = await fetchVocabulary(word, language, appState.subject, translateTo || undefined);
      result.innerHTML = "";
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <h3>${word}</h3>
        <p style="font-size:15px;font-weight:650;margin:0 0 10px"></p>
        <p style="margin:0 0 10px"></p>
        <p style="font-style:italic;color:var(--text-muted);margin:0"></p>`;
      const ps = card.querySelectorAll("p");
      ps[0].textContent = data.meaning;
      ps[1].textContent = data.explanation;
      ps[2].textContent = data.example ? `“${data.example}”` : "";
      result.appendChild(card);

      if (data.translation) {
        const transCard = document.createElement("div");
        transCard.className = "result-card";
        transCard.innerHTML = `<h3>Translation</h3><p style="font-size:16px;font-weight:700;margin:0"></p>`;
        transCard.querySelector("p").textContent = data.translation;
        result.appendChild(transCard);
      }

      if (data.related.length) {
        const relCard = document.createElement("div");
        relCard.className = "result-card";
        relCard.innerHTML = '<h3>Related words</h3><div class="subject-bar" style="padding:0"></div>';
        const row = relCard.querySelector("div:last-child");
        data.related.forEach((r) => {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.style.cursor = "default";
          chip.textContent = r;
          row.appendChild(chip);
        });
        result.appendChild(relCard);
      }
    } catch (err) {
      result.innerHTML = "";
      result.appendChild(errorBlock(friendlyErrorMessage(err), () => run(word)));
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;
    run(word);
  });
}

let practiceApi = null;
let summarizeApi = null;

export function initMoreTools() {
  summarizeApi = summarizeFeature();
  practiceApi = practiceFeature();
  vocabularyFeature();
}

// Summarize and Practice Questions both live in the Tools view's "Writing & Language"
// subtab, not as their own top-level views — switchView("summarize"/"practice") matched no
// real panel and left the whole app blank (every [data-view-panel] hidden). Route to the
// panel that actually exists, then land on the tab that holds these tools.
export function summarizeText(text) {
  switchView("tools");
  selectSubtabInView("tools", "writing");
  summarizeApi.setInput(text);
  summarizeApi.run(text);
}

export function generatePracticeFromSource(topic, sourceText) {
  switchView("tools");
  selectSubtabInView("tools", "writing");
  practiceApi.runFromSource(topic, sourceText);
}
