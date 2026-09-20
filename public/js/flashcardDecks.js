import { safeGetJson, safeSetJson } from "./storage.js";
import { currentSpaceTag } from "./spacesStore.js";

const DECKS_KEY = "h1-flashcard-decks";
const DAY_MS = 24 * 60 * 60 * 1000;

function uid() {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Decks come back from storage that H1 doesn't fully control: older versions of H1 wrote some
// of them, and with an account they arrive from other devices. A deck missing its card list or
// its review states used to throw while the home screen counted what was due — which meant H1
// wouldn't start at all. Every deck is given the shape the rest of this file expects.
function normalizeDeck(deck) {
  if (!deck || typeof deck !== "object") return null;
  return {
    ...deck,
    id: typeof deck.id === "string" ? deck.id : uid(),
    topic: typeof deck.topic === "string" ? deck.topic : "Untitled deck",
    subject: typeof deck.subject === "string" ? deck.subject : "general",
    cards: Array.isArray(deck.cards) ? deck.cards.filter((c) => c && typeof c === "object") : [],
    cardStates: deck.cardStates && typeof deck.cardStates === "object" ? deck.cardStates : {},
  };
}

function readDecks() {
  const raw = safeGetJson(DECKS_KEY, []);
  return (Array.isArray(raw) ? raw : []).map(normalizeDeck).filter(Boolean);
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
