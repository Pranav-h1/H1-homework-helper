require("dotenv").config();
const express = require("express");
const path = require("path");
const { getProvider, getProviderStatus } = require("./providers");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOPIC_LENGTH = 200;
const MAX_SUMMARIZE_LENGTH = 6000;
const MAX_SOURCE_TEXT_LENGTH = 4000;
const MAX_EXAM_TOPICS_LENGTH = 400;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB decoded
const ALLOWED_IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/i;
const QUIZ_COUNTS = [5, 10];
const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"];
const QUIZ_TYPES = ["mcq", "truefalse", "shortanswer", "mixed"];
const PRACTICE_COUNTS = [5, 10];
const FLASHCARD_COUNT = 8;
const STUDY_PLAN_MINUTES = [15, 30, 60, 90, 120];
const VOCAB_LANGUAGES = ["english", "hindi", "tamil"];
const SUMMARY_LENGTHS = ["short", "normal", "detailed"];
const EXAM_DAYS_MIN = 1;
const EXAM_DAYS_MAX = 30;

const SUBJECT_LABELS = {
  math: "Mathematics",
  science: "Science",
  english: "English",
  hindi: "Hindi",
  tamil: "Tamil",
  general: "General homework",
};

const AI_MODES = {
  tutor: "Teach step-by-step: walk through the reasoning fully before giving the final answer.",
  examcoach:
    "Act as an exam coach: help the student get there without immediately revealing the final answer. Give hints and ask a guiding question first; only give the full answer if they're still stuck after that or explicitly ask for it.",
  quick: "Give a concise, direct answer with minimal extra explanation — the student wants speed, not a full lesson.",
  socratic:
    "Use the Socratic method: mostly respond with guiding questions that lead the student to figure it out themselves, rather than stating the answer outright.",
  beginner: "Explain using very simple language and everyday analogies, as if teaching someone brand new to the topic.",
  revision: "Focus on the most important points only — like a quick revision session, not a full lesson.",
};

const BASE_SYSTEM_PROMPT = `You are H1, a friendly and patient AI homework helper and tutor for school students.
You help with Mathematics, Science, English, Hindi, Tamil, and general homework questions.

How to answer:
- Teach, don't just dump answers: walk through the reasoning in simple, student-friendly language.
- Match your effort to the question — keep simple factual questions short and direct; give fuller, structured explanations for harder or multi-step problems.
- Keep a warm, encouraging tutor tone. Be supportive without being over the top.
- Use short paragraphs, numbered steps, or bullet points when that makes things clearer.
- For math, show the working clearly using plain symbols (×, ÷, +, −, =, √) instead of LaTeX code like \\times or $...$.
- For science, explain the underlying idea in everyday language, not just the technical term.
- For English, explain grammar or meaning simply with a short example.
- For Hindi and Tamil questions, reply in the same language the student used.
- If a question is ambiguous, briefly ask a clarifying question or state the assumption you're making.
- If asked something outside homework/schoolwork, gently steer the conversation back to studies.
- If shown an image of a homework question, identify the question first, then answer it the same way you would a typed question.
- Avoid unnecessarily long responses — be thorough but not exhausting.`;

function subjectContextLine(subject) {
  const label = SUBJECT_LABELS[subject];
  if (!label || subject === "general") return "";
  return `\n\nThe student currently has the "${label}" subject selected — lean into that subject unless they clearly ask about something else.`;
}

function modeContextLine(mode) {
  const instruction = AI_MODES[mode];
  return instruction ? `\n\nActive mode — ${instruction}` : "";
}

function buildChatSystemPrompt(subject, mode) {
  return BASE_SYSTEM_PROMPT + subjectContextLine(subject) + modeContextLine(mode);
}

const EXPLAIN_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a Step-by-Step explanation for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"steps": ["first step text", "second step text", "..."]}
Break the explanation into 3 to 7 short, clearly separated steps a student can follow in order. Each step should be one to three sentences. Use plain-text math symbols, not LaTeX.`;

const QUIZ_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a quiz for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"questions": [{"type": "mcq", "question": "text", "options": ["a", "b", "c", "d"], "correctIndex": 0, "correctAnswer": "", "explanation": "short reason the correct answer is right"}]}
Rules per question type:
- "mcq": exactly 4 options, correctIndex is the 0-based index of the correct option, correctAnswer left as "".
- "truefalse": options must be exactly ["True", "False"], correctIndex is 0 or 1, correctAnswer left as "".
- "shortanswer": options must be [], correctIndex left as 0, and correctAnswer holds a short model answer (1 sentence) the student's typed answer will be compared against by the student themself.
Keep questions and options concise and age-appropriate for a school student.`;

