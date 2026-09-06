import { fetchSummary, friendlyErrorMessage } from "./api.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { confirmDanger, promptForText } from "./modal.js";
import { switchView } from "./nav.js";
import { addDocument, getDocuments, getDocument, deleteDocument, renameDocument, toggleFavorite } from "./documentsStore.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { openChatWithMessage } from "./chat.js";
import { matchesCurrentSpace } from "./spacesStore.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PDF_PAGES = 40;

const uploadBtn = document.getElementById("documentUploadBtn");
const fileInput = document.getElementById("documentFileInput");
const grid = document.getElementById("documentGrid");
const emptyState = document.getElementById("documentEmptyState");
const detailWrap = document.getElementById("documentDetail");
const detailName = document.getElementById("documentDetailName");
const detailMeta = document.getElementById("documentDetailMeta");
const detailPreview = document.getElementById("documentDetailPreview");
const detailResult = document.getElementById("documentDetailResult");
const detailBackBtn = document.getElementById("documentDetailBackBtn");

let pdfJsReady = null;

function loadPdfJs() {
  if (pdfJsReady) return pdfJsReady;
  pdfJsReady = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Couldn't load the PDF reader. Check your connection and try again."));
    document.head.appendChild(script);
  });
  return pdfJsReady;
}

async function extractPdfText(arrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let text = "";
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n\n";
  }
  return text.trim();
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

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  if (file.size > MAX_BYTES) {
    showToast("That file is too large (max 8MB).", "error");
    return;
  }
  const isTxt = file.type === "text/plain" || /\.txt$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isTxt && !isPdf) {
    showToast("Only .txt and .pdf files are supported right now.", "error");
    return;
  }

  showToast("Reading document…", "success", 2000);
  try {
    let text;
    if (isTxt) {
      text = await file.text();
    } else {
      const buffer = await file.arrayBuffer();
      text = await extractPdfText(buffer);
    }
    if (!text.trim()) {
      showToast("Couldn't find any text in that file (it may be a scanned image PDF).", "error", 4500);
      return;
    }
    addDocument({ name: file.name, type: isTxt ? "txt" : "pdf", text, sizeBytes: file.size, subject: appState.subject });
    renderGrid();
    showToast("Document added.", "success");
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function documentCard(doc) {
  const card = document.createElement("div");
  card.className = "document-card";
  card.innerHTML = `
    <div class="document-card-top">
      <span class="document-icon"></span>
      <button type="button" class="icon-btn" aria-label="Favorite">${doc.favorite ? "⭐" : "☆"}</button>
    </div>
    <div class="document-title"></div>
    <div class="document-meta"></div>`;
  card.querySelector(".document-icon").textContent = doc.type === "pdf" ? "📕" : "📄";
  card.querySelector(".document-title").textContent = doc.name;
  card.querySelector(".document-meta").textContent = `${formatSize(doc.sizeBytes)} · ${SUBJECT_LABELS[doc.subject] || doc.subject}`;
  card.querySelector(".icon-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(doc.id);
    renderGrid();
  });
  card.addEventListener("click", () => openDetail(doc.id));
  return card;
}

function renderGrid() {
  const docs = getDocuments().filter((d) => matchesCurrentSpace(d.spaceId));
  grid.innerHTML = "";
  emptyState.hidden = docs.length > 0;
  grid.hidden = docs.length === 0;
  docs
    .slice()
    .sort((a, b) => (b.favorite === a.favorite ? b.uploadedAt - a.uploadedAt : b.favorite ? 1 : -1))
    .forEach((d) => grid.appendChild(documentCard(d)));
}

export function refreshDocuments() {
  renderGrid();
}

function openDetail(id) {
  const doc = getDocument(id);
  if (!doc) return;
  grid.hidden = true;
  emptyState.hidden = true;
  document.getElementById("documentToolbar").hidden = true;
  detailWrap.hidden = false;
  detailName.textContent = doc.name;
  detailMeta.textContent = `${formatSize(doc.sizeBytes)} · ${SUBJECT_LABELS[doc.subject] || doc.subject}${doc.truncated ? " · showing first part of a longer file" : ""}`;
  detailPreview.textContent = doc.text.slice(0, 1500) + (doc.text.length > 1500 ? "…" : "");
  detailResult.innerHTML = "";

  document.getElementById("documentSummarizeBtn").onclick = () => runSummarize(doc);
  document.getElementById("documentQuizBtn").onclick = () => {
    switchView("quiz");
    startQuizWithTopic(doc.name, doc.text);
  };
  document.getElementById("documentFlashcardsBtn").onclick = () => {
    switchView("flashcards");
    startFlashcardsWithTopic(doc.name, doc.text);
  };
  document.getElementById("documentAskBtn").onclick = () => {
    openChatWithMessage(
      `Using this document ("${doc.name}"):\n\n${doc.text.slice(0, 3000)}\n\nGive me a short overview, then I'll ask questions about it.`
    );
  };
  document.getElementById("documentRenameBtn").onclick = () => {
    promptForText("Rename document", doc.name, (newName) => {
      renameDocument(doc.id, newName);
      detailName.textContent = newName;
    });
  };
  document.getElementById("documentDeleteBtn").onclick = () => {
    confirmDanger("Delete this document?", `"${doc.name}" will be removed from your library.`, "Delete", () => {
      deleteDocument(doc.id);
      closeDetail();
      renderGrid();
      showToast("Document deleted.", "success", 1500);
    });
  };
}

function closeDetail() {
  detailWrap.hidden = true;
  document.getElementById("documentToolbar").hidden = false;
  renderGrid();
}

detailBackBtn.addEventListener("click", closeDetail);

async function runSummarize(doc) {
  detailResult.innerHTML = "";
  detailResult.appendChild(loadingRow("Summarizing…"));
  try {
    const data = await fetchSummary(doc.text, doc.subject, "normal");
    detailResult.innerHTML = "";
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = "<h3>Summary</h3><p></p>";
    card.querySelector("p").textContent = data.summary;
    detailResult.appendChild(card);
    if (data.keyPoints.length) {
      const kp = document.createElement("div");
      kp.className = "result-card";
      kp.innerHTML = '<h3>Key points</h3><ul class="result-list"></ul>';
      const ul = kp.querySelector("ul");
      data.keyPoints.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p;
        ul.appendChild(li);
      });
      detailResult.appendChild(kp);
    }
  } catch (err) {
    detailResult.innerHTML = "";
    detailResult.appendChild(errorBlock(friendlyErrorMessage(err), () => runSummarize(doc)));
  }
}

export function initDocuments() {
  renderGrid();
}
