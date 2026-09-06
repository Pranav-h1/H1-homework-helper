import { safeGetJson, safeSetJson } from "./storage.js";
import { currentSpaceTag } from "./spacesStore.js";

const DECKS_KEY = "h1-flashcard-decks";
const DAY_MS = 24 * 60 * 60 * 1000;

function uid() {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readDecks() {
  return safeGetJson(DECKS_KEY, []);
}

function writeDecks(decks) {
  safeSetJson(DECKS_KEY, decks);
  return decks;
}

export function createDeck(topic, subject, cards) {
  const decks = readDecks();
  const record = {
    id: uid(),
    topic,
    subject: subject || "general",
    cards,
    cardStates: {},
    favorite: false,
    spaceId: currentSpaceTag(),
    createdAt: Date.now(),
    lastReviewedAt: null,
  };
  decks.unshift(record);
  writeDecks(decks);
  return record;
}

export function getDecks() {
  return readDecks();
}

export function getDeck(id) {
  return readDecks().find((d) => d.id === id) || null;
}

export function deleteDeck(id) {
  writeDecks(readDecks().filter((d) => d.id !== id));
}

export function toggleDeckFavorite(id) {
  const decks = readDecks();
  const deck = decks.find((d) => d.id === id);
  if (!deck) return;
  deck.favorite = !deck.favorite;
  writeDecks(decks);
}

export function clearAllDecks() {
  writeDecks([]);
}

// Simple interval-doubling scheduler (a lightweight stand-in for full SM-2): a card marked
// "known" won't come up again for its interval; getting it wrong resets it to due-now.
export function markCard(deckId, cardIndex, known) {
  const decks = readDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return;
  const prev = deck.cardStates[cardIndex] || { reps: 0, interval: 0, dueAt: 0 };
  if (known) {
    const interval = prev.interval > 0 ? prev.interval * 2 : 1;
    deck.cardStates[cardIndex] = { reps: prev.reps + 1, interval, dueAt: Date.now() + interval * DAY_MS, known: true };
  } else {
    deck.cardStates[cardIndex] = { reps: 0, interval: 0, dueAt: Date.now(), known: false };
  }
  deck.lastReviewedAt = Date.now();
  writeDecks(decks);
}

export function getDueCount(deck) {
  const now = Date.now();
  return deck.cards.filter((_, i) => {
    const state = deck.cardStates[i];
    return !state || state.dueAt <= now;
  }).length;
}

export function getTotalDueCount() {
  return readDecks().reduce((sum, d) => sum + getDueCount(d), 0);
}

export function getMasteredCount(deck) {
  return deck.cards.filter((_, i) => deck.cardStates[i] && deck.cardStates[i].interval >= 8).length;
}