const FLASHCARDS_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating study flashcards for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"cards": [{"front": "short question or term", "back": "concise, clear answer or definition"}]}
Keep each card focused on a single idea a student can memorize or quickly recall.`;

const PRACTICE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating short-answer practice questions for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"questions": [{"question": "text", "answer": "a model short answer, 1-3 sentences"}]}
Questions should require the student to recall or work something out, not just recognize an option.`;

const SUMMARIZE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are summarizing study text for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"summary": "a summary", "keyPoints": ["short point", "..."], "terms": [{"term": "word", "meaning": "short definition"}], "revision": ["short quick-revision bullet", "..."], "possibleQuestions": ["a question this text could be tested on", "..."]}
Keep keyPoints to at most 6 items, terms to at most 6 items, revision to at most 5 items, and possibleQuestions to at most 4 items. Only include terms that actually matter for understanding the text.`;

const VOCABULARY_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are explaining a word or short phrase for the H1 vocabulary tool, in the requested language.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"meaning": "concise definition", "explanation": "a simple, student-friendly explanation of what it means and when it's used", "example": "one example sentence using it naturally", "related": ["related word or synonym", "..."], "translation": ""}
Keep related to at most 5 items. Write the meaning, explanation and example in the requested language. If a translation target language is given, fill "translation" with the word translated into that language; otherwise leave it "".`;

const STUDY_PLAN_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a realistic, time-boxed study plan for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"plan": [{"title": "short task title", "minutes": 10, "description": "one short sentence on what to do"}]}
The sum of all "minutes" values should be close to (but not exceed) the student's available time. Order tasks sensibly (e.g. warm-up/review before harder practice). Use 3 to 6 tasks depending on the available time.`;

