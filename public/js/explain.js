import { renderMarkdown } from "./markdown.js";
import { fetchExplain, sendChat, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";

const explainForm = document.getElementById("explainForm");
const explainInput = document.getElementById("explainInput");
const explainSubmitBtn = document.getElementById("explainSubmitBtn");
const explainResult = document.getElementById("explainResult");
const viewToggle = document.getElementById("explainViewToggle");
const showAllBtn = document.getElementById("explainShowAllBtn");
const oneByOneBtn = document.getElementById("explainOneByOneBtn");
const stepNav = document.getElementById("explainStepNav");
const prevStepBtn = document.getElementById("explainPrevStepBtn");
const nextStepBtn = document.getElementById("explainNextStepBtn");

let lastQuestion = null;
let steps = [];
let mode = "all";
let currentIndex = 0;

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}
explainInput.addEventListener("input", () => autoGrow(explainInput));

function renderLoading() {
  explainResult.innerHTML = "";
  const row = document.createElement("div");
  row.className = "loading-row";
  row.innerHTML = '<span class="spinner"></span><span>Building your explanation…</span>';
  explainResult.appendChild(row);
  viewToggle.hidden = true;
  stepNav.hidden = true;
}

function renderEmpty() {
  explainResult.innerHTML = `
    <div class="empty-state">
      <div class="empty-emoji">🧠</div>
      <h2>No explanation yet</h2>
      <p>Type any homework question above to get a clear, step-by-step breakdown.</p>
    </div>`;
  viewToggle.hidden = true;
  stepNav.hidden = true;
}

function renderError(message) {
  explainResult.innerHTML = "";
  const row = document.createElement("div");
  row.className = "step-card";
  row.style.borderColor = "var(--danger-border)";
  row.innerHTML = `<div class="step-text" style="color:var(--danger)"></div>`;
  row.querySelector(".step-text").textContent = message;
  explainResult.appendChild(row);

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "btn btn-ghost";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", () => runExplain(lastQuestion));
  explainResult.appendChild(retryBtn);
  viewToggle.hidden = true;
  stepNav.hidden = true;
}

async function expandStep(stepText, action, container) {
  const existing = container.querySelector(".step-expansion");
  if (existing) {
    existing.remove();
    return;
  }
  const box = document.createElement("div");
  box.className = "step-expansion";
  box.style.marginTop = "10px";
  box.style.borderTop = "1px dashed var(--border)";
  box.style.paddingTop = "10px";
  box.innerHTML = '<div class="loading-row" style="padding:4px 0"><span class="spinner"></span><span>Thinking…</span></div>';
  container.appendChild(box);

  const instruction =
    action === "simplify"
      ? `Explain this step more simply, for a younger student: "${stepText}"`
      : `Explain this step in more detail: "${stepText}"`;

  try {
    const reply = await sendChat(
      [{ role: "user", content: `In the context of the question "${lastQuestion}", ${instruction}` }],
      appState.subject
    );
    box.innerHTML = renderMarkdown(reply);
  } catch (err) {
    box.innerHTML = "";
    box.style.color = "var(--danger)";
    box.textContent = friendlyErrorMessage(err);
  }
}

function buildStepCard(stepText, number, delayMs) {
  const card = document.createElement("div");
  card.className = "step-card";
  if (delayMs != null) card.style.animationDelay = `${delayMs}ms`;
  card.innerHTML = `<div class="step-number"></div><div class="step-content" style="flex:1;min-width:0"><div class="step-text"></div><div class="message-action-bar" style="margin-top:8px"></div></div>`;
  card.querySelector(".step-number").textContent = number;
  card.querySelector(".step-text").textContent = stepText;

  const content = card.querySelector(".step-content");
  const bar = card.querySelector(".message-action-bar");
  const explainBtn = document.createElement("button");
  explainBtn.type = "button";
  explainBtn.className = "icon-btn-sm";
  explainBtn.textContent = "Explain this step";
  explainBtn.addEventListener("click", () => expandStep(stepText, "explain", content));
  const simplifyBtn = document.createElement("button");
  simplifyBtn.type = "button";
  simplifyBtn.className = "icon-btn-sm";
  simplifyBtn.textContent = "Simplify this step";
  simplifyBtn.addEventListener("click", () => expandStep(stepText, "simplify", content));
  bar.appendChild(explainBtn);
  bar.appendChild(simplifyBtn);

  return card;
}

function renderAllSteps() {
  explainResult.innerHTML = "";
  steps.forEach((step, i) => {
    explainResult.appendChild(buildStepCard(step, i + 1, i * 70));
  });
  viewToggle.hidden = false;
  showAllBtn.hidden = true;
  oneByOneBtn.hidden = false;
  stepNav.hidden = true;
}

function renderOneStep() {
  explainResult.innerHTML = "";
  explainResult.appendChild(buildStepCard(steps[currentIndex], currentIndex + 1, null));
  viewToggle.hidden = false;
  showAllBtn.hidden = false;
  oneByOneBtn.hidden = true;
  stepNav.hidden = false;
  prevStepBtn.disabled = currentIndex === 0;
  const nextLabel = nextStepBtn.querySelector("span");
  if (nextLabel) nextLabel.textContent = currentIndex === steps.length - 1 ? "Done" : "Next";
  nextStepBtn.disabled = false;
}

function render() {
  if (mode === "all") renderAllSteps();
  else renderOneStep();
}

showAllBtn.addEventListener("click", () => {
  mode = "all";
  render();
});
oneByOneBtn.addEventListener("click", () => {
  mode = "one";
  currentIndex = 0;
  render();
});
prevStepBtn.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderOneStep();
  }
});
nextStepBtn.addEventListener("click", () => {
  if (currentIndex < steps.length - 1) {
    currentIndex += 1;
    renderOneStep();
  } else {
    mode = "all";
    render();
  }
});

async function runExplain(question) {
  lastQuestion = question;
  explainSubmitBtn.disabled = true;
  renderLoading();
  try {
    steps = await fetchExplain(question, appState.subject);
    mode = "all";
    currentIndex = 0;
    render();
  } catch (err) {
    renderError(friendlyErrorMessage(err));
  } finally {
    explainSubmitBtn.disabled = false;
  }
}

explainForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = explainInput.value.trim();
  if (!text) return;
  runExplain(text);
});

export function initExplain() {
  renderEmpty();
}

export function explainQuestion(question) {
  explainInput.value = question;
  runExplain(question);
}
