// Lets the AI Tutor input understand simple actions, not just questions — "make flashcards
// from this", "add this exam to my calendar", "open my Math space", etc. Every branch here
// either performs the real action immediately (pure navigation/store writes) or triggers the
// real generation endpoint and only confirms success once that call actually resolves —
// nothing here is reported as done before it is.
import { switchView } from "./nav.js";
import { showToast } from "./toast.js";
import { startQuizWithTopic } from "./quiz.js";
import { startFlashcardsWithTopic } from "./flashcards.js";
import { generatePracticeFromSource } from "./moreTools.js";
import { prefillStudyPlan } from "./planner.js";
import { createTask } from "./homeworkStore.js";
import { createItem as createPlannerItem } from "./plannerStore.js";
import { getSpaces } from "./spacesStore.js";
import { switchToSpace } from "./spacesUI.js";
import { addMistake } from "./mistakeBookStore.js";
import { saveQuickNote } from "./notes.js";
import { appState, setMode } from "./state.js";
import { openTrack } from "./codeLab.js";
import { selectSubtabInView } from "./subtabs.js";
import { prefillStudySession } from "./studyMode.js";

// The backend refuses a message over 4000 characters; a command's own wording has to fit too.
const MAX_OUTGOING_CHARS = 3990;

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

// Reference list for the composer's "/" autocomplete — kept separate from the handler logic
// below so the menu can be built without duplicating behavior.
export const SLASH_COMMANDS = [
  { name: "explain", hint: "<topic> — a clear step-by-step explanation" },
  { name: "solve", hint: "<problem> — solve with full working shown" },
  { name: "hint", hint: "[detail] — a hint, not the full answer" },
  { name: "quiz", hint: "<topic> — start a quiz on this topic" },
  { name: "flashcards", hint: "<topic> — generate a flashcard deck" },
  { name: "practice", hint: "<topic> — generate practice questions" },
  { name: "summarize", hint: "<text> — summarize this text" },
  { name: "summary", hint: "[text] — a short summary (of the last answer if no text)" },
  { name: "python", hint: "[question] — learn it in Python, or open the Python course" },
  { name: "code", hint: "[question] — coding help, or open Code Lab" },
  { name: "debug", hint: "<code or error> — find the bug and explain the fix" },
  { name: "study", hint: "[topic] — set up a focus session for this topic" },
  { name: "simplify", hint: "— explain the last answer more simply" },
  { name: "improve", hint: "[your answer] — improve clarity and correctness" },
  { name: "notes", hint: "<text> — save this as a new note" },
  { name: "revise", hint: "— open your Revision Center" },
  { name: "plan", hint: "<topic> — start a study plan" },
  { name: "check", hint: "<your reasoning> — check your work" },
  { name: "teach", hint: "<topic> — a guided lesson with a check-in" },
  { name: "examples", hint: "— another example of the last topic" },
  { name: "mistakes", hint: "— open your Mistake Book" },
];

// When a command's text is too long to send as a message, the text goes along as an attached
// file and this is the message instead. Null for anything that isn't one of these commands.
const LONG_TEXT_PROMPTS = {
  debug: "Debug the attached code. Tell me the exact line that's wrong, explain what went wrong and why in simple words, then show only the corrected lines in a code block.",
  explain: "Explain the attached text clearly, step by step.",
  summarize: "Summarize the attached text.",
  summary: "Summarize the attached text.",
  check: "Check the reasoning in the attached text and tell me if it's correct, explaining any mistakes.",
  improve: "Improve the attached answer while keeping the original idea — focus on clarity and correctness.",
  solve: "Solve the attached problem step by step, showing your full working.",
  code: "Help me with the attached code. Explain clearly for a student, with short examples in code blocks tagged with their language.",
  python: "Help me with the attached Python. Explain it simply, with short runnable examples in python code blocks.",
};

export function longCommandPrompt(text) {
  const parsed = firstWord(text);
  if (!parsed || !parsed.rest || !LONG_TEXT_PROMPTS[parsed.cmd]) return null;
  return { prompt: LONG_TEXT_PROMPTS[parsed.cmd], body: parsed.rest };
}

// "/debug" sent with a file attached means "debug the attached file". Anything typed after the
// command is kept as extra detail.
export function commandPromptForAttachments(text) {
  const parsed = firstWord(text);
  if (!parsed || !LONG_TEXT_PROMPTS[parsed.cmd]) return null;
  return parsed.rest ? `${LONG_TEXT_PROMPTS[parsed.cmd]}\n\n${parsed.rest}` : LONG_TEXT_PROMPTS[parsed.cmd];
}

function firstWord(text) {
  const m = text.trim().match(/^\/(\S+)\s*(.*)$/s);
  return m ? { cmd: m[1].toLowerCase(), rest: m[2].trim() } : null;
}

