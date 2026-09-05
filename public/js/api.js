async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const message = (data && data.error) || `Something went wrong (HTTP ${res.status}). Please try again.`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (!data) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data;
}

export async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed (HTTP ${res.status}).`);
  return res.json();
}

// options: { mode, image: { mimeType, data } }
export async function sendChat(messages, subject, options) {
  const opts = options || {};
  const data = await postJson("/api/chat", { messages, subject, mode: opts.mode, image: opts.image });
  if (typeof data.reply !== "string") {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.reply;
}

export async function fetchExplain(question, subject) {
  const data = await postJson("/api/explain", { question, subject });
  if (!Array.isArray(data.steps)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.steps;
}

// options: { sourceText, questionType }
export async function fetchQuiz(topic, difficulty, count, subject, options) {
  const opts = options || {};
  const data = await postJson("/api/quiz", {
    topic,
    difficulty,
    count,
    subject,
    questionType: opts.questionType,
    sourceText: opts.sourceText,
  });
  if (!Array.isArray(data.questions)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.questions;
}

export async function fetchFlashcards(topic, subject, sourceText) {
  const data = await postJson("/api/flashcards", { topic, subject, sourceText });
  if (!Array.isArray(data.cards)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.cards;
}

export async function fetchPractice(topic, count, subject, options) {
  const opts = options || {};
  const data = await postJson("/api/practice", { topic, count, subject, difficulty: opts.difficulty, sourceText: opts.sourceText });
  if (!Array.isArray(data.questions)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.questions;
}

export async function fetchSummary(text, subject, length) {
  const data = await postJson("/api/summarize", { text, subject, length });
  return {
    summary: typeof data.summary === "string" ? data.summary : "",
    keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
    terms: Array.isArray(data.terms) ? data.terms : [],
    revision: Array.isArray(data.revision) ? data.revision : [],
    possibleQuestions: Array.isArray(data.possibleQuestions) ? data.possibleQuestions : [],
  };
}

export async function fetchVocabulary(word, language, subject, translateTo) {
  const data = await postJson("/api/vocabulary", { word, language, subject, translateTo });
  return {
    meaning: typeof data.meaning === "string" ? data.meaning : "",
    explanation: typeof data.explanation === "string" ? data.explanation : "",
    example: typeof data.example === "string" ? data.example : "",
    related: Array.isArray(data.related) ? data.related : [],
    translation: typeof data.translation === "string" ? data.translation : "",
  };
}

export async function fetchStudyPlan(topic, minutes, subject) {
  const data = await postJson("/api/study-plan", { topic, minutes, subject });
  if (!Array.isArray(data.plan)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.plan;
}

export async function fetchExamPlan(topics, days, subject) {
  const data = await postJson("/api/exam-plan", { topics, days, subject });
  if (!Array.isArray(data.plan)) {
    throw new Error("The server sent back an unexpected response. Please try again.");
  }
  return data.plan;
}

// Distinguishes "server answered with an error" (has a real .message) from a fetch-level
// failure (offline, server down, CORS) so the UI can show the right kind of message.
export function friendlyErrorMessage(err) {
  if (err instanceof TypeError) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return (err && err.message) || "Something went wrong. Please try again.";
}
