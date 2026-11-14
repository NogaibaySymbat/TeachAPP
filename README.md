# TeachAPP

**Find the PMP ideas you can't explain — before the exam does.**

Live: **https://teachapp.vercel.app**

You explain a PMP topic to an AI student. The student writes down only what you said, then answers practice questions using nothing but those notes. When it gets one wrong, you have found the idea you can't explain yet. Explain it again and let it retake the exam.

TeachAPP works alongside a prep course and a question bank: they show *what* you got wrong; TeachAPP shows *which idea* you can't explain.

## How it works

1. **Choose a topic** — four PMP topics today, each with three original practice questions. The home page suggests a topic of the day.
2. **Explain it** in chat, typing or speaking (browser speech recognition). The student replies with short questions; it can read replies aloud.
3. **Notebook** — the student's notes are exact quotes of your messages, mistakes included. Each note links to its source message.
4. **Student exam** — the model sees only the notebook and the public questions, never the chat or the answer key. Answers must cite notebook entries.
5. **Grading and debrief** — code grades against the answer key; uncited or guessed answers score zero. The debrief names the area to explain next without giving away the answer; correct options stay hidden until the student passes.
6. **Retake** after explaining more, and compare attempts.

No sign-in: history is saved per browser.

## What is real and what is not

- Every reply, notebook and exam answer comes from a live model call. Nothing is pre-recorded or simulated. Grading and the debrief are deterministic code.
- "Notebook only" is enforced by what the model receives and by citation checks, not proven semantically. A small live experiment matched expectations in 12 of 13 runs: [report](reports/notebook-grounding/2026-11-14T15-17-34.760Z/REPORT.md).
- The practice questions are original. This is not an official PMP exam, and practice scores do not predict real results.
- [/pricing](https://teachapp.vercel.app/pricing) is a preview: payments are not connected and nothing is limited by plan.

## Cost and abuse controls

- **OpenAI:** a durable, shared budget ledger (`ai_usage`) reserves a conservative amount before every call; no automatic retries; completed results are cached.
- **Paid-request limits:** student replies, notebooks, exams and speech are limited to 120 per network per hour and 600 per hour site-wide (a keyed hash of the address is stored, never the address). If the limit table is missing, requests continue and the budget ledger still caps spending.
- **Voice:** Deepgram Aura-2 (sign-up credit, no card) or Google Chirp 3: HD, with a per-provider monthly character cap in `tts_usage`; only stored student replies can be read aloud. Without a key, the browser's voice is used.
- **Ownership:** every session read and write checks the browser owner; write routes require same-origin JSON.

## Stack and structure

Next.js 16 · React 19 · TypeScript · PostgreSQL (Supabase) · OpenAI · Deepgram · Vercel

| Path | What lives there |
| --- | --- |
| `src/app`, `src/components` | Pages and UI |
| `src/app/api` | Thin route handlers |
| `src/server` | Database access, grading, rate limits, voice providers |
| `src/ai`, `prompts` | Model client, student, notebook, examinee, debrief, topic planner |
| `content/exams/pmp` | Topics, key ideas and questions. A new exam is a new folder, not new code |
| `db/schema.sql` | Schema (additive, safe to re-run) |
| `tests` | Vitest unit and integration tests |

## Run locally

Requirements: Node.js 24 and PostgreSQL 15+.

```sh
npm ci
npm run setup:local   # creates .env.local and a local database on port 55433
npm run dev
```

Or bring your own database: copy `.env.example` to `.env.local`, set `DATABASE_URL`, apply `db/schema.sql`, then `npm run dev`. Without an OpenAI key the app runs and explains that the student is taking a break.

## Checks

```sh
npm run typecheck
npm test        # set TEST_DATABASE_URL to a disposable database for integration tests
npx eslint
npm run build
```

Tests mock all paid providers. Setup, deployment and history details: [docs/engineering-notes.md](docs/engineering-notes.md).
