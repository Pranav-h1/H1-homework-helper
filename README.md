# H1 — AI Homework Helper

A polished, dashboard-style AI study app for students (Mathematics, Science, English, Hindi,
Tamil, and general homework), backed by a small Node/Express server that keeps AI API keys off
the frontend. Ships with a chat assistant, a Step-by-Step explainer, a Quiz generator, and
Flashcards — all powered by a pluggable AI provider (Gemini, Anthropic, or OpenAI).

## Project layout

```
public/                    Static frontend (served as-is, no build step)
  index.html                Dashboard shell: sidebar nav, subject selector, all tool views
  style.css                 Design system (themeable, responsive, animated)
  js/
    main.js                  App wiring: navigation, chat, explain, quiz, flashcards, settings
    api.js                   fetch() wrappers for /api/*
    health.js                Resilient backend health polling (retries before reporting down)
    markdown.js               Small safe markdown-ish renderer for AI chat replies
    theme.js                  Dark/Light/System theme + forced device-preview layout
    storage.js                localStorage helpers that never throw
    toast.js                  Toast notifications
server/
  index.js                  Express app: serves the frontend + /api/chat, /api/explain,
                             /api/quiz, /api/flashcards, /api/health
  providers/
    index.js                 Provider registry (picks a provider from AI_PROVIDER env var)
    gemini.js                 Google Gemini implementation
    anthropic.js               Anthropic (Claude) implementation
    openai.js                  OpenAI implementation
.env.example               Documents required environment variables (copy to .env for local dev)
render.yaml                 Render deployment blueprint
```

## Running locally

```bash
npm install
cp .env.example .env
# edit .env: set AI_PROVIDER and the matching API key
npm start
```

Then open http://localhost:3000.

If you don't set an API key, the site still loads and every tool still works in the UI —
sending a message (or generating a quiz/flashcards/explanation) returns a clear "AI backend
isn't configured" message instead of pretending to answer. The sidebar and Settings page always
show the live, accurate connection status.

## Configuring an AI provider

Set two environment variables (in `.env` locally, or in your host's dashboard in production):

- `AI_PROVIDER` — `gemini`, `anthropic`, or `openai`
- The matching key — `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`

Never commit real API keys. `.env` is git-ignored; `.env.example` only documents variable names.

### Gemini

```
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-flash-lite-latest   # optional override
```

`gemini-flash-lite-latest` is Google's self-updating alias for its lightweight, high-throughput
Flash-Lite model — a good default for the Gemini API free tier.

## Adding another provider

1. Create `server/providers/<name>.js` exporting `isConfigured()` and `chat(messages, systemPrompt)`.
2. Register it in the `PROVIDERS` map in `server/providers/index.js`.
3. Set `AI_PROVIDER=<name>` and that provider's API key.

No frontend or route changes are needed — every route in `server/index.js` only ever talks to
the registry, sending a single system prompt + message list and expecting a plain-text reply.

## Features

- **Ask H1** — free-form chat, with conversation memory, markdown-ish rendering, copy-to-clipboard
  on replies, and a retry button if a reply fails.
- **Step-by-Step Explainer** — turns a question into a numbered sequence of step cards.
- **Quiz** — pick a topic, difficulty (Easy/Medium/Hard) and question count (5/10); answer
  one question at a time and see a scored results screen with a full review.
- **Flashcards** — turns a topic into a flippable flashcard deck with a progress indicator.
- **Subject selector** — General/Math/Science/English/Hindi/Tamil; the selected subject is sent
  with every request and shapes the system prompt server-side.
- **Settings** — theme (Dark/Light/System, dark by default, persisted), a device-preview switch
  (Desktop/iPad-Tablet/Phone layout, independent of your actual window size), an Enter-to-send
  vs. Ctrl+Enter-to-send toggle, live AI provider/connection status, and chat history reset.

## Deploying to Render

1. Push this project to a GitHub repo.
2. In Render, create a new **Web Service** from that repo (or use the included `render.yaml`
   as a Blueprint).
3. Set the AI provider's environment variables (e.g. `AI_PROVIDER=gemini` and `GEMINI_API_KEY`)
   in the Render dashboard — never in the repo.
4. Render runs `npm install` then `node server/index.js`, using the `PORT` it provides
   automatically.
