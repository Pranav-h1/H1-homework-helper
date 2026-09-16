// Study Pack — one scan, one button, a whole study set.
//
// Scanning already read the questions off a page. Everything else a student would then do
// with that page — summarise it, make cards, make a quiz, keep a note — meant retyping the
// content into four different views. This does all of it from the same image in one go, and
// saves the results into the same real stores those views use, so a pack is indistinguishable
// from having built each piece by hand.
//
// Each step reports its own outcome. If cards generate but the quiz fails, the pack says the
// quiz failed and keeps the cards, rather than throwing the whole thing away or quietly
// pretending it produced less than it was asked for.
import { sendChat, fetchSummary, fetchFlashcards, fetchQuiz, friendlyErrorMessage } from "./api.js";
import { appState } from "./state.js";
import { createDeck } from "./flashcardDecks.js";
import { saveQuickNote } from "./notes.js";
import { addDocument } from "./documentsStore.js";
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { startQuizWithQuestions } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { invalidateBrain } from "./secondBrain.js";

const CARD_COUNT_HINT = 8;
const QUIZ_COUNT = 5;
// The backend caps a single message at 4000 characters, and the transcribed page is sent as
// source text to three separate generators.
const MAX_SOURCE_CHARS = 3200;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stepRow(label) {
  const row = el("div", "pack-step");
  row.appendChild(el("span", "pack-step-spinner"));
  row.appendChild(el("span", "pack-step-label", label));
  return row;
}

function setStep(row, state, text) {
  row.dataset.state = state;
  const icon = row.querySelector(".pack-step-spinner");
  icon.textContent = state === "done" ? "✓" : state === "failed" ? "!" : "";
  if (text) row.querySelector(".pack-step-label").textContent = text;
}

// Transcribes the page. This is the only step that needs the image; everything after it works
// from the text, which is what makes one scan enough.
async function transcribe(image, subject) {
  const prompt =
    "Transcribe the study material in this image as plain text. Include headings, definitions, " +
    "worked examples and questions exactly as they appear, in reading order. Do not solve " +
    "anything, do not summarise, and do not add commentary — just the content that is actually " +
    "on the page. If the page is blank or unreadable, reply with exactly: NO_CONTENT";
  const reply = await sendChat([{ role: "user", content: prompt }], subject, {
    mode: "default",
    language: appState.language,
    image,
  });
  const text = (reply || "").trim();
  if (!text || /^NO_CONTENT/i.test(text)) return null;
  return text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) : text;
}