const EXAM_PLAN_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a day-by-day exam preparation plan for the H1 app.
Respond with ONLY a strict JSON object, no markdown code fences, no commentary before or after it, in this exact shape:
{"plan": [{"day": 1, "focus": "short label for what this day covers", "tasks": ["short task", "..."]}]}
Cover the given chapters/topics across the available days, spending more time on earlier/harder material and using the last day mainly for light review rather than new material. Use 2 to 5 short tasks per day (e.g. "Review chapter 2 notes", "10 practice questions on fractions", "15 flashcards on cell biology", "Take a short mixed quiz"). Produce exactly one plan entry per day for the number of days given. This is a study organization tool, not an authoritative guarantee of exam readiness.`;

app.use(express.json({ limit: "10mb" }));

// express.json() throws a raw SyntaxError for malformed bodies; turn it into a clean JSON error
// instead of letting Express's default HTML error page leak a stack trace to the client.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "That request is too large. Try a smaller image or shorter text." });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ai: getProviderStatus() });
});

function cleanSubject(subject) {
  return typeof subject === "string" && SUBJECT_LABELS[subject] ? subject : undefined;
}

function cleanMode(mode) {
  return typeof mode === "string" && AI_MODES[mode] ? mode : undefined;
}

function cleanSourceText(sourceText) {
  if (typeof sourceText !== "string") return "";
  return sourceText.trim().slice(0, MAX_SOURCE_TEXT_LENGTH);
}

function withSource(instruction, sourceText) {
  return sourceText ? `Using this material:\n\n${sourceText}\n\n${instruction}` : instruction;
}

function requireProvider(res) {
  const provider = getProvider();
  if (!provider) {
    res.status(503).json({
      error:
        "The AI backend isn't configured yet. Set AI_PROVIDER and the matching API key (e.g. ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY) on the server, then restart it.",
    });
    return null;
  }
  return provider;
}

// Models sometimes wrap JSON in prose or code fences despite instructions; pull out the
// outermost {...} object rather than trusting the response to be raw JSON.
function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function generationError(detail) {
  const err = new Error(detail);
  err.status = 502;
  return err;
}

// Validates an optional { mimeType, data } image attachment. Returns null if none was given,
// throws a request-shaped error (with .status) if one was given but is invalid/unsupported.
function validateImage(image, provider) {
  if (!image) return null;
  if (typeof image !== "object" || typeof image.mimeType !== "string" || typeof image.data !== "string" || !image.data) {
    const err = new Error("Image attachment must include a mimeType and base64 data.");
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_IMAGE_MIME.test(image.mimeType)) {
    const err = new Error("Only PNG, JPEG, WEBP, or GIF images are supported.");
    err.status = 400;
    throw err;
  }
  const approxBytes = (image.data.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    const err = new Error("That image is too large (max 6MB).");
    err.status = 400;
    throw err;
  }
  if (!provider.supportsImages) {
    const err = new Error("Image input isn't supported by the currently configured AI provider (Gemini supports it).");
    err.status = 400;
    throw err;
  }
  return { mimeType: image.mimeType, data: image.data };
}

app.post("/api/chat", async (req, res) => {
  const { messages, subject, mode, image } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request must include a non-empty "messages" array.' });
  }

  const cleaned = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return res.status(400).json({ error: 'Each message needs a role of "user"/"assistant" and string content.' });
    }
    const content = m.content.trim();
    if (!content) {
      return res.status(400).json({ error: "Message content cannot be empty." });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
    }
    cleaned.push({ role: m.role, content });
  }

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const validatedImage = validateImage(image, provider);
    const trimmedHistory = cleaned.slice(-MAX_HISTORY_MESSAGES);
    if (validatedImage) {
      trimmedHistory[trimmedHistory.length - 1].image = validatedImage;
    }
    const reply = await provider.chat(trimmedHistory, buildChatSystemPrompt(cleanSubject(subject), cleanMode(mode)));
    res.json({ reply });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("AI provider error:", err);
    res.status(err.status || 500).json({
      error: "The AI backend had trouble answering that. Please try again in a moment.",
    });
  }
});

app.post("/api/explain", async (req, res) => {
  const { question, subject } = req.body || {};

  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Request must include a non-empty \"question\" string." });
  }
  const trimmed = question.trim();
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Question is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = `Explain this step by step, in the H1 style: ${trimmed}`;
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      EXPLAIN_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't structure that explanation. Please try again.");
    }

    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean).slice(0, 8)
      : [];

    if (steps.length === 0) {
      throw generationError("H1 couldn't structure that explanation. Please try again.");
    }

    res.json({ steps });
  } catch (err) {
    console.error("Explain generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building that explanation. Please try again in a moment.",
    });
  }
});

app.post("/api/quiz", async (req, res) => {
  const { topic, subject, sourceText } = req.body || {};
  let { difficulty, count, questionType } = req.body || {};

  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "topic" string.' });
  }
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }

  difficulty = QUIZ_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  count = QUIZ_COUNTS.includes(Number(count)) ? Number(count) : 5;
  questionType = QUIZ_TYPES.includes(questionType) ? questionType : "mcq";
  const cleanedSource = cleanSourceText(sourceText);

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const typeInstruction =
      questionType === "mixed"
        ? "Use a mix of \"mcq\", \"truefalse\" and \"shortanswer\" question types across the set."
        : `Every question must have "type": "${questionType}".`;
    const userMessage = withSource(
      `Create a ${count}-question ${difficulty} quiz about: "${trimmedTopic}". ${typeInstruction}`,
      cleanedSource
    );
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      QUIZ_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't build that quiz. Please try again.");
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q) => {
            if (!q || typeof q.question !== "string") return null;
            let type = ["mcq", "truefalse", "shortanswer"].includes(q.type) ? q.type : "mcq";
            const question = q.question.trim();
            if (!question) return null;
            const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";

            if (type === "shortanswer") {
              const correctAnswer = typeof q.correctAnswer === "string" ? q.correctAnswer.trim() : "";
              if (!correctAnswer) return null;
              return { type, question, options: [], correctIndex: -1, correctAnswer, explanation };
            }

            let options = Array.isArray(q.options) ? q.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean) : [];
            if (type === "truefalse") {
              options = ["True", "False"];
            }
            if (options.length < 2) return null;
            let correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
            if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
            return { type, question, options, correctIndex, correctAnswer: "", explanation };
          })
          .filter(Boolean)
          .slice(0, count)
      : [];

    if (questions.length === 0) {
      throw generationError("H1 couldn't build that quiz. Please try again.");
    }

    res.json({ topic: trimmedTopic, difficulty, questionType, questions });
  } catch (err) {
    console.error("Quiz generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building that quiz. Please try again in a moment.",
    });
  }
});

app.post("/api/flashcards", async (req, res) => {
  const { topic, subject, sourceText } = req.body || {};

  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "topic" string.' });
  }
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }
  const cleanedSource = cleanSourceText(sourceText);

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = withSource(`Create ${FLASHCARD_COUNT} study flashcards about: "${trimmedTopic}"`, cleanedSource);
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      FLASHCARDS_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't build those flashcards. Please try again.");
    }

    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .map((c) => {
            if (!c || typeof c.front !== "string" || typeof c.back !== "string") return null;
            const front = c.front.trim();
            const back = c.back.trim();
            if (!front || !back) return null;
            return { front, back };
          })
          .filter(Boolean)
          .slice(0, FLASHCARD_COUNT)
      : [];

    if (cards.length === 0) {
      throw generationError("H1 couldn't build those flashcards. Please try again.");
    }

    res.json({ topic: trimmedTopic, cards });
  } catch (err) {
    console.error("Flashcards generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building those flashcards. Please try again in a moment.",
    });
  }
});

app.post("/api/practice", async (req, res) => {
  const { topic, subject, sourceText } = req.body || {};
  let { count, difficulty } = req.body || {};

  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "topic" string.' });
  }
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }
  count = PRACTICE_COUNTS.includes(Number(count)) ? Number(count) : 5;
  difficulty = QUIZ_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  const cleanedSource = cleanSourceText(sourceText);

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = withSource(
      `Create ${count} ${difficulty} short-answer practice questions about: "${trimmedTopic}"`,
      cleanedSource
    );
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      PRACTICE_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't build those practice questions. Please try again.");
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q) => {
            if (!q || typeof q.question !== "string" || typeof q.answer !== "string") return null;
            const question = q.question.trim();
            const answer = q.answer.trim();
            if (!question || !answer) return null;
            return { question, answer };
          })
          .filter(Boolean)
          .slice(0, count)
      : [];

    if (questions.length === 0) {
      throw generationError("H1 couldn't build those practice questions. Please try again.");
    }

    res.json({ topic: trimmedTopic, difficulty, questions });
  } catch (err) {
    console.error("Practice generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building those practice questions. Please try again in a moment.",
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  const { text, subject } = req.body || {};
  let { length } = req.body || {};

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "text" string.' });
  }
  const trimmed = text.trim();
  if (trimmed.length > MAX_SUMMARIZE_LENGTH) {
    return res.status(400).json({ error: `Text is too long (max ${MAX_SUMMARIZE_LENGTH} characters).` });
  }
  length = SUMMARY_LENGTHS.includes(length) ? length : "normal";
  const lengthInstruction = { short: "Keep the summary to 1-2 sentences.", normal: "Keep the summary to 2-4 sentences.", detailed: "Write a fuller summary of 5-8 sentences." }[length];

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = `${lengthInstruction}\n\nSummarize this study text:\n\n${trimmed}`;
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      SUMMARIZE_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't summarize that. Please try again.");
    }

    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean).slice(0, 6)
      : [];
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms
          .map((t) => (t && typeof t.term === "string" && typeof t.meaning === "string" ? { term: t.term.trim(), meaning: t.meaning.trim() } : null))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const revision = Array.isArray(parsed.revision)
      ? parsed.revision.map((r) => (typeof r === "string" ? r.trim() : "")).filter(Boolean).slice(0, 5)
      : [];
    const possibleQuestions = Array.isArray(parsed.possibleQuestions)
      ? parsed.possibleQuestions.map((q) => (typeof q === "string" ? q.trim() : "")).filter(Boolean).slice(0, 4)
      : [];

    if (!summary && keyPoints.length === 0) {
      throw generationError("H1 couldn't summarize that. Please try again.");
    }

    res.json({ summary, keyPoints, terms, revision, possibleQuestions });
  } catch (err) {
    console.error("Summarize generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble summarizing that. Please try again in a moment.",
    });
  }
});

app.post("/api/vocabulary", async (req, res) => {
  const { word, subject } = req.body || {};
  let { language, translateTo } = req.body || {};

  if (typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "word" string.' });
  }
  const trimmedWord = word.trim();
  if (trimmedWord.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `That's too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }
  language = VOCAB_LANGUAGES.includes(language) ? language : "english";
  translateTo = VOCAB_LANGUAGES.includes(translateTo) && translateTo !== language ? translateTo : null;

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = `Explain this word/phrase in ${language}: "${trimmedWord}"${translateTo ? `. Also translate it into ${translateTo}.` : ""}`;
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      VOCABULARY_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't look that up. Please try again.");
    }

    const meaning = typeof parsed.meaning === "string" ? parsed.meaning.trim() : "";
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
    const example = typeof parsed.example === "string" ? parsed.example.trim() : "";
    const translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
    const related = Array.isArray(parsed.related)
      ? parsed.related.map((r) => (typeof r === "string" ? r.trim() : "")).filter(Boolean).slice(0, 5)
      : [];

    if (!meaning && !explanation) {
      throw generationError("H1 couldn't look that up. Please try again.");
    }

    res.json({ word: trimmedWord, language, meaning, explanation, example, related, translation });
  } catch (err) {
    console.error("Vocabulary generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble looking that up. Please try again in a moment.",
    });
  }
});

