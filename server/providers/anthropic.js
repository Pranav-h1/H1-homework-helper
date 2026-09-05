const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function chat(messages, systemPrompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Anthropic API error (${res.status}): ${text.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const reply = data?.content?.[0]?.text;
  if (!reply) {
    const err = new Error("Anthropic API returned an empty response.");
    err.status = 502;
    throw err;
  }
  return reply;
}

module.exports = { isConfigured, chat, supportsImages: false };
