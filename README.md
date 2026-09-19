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
    storage.js                Device storage, namespaced per account, that never throws
    session.js                Which account H1 is running as (or guest), decided before boot
    authScreen.js             The sign-in / create-account screen
    accountApi.js             Calls to the account API (CSRF token kept in memory only)
    cloudSync.js              Keeps an account's work in step across devices
    accountMenu.js            The account button, its menu, and Settings → Account
    guestMigration.js         Offers to copy on-device work into an account
    toast.js                  Toast notifications
server/
  index.js                  Express app: security headers, the account routes, the frontend,
                             and /api/chat, /api/explain, /api/quiz, /api/flashcards, /api/health
  accounts.js               Sign-up, sign-in, sessions, and each account's data and files
  db.js                     PostgreSQL access (pg in production, PGlite locally)
  migrations.js             The schema, applied in order and recorded
  auth/
    passwords.js             scrypt hashing and verification
    validation.js            Username and password rules (the server's copy is the real one)
    sessions.js              Server-side sessions and the cookie
    guards.js                Same-origin and CSRF checks
    rateLimit.js             Sign-in and sign-up rate limiting
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

## Accounts (optional)

H1 runs in one of two modes, and it always says which one it's in.

**Without a database** — the default, and how H1 has always worked — everything a student does
is stored in their browser on that device. No sign-in screen, nothing uploaded.

**With a database** — set `DATABASE_URL` to a PostgreSQL connection string — H1 adds accounts:
a student signs in, and their work follows them to any device they sign in on.

```bash
# Local development needs no setup at all: H1 uses a PostgreSQL-in-WebAssembly
# database in ./.data/h1-db automatically.
npm start

# Production: point it at a real PostgreSQL.
DATABASE_URL=postgresql://user:password@host:5432/h1 npm start
```

The schema is created and migrated on start-up. `GET /api/health` reports `accounts` as
`available`, `not-configured` or `unavailable`, so the mode is never a guess.

### How it works

- **Passwords** are stored as scrypt hashes with a per-password random salt. They are never
  stored, logged or returned in plain text, and a sign-in that fails does the same work whether
  or not the account exists, so response timing gives nothing away.
- **Sessions** live on the server. The browser only ever holds a random token in an HttpOnly
  cookie (`__Host-h1a` over HTTPS), which JavaScript cannot read. The token is rotated daily,
  a new one is issued at every sign-in, and sessions end after `SESSION_IDLE_DAYS` unused or
  `SESSION_MAX_DAYS` absolute.
- **Every request's identity comes from that session.** No endpoint accepts a username or an id
  from the browser as proof of who is asking; every query is scoped to the user id the session
  resolves to.
- **State-changing requests** must come from H1's own pages: same-origin check plus a per-session
  CSRF token held only in memory. No CORS headers are sent, so other sites can't read the API.
- **Syncing** is per store, with a version on each. Two devices editing at once merge by item id
  rather than overwriting, and anything that can't be uploaded stays on the device and is
  retried — H1 doesn't lose work to a dropped connection.
- **Guest work is never uploaded on its own.** Signing in on a device that already has work
  offers to copy it into the account, once; declining leaves it exactly where it is, and it can
  still be copied in later from Settings → Data.

### Signing in, and using H1 without an account

The sign-in screen is the front door: H1 opens on it unless there's a session already. "Use H1
without an account" is a deliberate choice that lasts for that browser session — everything stays
on the device, and H1 asks again next time it's opened. Switching either way is one click from
the account menu at the bottom of the sidebar.

On a server with no database there is nothing to sign in to, so the same screen says exactly that
and offers the on-device route instead of a form that would fail.

### The AI allowance

Every AI Tutor message costs real money on H1's API key, so each account gets an allowance:
**68 messages in a rolling 24 hours** by default (`AI_MESSAGE_LIMIT`, or changed from inside H1 by
the creator). Rolling rather than "resets at midnight", so a student working late doesn't get a
fresh allowance an hour later and nothing the next evening.

- Quizzes, flashcards, summaries and the rest don't count — only tutor messages.
- A device with no account is counted by device, because those messages cost the same.
- H1's own account has no allowance at all.
- The server enforces it and tells the browser what's left; the figure on screen is never
  worked out in the page. A message is only counted once it has actually been answered.

### H1's own account

`Pranav-H1` is created on start-up from the server's configuration and is exempt from the usual
username and password rules. Set one of:

```bash
node scripts/hash-password.js      # prints H1_MASTER_PASSWORD_HASH=... to put in the environment
```

or `H1_MASTER_PASSWORD` with the password itself. Neither belongs in the repository. If neither
is set, the account simply isn't created. Its password can't be changed or its account deleted
from inside the app — it comes from the server's configuration, so that's where it changes.

Signing in with it shows a short "Welcome, Creator" and unlocks a Creator controls section in
Settings:

- **The model H1 answers with.** Keep a list of models (provider + model id) and mark one active;
  every AI request in H1 then uses it. A model whose provider has no API key on this server can
  be listed but not switched to, because switching would stop H1 answering.
- **The message allowance** everyone else gets.
- **Who's using H1** — each account's messages in the last 24 hours, and how many devices are
  using it without an account.

The section is hidden for other accounts, but that's a courtesy, not the control: every one of
these requests is refused by the server unless the session belongs to that account.

## Deploying to Render

1. Push this project to a GitHub repo.
2. In Render, create a new **Web Service** from that repo (or use the included `render.yaml`
   as a Blueprint).
3. Set the AI provider's environment variables (e.g. `AI_PROVIDER=gemini` and `GEMINI_API_KEY`)
   in the Render dashboard — never in the repo.
4. Render runs `npm install` then `node server/index.js`, using the `PORT` it provides
   automatically.
5. For accounts, add a `DATABASE_URL` pointing at a PostgreSQL database, and
   `H1_MASTER_PASSWORD_HASH` if you want H1's own account. Without `DATABASE_URL` the deployment
   runs in on-device mode and says so — H1's free-plan disk is wiped on every restart, so a
   database on that disk would lose everyone's work, and pretending otherwise would be worse
   than not offering accounts at all.
