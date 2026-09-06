// Lets the AI Tutor input understand simple actions, not just questions — "make flashcards
// from this", "add this exam to my calendar", "open my Math space", etc. Every branch here
// either performs the real action immediately (pure navigation/store writes) or triggers the
// real generation endpoint and only confirms success once that call actually resolves —
// nothing here is reported as done before it is.
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { createTask } from "./homeworkStore.js";
import { createItem as createPlannerItem } from "./plannerStore.js";
import { getSpaces } from "./spacesStore.js";
import { switchToSpace } from "./spacesUI.js";
import { addMistake } from "./mistakeBookStore.js";
import { appState } from "./state.js";

function confirmAction(text) {
  showToast(`✓ ${text}`, "success", 3200);
}

function extractTopicAfter(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const rest = text.slice(idx + kw.length).trim();
      if (rest) return rest.replace(/^(on|about|for|from)\s+/i, "").replace(/[.?!]+$/, "");
    }
  }
  return "";
}

// Returns true if the message was handled as an action (caller should not also send it to
// the AI as a normal chat message), false if it should fall through to a normal reply.
export function tryHandleAiCommand(text) {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  // "Open my Math space" / "switch to Exam Prep space"
  let m = lower.match(/(?:open|switch to|go to)\s+(?:my\s+)?(.+?)\s+space/);
  if (m) {
    const wanted = m[1].trim();
    const space = getSpaces().find((s) => s.name.toLowerCase() === wanted || s.name.toLowerCase().includes(wanted));
    if (space) {
      switchToSpace(space.id);
      confirmAction(`Switched to "${space.name}" Space`);
      return true;
    }
  }

  // "Show me what I should revise" / "what should I revise"
  if (/what should i revise|show me what to revise|revision/.test(lower) && lower.length < 60) {
    switchView("progress");
    confirmAction("Opened Revision Center");
    return true;
  }

  // "Start a focus session (for X)"
  if (/^(start|begin)\s+(a\s+)?focus session/.test(lower)) {
    switchView("study-mode");
    confirmAction("Opened Focus");
    return true;
  }

  // "Create a mistake-book entry" — manual capture from the chat itself
  if (/mistake.?book entry|add.*to.*mistake book/.test(lower)) {
    addMistake({ question: text, subject: appState.subject, topic: "From chat", studentAnswer: "", correctAnswer: "", explanation: "" });
    confirmAction("Added to Mistake Book");
    return true;
  }

  // "Add this exam to my calendar" / "add this to my planner"
  if (/add (this|it)\s+(exam\s+)?to (my )?(calendar|planner)/.test(lower)) {
    const title = extractTopicAfter(text, ["exam on", "exam for", "exam about"]) || "Exam";
    createPlannerItem({ type: "exam", title, subject: appState.subject, deadline: "" });
    confirmAction("Added to Planner — set its date from the Study Planner");
    switchView("planner");
    return true;
  }

  // "Turn this homework into a study plan" / "add this as homework" / "create a task for..."
  if (/^(add|create)\s+(a\s+)?(homework\s+)?task/.test(lower) || /add this as homework/.test(lower)) {
    const title = extractTopicAfter(text, ["task for", "task:", "task to", "homework:"]) || text;
    createTask({ title: title.slice(0, 120), subject: appState.subject });
    confirmAction("Homework task created");
    switchView("homework");
    return true;
  }

  // "Make a quiz from/on/about X" / "create a quiz for X" / "quiz me on X" — this still has
  // to actually generate (a real network call that can fail), so we route + trigger it and
  // let quiz.js's own loading/error/success UI be the source of truth, rather than
  // confirming success here before the call has even resolved.
  m = lower.match(/(?:make|create|start|build)\s+a\s+quiz|quiz me/);
  if (m) {
    const topic = extractTopicAfter(text, ["quiz on", "quiz about", "quiz from", "quiz for", "quiz me on", "quiz me about"]) || appState.subject;
    switchView("quiz");
    startQuizWithTopic(topic);
    showToast(`Building a quiz${topic ? ` on "${topic}"` : ""}…`, "success", 2200);
    return true;
  }

  // "Make flashcards from/on/about X" — same reasoning: flashcards.js's own UI confirms or
  // reports the actual outcome once generation finishes.
  m = lower.match(/(?:make|create|build|generate)\s+flashcards/);
  if (m) {
    const topic = extractTopicAfter(text, ["flashcards on", "flashcards about", "flashcards from", "flashcards for"]) || appState.subject;
    switchView("flashcards");
    startFlashcardsWithTopic(topic);
    showToast(`Building flashcards${topic ? ` on "${topic}"` : ""}…`, "success", 2200);
    return true;
  }

  return false;
}
