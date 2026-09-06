import { sendChat, friendlyErrorMessage } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { appState } from "./state.js";
import { showToast } from "./toast.js";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = /^image\/(png|jpe?g|webp|gif)$/i;

const dropzone = document.getElementById("scanDropzone");
const fileInput = document.getElementById("scanFileInput");
const previewWrap = document.getElementById("scanPreviewWrap");
const previewImg = document.getElementById("scanPreviewImg");
const analyzeBtn = document.getElementById("scanAnalyzeBtn");
const resetBtn = document.getElementById("scanResetBtn");
const resultWrap = document.getElementById("scanResult");

let currentImage = null; // { mimeType, data }
let history = []; // chat-style history for this scan session

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
  if (onRetry) {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "btn btn-ghost";
    retryBtn.style.marginTop = "12px";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", onRetry);
    wrap.appendChild(retryBtn);
  }
  return wrap;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

async function handleFile(file) {
  if (!file) return;
  if (!ALLOWED.test(file.type)) {
    showToast("Please choose a PNG, JPEG, WEBP or GIF image.", "error");
    return;
  }
  if (file.size > MAX_BYTES) {
    showToast("That image is too large (max 6MB).", "error");
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  const [, base64] = dataUrl.split(",");
  currentImage = { mimeType: file.type, data: base64 };
  previewImg.src = dataUrl;
  dropzone.hidden = true;
  previewWrap.hidden = false;
  resultWrap.innerHTML = "";
  history = [];
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

resetBtn.addEventListener("click", () => {
  currentImage = null;
  history = [];
  fileInput.value = "";
  dropzone.hidden = false;
  previewWrap.hidden = true;
  resultWrap.innerHTML = "";
});

function splitQuestions(text) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*])\s*/, "").trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [text.trim()];
}

async function askFollowUp(prompt, container) {
  container.appendChild(loadingRow("Thinking…"));
  history.push({ role: "user", content: prompt });
  try {
    const reply = await sendChat(history, appState.subject, { mode: appState.mode, language: appState.language });
    history.push({ role: "assistant", content: reply });
    container.innerHTML = "";
    const box = document.createElement("div");
    box.className = "step-card";
    box.innerHTML = renderMarkdown(reply);
    container.appendChild(box);
  } catch (err) {
    history.pop();
    container.innerHTML = "";
    container.appendChild(errorBlock(friendlyErrorMessage(err), () => askFollowUp(prompt, container)));
  }
}

function renderHintLadder(questionText, container) {
  const ladder = document.createElement("div");
  ladder.className = "hint-ladder";
  const answerBox = document.createElement("div");
  answerBox.style.marginTop = "10px";

  const steps = [
    ["Hint", `Give me a small hint for this question, without solving it: "${questionText}"`],
    ["Stronger hint", `Give me a stronger hint for this question, still without the final answer: "${questionText}"`],
    ["First step", `What's the very first step to solve this question: "${questionText}"`],
    ["Guided solution", `Guide me through solving this question step by step, checking in as we go: "${questionText}"`],
    ["Full explanation", `Give me the full step-by-step explanation and answer for this question: "${questionText}"`],
  ];
  steps.forEach(([label, prompt]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      answerBox.innerHTML = "";
      askFollowUp(prompt, answerBox);
    });
    ladder.appendChild(btn);
  });
  container.appendChild(ladder);
  container.appendChild(answerBox);
  return ladder;
}

function renderQuestionList(questions) {
  resultWrap.innerHTML = "";
  const heading = document.createElement("p");
  heading.className = "view-sub";
  heading.textContent = "H1 found these questions in your image. Pick one to work through it.";
  resultWrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "scan-question-list";
  questions.forEach((q, i) => {
    const item = document.createElement("div");
    item.className = "scan-question-item";
    item.innerHTML = `<span class="scan-question-text"></span><button type="button" class="btn btn-primary">Work on this</button>`;
    item.querySelector(".scan-question-text").textContent = q;
    const detail = document.createElement("div");
    detail.style.width = "100%";
    detail.hidden = true;
    item.querySelector("button").addEventListener("click", () => {
      const willShow = detail.hidden;
      detail.hidden = !willShow;
      if (willShow && !detail.dataset.built) {
        detail.dataset.built = "1";
        renderHintLadder(q, detail);
      }
    });
    list.appendChild(item);
    list.appendChild(detail);
  });
  resultWrap.appendChild(list);
}

analyzeBtn.addEventListener("click", async () => {
  if (!currentImage) return;
  analyzeBtn.disabled = true;
  resultWrap.innerHTML = "";
  resultWrap.appendChild(loadingRow("Reading your image…"));
  const prompt =
    "Look at this image of homework. Identify each distinct question visible in it, and list them as a numbered list, one question per line, without solving any of them yet. If there's only one question, list just that one.";
  history = [{ role: "user", content: prompt }];
  try {
    const reply = await sendChat(history, appState.subject, {
      mode: appState.mode,
      language: appState.language,
      image: currentImage,
    });
    history.push({ role: "assistant", content: reply });
    renderQuestionList(splitQuestions(reply));
  } catch (err) {
    resultWrap.innerHTML = "";
    resultWrap.appendChild(errorBlock(friendlyErrorMessage(err), () => analyzeBtn.click()));
  } finally {
    analyzeBtn.disabled = false;
  }
});

export function initScan() {
  // nothing to prime on load — state lives in module-local variables
}