app.post("/api/study-plan", async (req, res) => {
  const { topic, subject } = req.body || {};
  let { minutes } = req.body || {};

  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "topic" string.' });
  }
  const trimmedTopic = topic.trim();
  if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }
  minutes = STUDY_PLAN_MINUTES.includes(Number(minutes)) ? Number(minutes) : 30;

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = `Build a study plan for "${trimmedTopic}" using about ${minutes} minutes of study time.`;
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      STUDY_PLAN_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't build that study plan. Please try again.");
    }

    const plan = Array.isArray(parsed.plan)
      ? parsed.plan
          .map((t) => {
            if (!t || typeof t.title !== "string") return null;
            const title = t.title.trim();
            if (!title) return null;
            const taskMinutes = Number.isFinite(Number(t.minutes)) ? Math.max(1, Math.round(Number(t.minutes))) : 10;
            return {
              title,
              minutes: taskMinutes,
              description: typeof t.description === "string" ? t.description.trim() : "",
            };
          })
          .filter(Boolean)
          .slice(0, 8)
      : [];

    if (plan.length === 0) {
      throw generationError("H1 couldn't build that study plan. Please try again.");
    }

    res.json({ topic: trimmedTopic, minutes, plan });
  } catch (err) {
    console.error("Study plan generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building that study plan. Please try again in a moment.",
    });
  }
});

