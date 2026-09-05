import { fetchFlashcards, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";
import { showToast } from "./toast.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";

const PROGRESS_KEY = "h1-flashcard-progress";

const flashSetup = document.getElementById("flashSetup");
const flashTopic = document.getElementById("flashTopic");
const flashStartBtn = document.getElementById("flashStartBtn");
const flashPlay = document.getElementById("flashPlay");
const flashProgressText = document.getElementById("flashProgressText");
const flashcard = document.getElementById("flashcard");
const flashFrontText = document.getElementById("flashFrontText");
const flashBackText = document.getElementById("flashBackText");
const flashPrevBtn = document.getElementById("flashPrevBtn");
const flashNextBtn = document.getElementById("flashNextBtn");
const flashNewBtn = document.getElementById("flashNewBtn");
const flashShuffleBtn = document.getElementById("flashShuffleBtn");
const flashRestartBtn = document.getElementById("flashRestartBtn");
const flashWrongOnlyBtn = document.getElementById("flashWrongOnlyBtn");
const flashKnownBtn = document.getElementById("flashKnownBtn");
const flashPracticeBtn = document.getElementById("flashPracticeBtn");

const flashState = { topic: "", cards: [], fullDeck: [], index: 0, wrongOnly: false };

function progressMap() {
  return safeGetJson(PROGRESS_KEY, {});
}

function markCard(front, status) {
  const map = progressMap();
  if (map[front] === status) {
    delete map[front];
  } else {
    map[front] = status;
  }
  safeSetJson(PROGRESS_KEY, map);
  updateMarkButtons();
}

function updateMarkButtons() {
  const map = progressMap();
  const card = flashState.cards[flashState.index];
  const status = card ? map[card.front] : null;
  flashKnownBtn.classList.toggle("selected", status === "known");
  flashPracticeBtn.classList.toggle("selected", status === "practice");
}

function renderFlashCard() {
  const total = flashState.cards.length;
  const card = flashState.cards[flashState.index];
  flashcard.classList.remove("flipped");
  flashFrontText.textContent = card.front;
  flashBackText.textContent = card.back;
  flashProgressText.textContent = `Card ${flashState.index + 1} of ${total}${flashState.wrongOnly ? " (wrong cards)" : ""}`;
  flashPrevBtn.disabled = flashState.index === 0;
  flashNextBtn.disabled = flashState.index === total - 1;
  updateMarkButtons();
}

function flipFlashcard() {
  flashcard.classList.toggle("flipped");
}

flashcard.addEventListener("click", flipFlashcard);
flashcard.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    flipFlashcard();
  }
});

document.addEventListener("keydown", (e) => {
  if (flashPlay.hidden) return;
  const view = document.getElementById("view-flashcards");
  if (!view || view.hidden) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "ArrowRight" && !flashNextBtn.disabled) flashNextBtn.click();
  if (e.key === "ArrowLeft" && !flashPrevBtn.disabled) flashPrevBtn.click();
});

flashPrevBtn.addEventListener("click", () => {
  if (flashState.index > 0) {
    flashState.index -= 1;
    renderFlashCard();
  }
});

flashNextBtn.addEventListener("click", () => {
  if (flashState.index < flashState.cards.length - 1) {
    flashState.index += 1;
    renderFlashCard();
  }
});

flashKnownBtn.addEventListener("click", () => {
  const card = flashState.cards[flashState.index];
  if (card) markCard(card.front, "known");
});
flashPracticeBtn.addEventListener("click", () => {
  const card = flashState.cards[flashState.index];
  if (card) markCard(card.front, "practice");
});

flashShuffleBtn.addEventListener("click", () => {
  for (let i = flashState.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flashState.cards[i], flashState.cards[j]] = [flashState.cards[j], flashState.cards[i]];
  }
  flashState.index = 0;
  renderFlashCard();
  showToast("Shuffled.", "success", 1500);
});

flashRestartBtn.addEventListener("click", () => {
  flashState.index = 0;
  renderFlashCard();
});

flashWrongOnlyBtn.addEventListener("click", () => {
  if (flashState.wrongOnly) {
    flashState.cards = flashState.fullDeck;
    flashState.wrongOnly = false;
    flashState.index = 0;
    renderFlashCard();
    flashWrongOnlyBtn.textContent = "Study only wrong cards";
    return;
  }
  const map = progressMap();
  const wrongCards = flashState.fullDeck.filter((c) => map[c.front] === "practice");
  if (wrongCards.length === 0) {
    showToast("No cards marked \"Need practice\" yet.", "error");
    return;
  }
  flashState.cards = wrongCards;
  flashState.wrongOnly = true;
  flashState.index = 0;
  renderFlashCard();
  flashWrongOnlyBtn.textContent = "Show full deck";
});

flashNewBtn.addEventListener("click", () => {
  flashPlay.hidden = true;
  flashSetup.hidden = false;
});

async function startFlashcards(topicOverride, sourceText) {
  const topic = (topicOverride || flashTopic.value).trim();
  if (!topic) {
    showToast("Enter a topic to generate flashcards.", "error");
    flashTopic.focus();
    return;
  }
  flashStartBtn.disabled = true;
  flashStartBtn.querySelector("span").textContent = "Generating…";
  try {
    const cards = await fetchFlashcards(topic, appState.subject, sourceText);
    flashState.topic = topic;
    flashState.cards = cards;
    flashState.fullDeck = cards;
    flashState.wrongOnly = false;
    flashState.index = 0;
    flashWrongOnlyBtn.textContent = "Study only wrong cards";
    flashSetup.hidden = true;
    flashPlay.hidden = false;
    renderFlashCard();
    logEvent("flashcards_studied", { count: cards.length, topic });
  } catch (err) {
    showToast(friendlyErrorMessage(err), "error", 4500);
  } finally {
    flashStartBtn.disabled = false;
    flashStartBtn.querySelector("span").textContent = "Generate Flashcards";
  }
}

flashStartBtn.addEventListener("click", () => startFlashcards());

export function initFlashcards() {
  // kept for symmetry with other feature modules — nothing to prime on load
}

export function startFlashcardsWithTopic(topic, sourceText) {
  if (sourceText) {
    startFlashcards(topic, sourceText);
    return;
  }
  flashTopic.value = topic;
  flashSetup.hidden = false;
  flashPlay.hidden = true;
}
