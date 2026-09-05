const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function chat(messages, systemPrompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`OpenAI API error (${res.status}): ${text.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    const err = new Error("OpenAI API returned an empty response.");
    err.status = 502;
    throw err;
  }
  return reply;
}

module.exports = { isConfigured, chat, supportsImages: false };