// Slash commands are deterministic (no fuzzy NLP needed) — each either performs a real action
// immediately ({ action: "handled" }) or hands back rewritten text for a normal AI turn
// ({ action: "rewrite", text }). Returns null when the input isn't a recognized slash command,
// so the caller can fall through to a normal message untouched.
export function resolveSlashCommand(text) {
  const parsed = firstWord(text);
  if (!parsed) return null;
  const { cmd, rest } = parsed;

  switch (cmd) {
    case "explain":
      if (!rest) return null;
      return { action: "rewrite", text: `Explain ${rest} clearly, step by step.` };

    case "solve":
      if (!rest) return null;
      return { action: "rewrite", text: `Solve this step by step, showing your full working: ${rest}` };

    case "hint":
      return { action: "rewrite", text: rest ? `Give me a hint for this, not the full answer yet: ${rest}` : "Give me a hint for this, not the full answer yet." };

    case "check":
      if (!rest) return null;
      return { action: "rewrite", text: `Check my reasoning and tell me if it's correct, explaining any mistakes: ${rest}` };

    case "simplify":
      return { action: "rewrite", text: "Can you explain your last answer more simply?" };

    case "improve":
      if (!rest) return { action: "rewrite", text: "Can you improve that answer — keep the same core idea, but make it clearer and more correct?" };
      return { action: "rewrite", text: `Improve this answer while keeping the original idea — focus on clarity and correctness: ${rest}` };

    case "examples":
      return { action: "rewrite", text: "Can you give another concrete example?" };

    case "summarize":
    case "summary":
      return { action: "rewrite", text: rest ? `Summarize this:\n\n${rest}` : "Summarize your last answer in a few short bullet points." };

    case "python":
      if (!rest) {
        switchView("code");
        selectSubtabInView("code", "learn");
        openTrack("py");
        confirmAction("Opened the Python course");
        return { action: "handled" };
      }
      return {
        action: "rewrite",
        text: `Teach me this in Python: ${rest}\n\nExplain it simply, then give a short runnable example in a python code block and say what it prints.`,
      };

    case "code":
      if (!rest) {
        switchView("code");
        selectSubtabInView("code", "learn");
        confirmAction("Opened Code Lab");
        return { action: "handled" };
      }
      return {
        action: "rewrite",
        text: `Help me with this coding question: ${rest}\n\nExplain clearly for a student, with short examples in code blocks tagged with their language.`,
      };

    case "debug": {
      if (!rest) {
        showToast("Usage: /debug <paste your code or the error message>", "error", 3200);
        return { action: "handled" };
      }
      const text =
        "Debug this for me. Tell me the exact line that's wrong, explain what went wrong and why in simple words, " +
        "then show only the corrected lines in a code block:\n\n" +
        rest;
      if (text.length > MAX_OUTGOING_CHARS) {
        showToast("That's too long to paste into one message — attach the file with the + button and ask H1 to debug it.", "error", 4600);
        return { action: "handled" };
      }
      return { action: "rewrite", text };
    }

    case "study":
      switchView("study-mode");
      prefillStudySession(rest || "");
      confirmAction(rest ? `Focus session ready for "${rest.slice(0, 40)}" — press Start` : "Opened Study Mode");
      return { action: "handled" };

    case "quiz": {
      const topic = rest || appState.subject;
      switchView("quiz");
      startQuizWithTopic(topic);
      showToast(`Building a quiz${rest ? ` on "${rest}"` : ""}…`, "success", 2200);
      return { action: "handled" };
    }

    case "flashcards": {
      const topic = rest || appState.subject;
      switchView("flashcards");
      startFlashcardsWithTopic(topic);
      showToast(`Building flashcards${rest ? ` on "${rest}"` : ""}…`, "success", 2200);
      return { action: "handled" };
    }

    case "practice": {
      const topic = rest || appState.subject;
      generatePracticeFromSource(topic, undefined);
      showToast(`Writing practice questions${rest ? ` on "${rest}"` : ""}…`, "success", 2200);
      return { action: "handled" };
    }

    case "plan":
      switchView("planner");
      prefillStudyPlan(rest || appState.subject);
      showToast("Topic filled in — review and click \"Build plan\".", "success", 2600);
      return { action: "handled" };

    case "revise":
      switchView("progress");
      confirmAction("Opened Revision Center");
      return { action: "handled" };

    case "mistakes":
      switchView("progress");
      requestAnimationFrame(() => {
        const card = [...document.querySelectorAll(".chart-card")].find((el) => el.textContent.includes("Mistake book"));
        card?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      confirmAction("Opened your Mistake Book");
      return { action: "handled" };

    case "notes":
      if (!rest) {
        showToast("Usage: /notes <what to save>", "error");
        return { action: "handled" };
      }
      saveQuickNote(rest.slice(0, 60), rest);
      confirmAction("Saved to Notes");
      return { action: "handled" };

    case "teach":
      setMode("teachme");
      return { action: "rewrite", text: rest ? `Teach me ${rest}.` : "Teach me about this." };

    default:
      return null;
  }
}
