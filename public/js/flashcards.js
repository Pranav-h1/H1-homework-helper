import { fetchFlashcards, friendlyErrorMessage } from "./api.js";
import { appState, SUBJECT_LABELS } from "./state.js";
import { showToast } from "./toast.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { logEvent } from "./progress.js";
import { createDeck, getDecks, deleteDeck, markCard as markDeckCard, getDueCount } from "./flashcardDecks.js";
import { matchesCurrentSpace } from "./spacesStore.js";

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
const flashDeckLibrary = document.getElementById("flashDeckLibrary");
const flashDeckLibraryList = document.getElementById("flashDeckLibraryList");

const flashState = { topic: "", cards: [], fullDeck: [], index: 0, wrongOnly: false, deckId: null };

function renderDeckLibrary() {
  if (!flashDeckLibrary || !flashDeckLibraryList) return;
  const decks = getDecks().filter((d) => matchesCurrentSpace(d.spaceId));
  flashDeckLibrary.hidden = decks.length === 0;
  flashDeckLibraryList.innerHTML = "";
  decks.forEach((deck) => {
    const due = getDueCount(deck);
    const row = document.createElement("div");
    row.className = "deck-row";
    row.innerHTML = `
      <button type="button" class="deck-row-main">
        <span class="deck-row-title"></span>
        <span class="deck-row-meta"></span>
      </button>
      <button type="button" class="icon-btn deck-row-delete" aria-label="Delete deck">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>`;
    row.querySelector(".deck-row-title").textContent = deck.topic;
    row.querySelector(".deck-row-meta").textContent = `${deck.cards.length} cards · ${SUBJECT_LABELS[deck.subject] || deck.subject}${due > 0 ? ` · ${due} due` : ""}`;
    row.querySelector(".deck-row-main").addEventListener("click", () => resumeDeck(deck));
    row.querySelector(".deck-row-delete").addEventListener("click", () => {
      deleteDeck(deck.id);
      renderDeckLibrary();
      showToast("Deck deleted.", "success", 1500);
    });
    flashDeckLibraryList.appendChild(row);
  });
}

function resumeDeck(deck) {
  flashState.topic = deck.topic;
  flashState.cards = deck.cards;
  flashState.fullDeck = deck.cards;
  flashState.deckId = deck.id;
  flashState.wrongOnly = false;
  flashState.index = 0;
  flashWrongOnlyBtn.textContent = "Study only wrong cards";
  flashSetup.hidden = true;
  flashPlay.hidden = false;
  renderFlashCard();
}

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

function deckCardIndex(card) {
  if (!flashState.deckId) return -1;
  return flashState.fullDeck.indexOf(card);
}

flashKnownBtn.addEventListener("click", () => {
  const card = flashState.cards[flashState.index];
  if (!card) return;
  markCard(card.front, "known");
  const idx = deckCardIndex(card);
  if (idx !== -1) markDeckCard(flashState.deckId, idx, true);
});
flashPracticeBtn.addEventListener("click", () => {
  const card = flashState.cards[flashState.index];
  if (!card) return;
  markCard(card.front, "practice");
  const idx = deckCardIndex(card);
  if (idx !== -1) markDeckCard(flashState.deckId, idx, false);
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
  renderDeckLibrary();
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
    const deck = createDeck(topic, appState.subject, cards);
    flashState.topic = topic;
    flashState.cards = cards;
    flashState.fullDeck = cards;
    flashState.deckId = deck.id;
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
  renderDeckLibrary();
}

export function refreshFlashcards() {
  renderDeckLibrary();
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
