const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini's multimodal models accept inline image data alongside text, which powers the
// homework scanner / image attachment feature. Anthropic and OpenAI providers don't expose this.
const supportsImages = true;

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gemini has no "assistant" role and no separate system message slot in `contents`;
// assistant turns become "model" turns and the system prompt goes in `systemInstruction`.
// A message may carry `images: [{ mimeType, data (base64) }]` (or the older single `image`),
// each attached as an extra part after the text.
function toGeminiContents(messages) {
  return messages.map((m) => {
    const parts = [{ text: m.content }];
    const images = [...(Array.isArray(m.images) ? m.images : []), ...(m.image ? [m.image] : [])];
    images.forEach((img) => {
      if (img && img.mimeType && img.data) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    });
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });
}

async function chat(messages, systemPrompt) {
  const res = await fetch(`${API_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(messages),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
    // A rate limit isn't a broken gateway — nothing is misconfigured and retrying straight
    // away makes it worse, so it's kept distinct all the way to the student-facing message.
    err.rateLimited = res.status === 429;
    err.status = err.rateLimited ? 429 : 502;
    throw err;
  }

  const data = await res.json();

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    const err = new Error(`Gemini blocked the response (${blockReason}).`);
    err.status = 502;
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const reply = parts.map((p) => p.text || "").join("").trim();
  if (!reply) {
    const err = new Error("Gemini API returned an empty response.");
    err.status = 502;
    throw err;
  }
  return reply;
}

module.exports = { isConfigured, chat, supportsImages };