// A short, human topic name for the pack, taken from the material itself rather than from a
// filename or the current date.
async function nameTopic(sourceText, subject) {
  try {
    const reply = await sendChat(
      [
        {
          role: "user",
          content: `Give a short topic name (2-5 words, no punctuation, no quotes) for this study material:\n\n${sourceText.slice(0, 1200)}`,
        },
      ],
      subject,
      { mode: "default", language: appState.language }
    );
    const name = (reply || "").split("\n")[0].replace(/["'.]/g, "").trim();
    return name && name.length <= 60 ? name : "Scanned material";
  } catch {
    return "Scanned material";
  }
}

export async function buildStudyPack(image, host, { onDone } = {}) {
  host.innerHTML = "";
  const panel = el("div", "pack-panel");
  panel.appendChild(el("h3", "pack-title", "Building your study pack"));
  panel.appendChild(
    el("p", "pack-sub", "Reading the page once, then building everything from what's actually on it.")
  );

  const steps = {
    read: stepRow("Reading the page"),
    name: stepRow("Naming the topic"),
    summary: stepRow("Writing a summary"),
    cards: stepRow("Making flashcards"),
    quiz: stepRow("Building a quiz"),
    save: stepRow("Saving it all"),
  };
  const list = el("div", "pack-steps");
  Object.values(steps).forEach((s) => list.appendChild(s));
  panel.appendChild(list);
  host.appendChild(panel);

  const result = { topic: null, sourceText: null, summary: null, cards: null, quiz: null, saved: [], failures: [] };

  // --- Read -----------------------------------------------------------------
  try {
    result.sourceText = await transcribe(image, appState.subject);
  } catch (err) {
    setStep(steps.read, "failed", `Couldn't read the page — ${friendlyErrorMessage(err)}`);
    ["name", "summary", "cards", "quiz", "save"].forEach((k) => setStep(steps[k], "failed", "Skipped"));
    renderSummaryBlock(panel, result, onDone);
    return result;
  }
  if (!result.sourceText) {
    setStep(steps.read, "failed", "Nothing readable on that page — try a clearer photo.");
    ["name", "summary", "cards", "quiz", "save"].forEach((k) => setStep(steps[k], "failed", "Skipped"));
    renderSummaryBlock(panel, result, onDone);
    return result;
  }
  setStep(steps.read, "done", `Read ${result.sourceText.length} characters from the page`);

  // --- Name -----------------------------------------------------------------
  result.topic = await nameTopic(result.sourceText, appState.subject);
  setStep(steps.name, "done", `Topic: ${result.topic}`);

  // --- Summary, cards and quiz ---------------------------------------------
  // Run together: they're independent, and doing them in series triples the wait for no
  // benefit. Each settles on its own so one failure doesn't take the others down.
  const [summaryRes, cardsRes, quizRes] = await Promise.allSettled([
    fetchSummary(result.sourceText, appState.subject, "medium"),
    fetchFlashcards(result.topic, appState.subject, result.sourceText),
    fetchQuiz(result.topic, "medium", QUIZ_COUNT, appState.subject, {
      questionType: "mixed",
      sourceText: result.sourceText,
    }),
  ]);

  if (summaryRes.status === "fulfilled" && summaryRes.value.summary) {
    result.summary = summaryRes.value;
    setStep(steps.summary, "done", `Summary with ${result.summary.keyPoints.length} key points`);
  } else {
    result.failures.push("summary");
    setStep(steps.summary, "failed", "Summary didn't generate");
  }

  if (cardsRes.status === "fulfilled" && cardsRes.value.length > 0) {
    result.cards = cardsRes.value;
    setStep(steps.cards, "done", `${result.cards.length} flashcards`);
  } else {
    result.failures.push("flashcards");
    setStep(steps.cards, "failed", "Flashcards didn't generate");
  }

  if (quizRes.status === "fulfilled" && quizRes.value.length > 0) {
    result.quiz = quizRes.value;
    setStep(steps.quiz, "done", `${result.quiz.length}-question quiz ready`);
  } else {
    result.failures.push("quiz");
    setStep(steps.quiz, "failed", "Quiz didn't generate");
  }

  // --- Save -----------------------------------------------------------------
  // Into the same stores the individual features use, so nothing about a pack is special
  // afterwards: the deck is a normal deck, the note is a normal note.
  try {
    addDocument({
      name: `${result.topic} (scanned)`,
      type: "text",
      text: result.sourceText,
      sizeBytes: result.sourceText.length,
      subject: appState.subject,
    });
    result.saved.push("document");

    if (result.summary) {
      const body = [
        result.summary.summary,
        result.summary.keyPoints.length ? "\n\nKey points\n" + result.summary.keyPoints.map((p) => `- ${p}`).join("\n") : "",
        result.summary.terms.length ? "\n\nTerms\n" + result.summary.terms.map((t) => `- ${typeof t === "string" ? t : `${t.term}: ${t.definition}`}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("");
      saveQuickNote(result.topic, body, "Study packs");
      result.saved.push("note");
    }

    if (result.cards) {
      createDeck(result.topic, appState.subject, result.cards);
      result.saved.push("deck");
    }
    setStep(steps.save, "done", `Saved: ${result.saved.join(", ")}`);
  } catch (err) {
    result.failures.push("saving");
    setStep(steps.save, "failed", `Couldn't save everything — ${friendlyErrorMessage(err)}`);
  }

  invalidateBrain();
  renderSummaryBlock(panel, result, onDone);
  return result;
}

function renderSummaryBlock(panel, result, onDone) {
  const done = el("div", "pack-done");

  const built = [];
  if (result.saved.includes("document")) built.push("the page saved to Documents");
  if (result.saved.includes("note")) built.push("a summary note");
  if (result.saved.includes("deck")) built.push(`a ${result.cards.length}-card deck`);
  if (result.quiz) built.push(`a ${result.quiz.length}-question quiz`);

  if (built.length === 0) {
    done.appendChild(el("p", "pack-done-line", "Nothing came out of that one. Try a clearer photo, or use the individual tools."));
  } else {
    done.appendChild(el("h4", "pack-done-title", `Study pack ready: ${result.topic}`));
    done.appendChild(el("p", "pack-done-line", `Built ${built.join(", ")}.`));
    if (result.failures.length > 0) {
      done.appendChild(
        el(
          "p",
          "pack-done-warn",
          `${result.failures.join(" and ")} didn't generate, so ${result.failures.length === 1 ? "that part isn't" : "those parts aren't"} in the pack. Everything else above was still saved.`
        )
      );
    }

    const actions = el("div", "pack-actions");
    if (result.cards) {
      const b = el("button", "btn btn-primary", "Study the cards");
      b.type = "button";
      b.addEventListener("click", () => {
        switchView("flashcards");
        startFlashcardsWithTopic(result.topic);
      });
      actions.appendChild(b);
    }
    if (result.quiz) {
      const b = el("button", "btn btn-ghost", "Take the quiz");
      b.type = "button";
      b.addEventListener("click", () => {
        switchView("quiz");
        // The exact questions built from this page, not a fresh generation — the pack said
        // the quiz was ready, so it has to be that quiz.
        startQuizWithQuestions(result.topic, result.quiz, "medium");
      });
      actions.appendChild(b);
    }
    if (result.saved.includes("note")) {
      const b = el("button", "btn btn-ghost", "Open the note");
      b.type = "button";
      b.addEventListener("click", () => switchView("notes"));
      actions.appendChild(b);
    }
    done.appendChild(actions);
    showToast(`Study pack built: ${result.topic}`, "success", 3000);
  }

  panel.appendChild(done);
  if (onDone) onDone(result);
}

export { CARD_COUNT_HINT, QUIZ_COUNT };