app.post("/api/exam-plan", async (req, res) => {
  const { subject, topics } = req.body || {};
  let { days } = req.body || {};

  if (typeof topics !== "string" || !topics.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "topics" string.' });
  }
  const trimmedTopics = topics.trim();
  if (trimmedTopics.length > MAX_EXAM_TOPICS_LENGTH) {
    return res.status(400).json({ error: `Topics list is too long (max ${MAX_EXAM_TOPICS_LENGTH} characters).` });
  }
  days = Number.isInteger(Number(days)) ? Number(days) : 7;
  days = Math.min(EXAM_DAYS_MAX, Math.max(EXAM_DAYS_MIN, days));

  const provider = requireProvider(res);
  if (!provider) return;

  try {
    const userMessage = `Build a ${days}-day exam preparation plan covering these chapters/topics: "${trimmedTopics}"`;
    const reply = await provider.chat(
      [{ role: "user", content: userMessage }],
      EXAM_PLAN_SYSTEM_PROMPT + subjectContextLine(cleanSubject(subject))
    );

    let parsed;
    try {
      parsed = parseJsonObject(reply);
    } catch {
      throw generationError("H1 couldn't build that exam plan. Please try again.");
    }

    const plan = Array.isArray(parsed.plan)
      ? parsed.plan
          .map((d, i) => {
            const tasks = Array.isArray(d?.tasks)
              ? d.tasks.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).slice(0, 6)
              : [];
            if (tasks.length === 0) return null;
            return {
              day: Number.isInteger(d.day) ? d.day : i + 1,
              focus: typeof d.focus === "string" ? d.focus.trim() : `Day ${i + 1}`,
              tasks,
            };
          })
          .filter(Boolean)
          .slice(0, days)
      : [];

    if (plan.length === 0) {
      throw generationError("H1 couldn't build that exam plan. Please try again.");
    }

    res.json({ topics: trimmedTopics, days, plan });
  } catch (err) {
    console.error("Exam plan generation error:", err);
    res.status(err.status || 500).json({
      error: "H1 had trouble building that exam plan. Please try again in a moment.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`H1 Homework Helper running on port ${PORT}`);
  const status = getProviderStatus();
  if (status.configured) {
    console.log(`AI provider: ${status.provider} (configured)`);
  } else {
    console.log("AI provider: none configured — chat will show a friendly setup message until one is set.");
  }
});
