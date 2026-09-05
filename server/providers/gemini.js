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
// A message may optionally carry `image: { mimeType, data (base64) }`, attached as an extra part.
function toGeminiContents(messages) {
  return messages.map((m) => {
    const parts = [{ text: m.content }];
    if (m.image && m.image.mimeType && m.image.data) {
      parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
    }
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
    err.status = 502;
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
