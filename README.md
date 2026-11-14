# TeachAPP

Team and agent handoff: [TEAM_HANDOFF.md](TEAM_HANDOFF.md) (Russian). Claude Code entry point: [CLAUDE.md](CLAUDE.md). The handoff distinguishes the current release from historical plans and verification records below.

A study workspace where people prepare by explaining topics to an AI student. The student will use only their notebook when taking practice questions.

**Current scope:** frontend and backend, browser-owned history without login, browser voice input, and the explain → notebook → student exam → debrief cycle. OpenAI powers student replies, notebook extraction, and exam answers with a persistent spending guard. Grading and the debrief use code and authored content. The practice package has four topics and twelve original questions; it is not an official PMP test. No generated replies or results are simulated.

Production URL: **https://teachapp.vercel.app**. The current interface has no sign-in screen: history, student replies, notebook extraction, exam, and debrief use the browser identity. OpenAI `gpt-6-luna` is active under the shared $4 cap. Browser checks and the production ledger/cache verification passed.

## Run locally

Requirements: Node.js 24.x and PostgreSQL 15+.

For local development:

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://localhost:3000. Setup prepares an ignored `.env.local` and starts an isolated PostgreSQL database at port 55433. Choose a topic and begin; no account is needed. Database files stay in ignored `.data/postgres`; `npm run db:local` restarts it and reapplies additive migrations after a reboot. Existing `.env.local` files are preserved. The existing local AI budget remains zero after cloud cutover; use the deployed site for paid AI.

To use your own PostgreSQL database instead:

```sh
npm ci
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to your Postgres connection string. Apply the schema using your database SQL editor or:

```sh
psql 'YOUR_POSTGRES_CONNECTION_STRING' -v ON_ERROR_STOP=1 -f db/schema.sql
npm run dev
```

Open http://localhost:3000. Without a database, the app still opens; persistence endpoints return an error. The package covers stakeholders, project risks, change control and Scrum delivery, with three original questions per topic. It is a small practice package, not a complete PMP course or official exam.

## OpenAI student replies

Add your key to the ignored `.env.local` file, never to a client-side variable or Git:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-6-luna
OPENAI_BUDGET_USD=4
```

After the cloud cutover, the existing local `.env.local` deliberately has `OPENAI_BUDGET_USD=0`, and the local development server is stopped. Keep local AI disabled while it points to the old local database. Enable paid calls on another instance only after it uses the same cloud `ai_usage` ledger; the example above is not a second independent $4 allowance.

Reapply the additive database schema with `npm run db:local` (or your database SQL editor), then restart `npm run dev`. Open **Project stakeholders · Demo** and send an explanation. The student asks a short follow-up in the language you use. Guests can save explanations, read their own history, and use AI within the shared budget. A missing key leaves saving available and shows that replies are unavailable.

The server uses the Responses API with `reasoning.effort: none` and at most 6,000 counted input tokens. Student replies allow 256 output tokens; structured notebook/exam requests have their own bounded output allowances, and the provider enforces a hard ceiling of 1,536. Chat considers the latest 12 messages within a 12,000-character cap; a new explanation is limited to 4,000 characters. No tools, automatic retries, or more expensive fallback models are enabled. The key is used only by `src/ai/client.ts`. Legacy `LLM_API_KEY` / `LLM_MODEL` settings are accepted, but the `OPENAI_` names take precedence.

The default app-wide budget is **$4 across all users and server restarts**, leaving a margin against a $5 starting balance. `OPENAI_BUDGET_USD` may be lowered to 0–4; 0 stops new AI requests. The configured model is restricted to `gpt-6-luna` so changing a model name cannot bypass the price calculation. Published Standard rates checked on 14 November 2026 are $0.10 per million input tokens and $0.50 per million output tokens. See [the model](https://developers.openai.com/api/docs/models/gpt-6-luna) and [current prices](https://developers.openai.com/api/docs/pricing).

Before each generation, the server counts the exact input, including any structured-output schema, then atomically reserves a conservative allowance in PostgreSQL: input at the highest listed cache-write rate ($0.25/M), plus the request's maximum output tokens at $0.50/M. That allowance stays consumed even if the answer is shorter or a network request fails. This deliberately overestimates usage. Parallel requests cannot reserve the same remaining budget; deleting a conversation does not reset it. Reservations are in `ai_usage`, and reported token counts are saved when available. Do not clear that table to restart the server. This is a local guard based on the documented rates, not a reading of your OpenAI balance: other applications, price changes, taxes, and account-specific charges are outside it. Check actual usage in the OpenAI dashboard.

Explanations are saved before generation. If a reply fails, use **Try student reply again**; it retries the response to the saved explanation. A completed reply is reused, so refreshing or repeating its request does not buy another answer. Active jobs reject simultaneous requests, and accounts have a short cooldown. `store: false` is sent to OpenAI; this does not itself guarantee zero data retention.

## Notebook, student exam, and debrief

After a user sends an explanation, the interface requests a student reply and updates the notebook. **Update notebook** also lets you process saved explanations or retry a failed extraction. Each note is a verbatim excerpt from a user message with a source link; the model cannot save invented text or cite the student's own replies. Empty explanations produce an empty notebook without a model request. The notebook preserves what was taught, including mistakes; it does not silently correct the user.

The notebook panel separates **How I see it** (the student's latest reply, with a brief restatement and clarification question) from **What I wrote down** (saved, exact quotes). The restatement is not a correctness or understanding score. Notes added during the current visit are marked **New** and briefly highlighted; comparison uses quote + source, not regenerated database IDs. Removed notes are counted too. **Clarify** brings a note beside the composer without changing a draft or sending anything; re-explain it in your own words. **View notebook** jumps directly to the panel on small screens. These views reuse the existing reply and notebook requests; they add no model calls. Reopening a session does not mark all notes as new.

Select **Start student exam** when the notebook is up to date. All questions are answered in one bounded structured request. The examinee receives only the notebook and public question/option text; answer keys, key ideas, and the conversation are excluded. Code compares the choices with the stored answer keys. Guesses, absent answers, and answers without valid notebook citations score zero. An empty notebook produces zero without asking the model to guess.

The result shows each question, the student's choice, reasoning, cited notebook statements, and the expected answer. The debrief points to the authored ideas associated with failed questions and does not spend extra OpenAI tokens. A perfect score marks this practice topic as passed; this is an app rule, not a real PMP passing threshold or prediction. Add another explanation, update the notebook, and retake the practice set to check improvement.

Notebook and exam requests are cached by the saved explanations' revision. Reopening a session or retrying a completed request reuses its result. New explanations make the notebook and previous result visibly out of date. Short durable claims prevent concurrent duplicate work; a late response cannot overwrite a newer revision. Attempts retain notebook/question snapshots so their evidence remains readable after the notebook changes. Failed requests preserve the conversation and previous result. No paid generation is triggered by a GET request or merely opening the page.

## Voice input

In a teaching session, choose **Русский** or **English** under **Spoken language**, then select **Use microphone**. Allow microphone access in the browser and speak. Select **Stop dictation**, review the preview, and choose **Add to explanation**. The text is appended to your existing draft, which you can edit before sending. Nothing is submitted automatically. **Discard dictation** removes only the new dictated text.

This uses the browser's Web Speech API, so transcription does not use your OpenAI key or budget. Support depends on the browser, device, language, and network; the UI checks for an available recognizer and keeps typing available if it is missing. Use HTTPS on a deployed site or localhost in development. A supported API does not guarantee the browser's speech service is reachable. See [MDN's speech-recognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Your browser may send audio to its own recognition service. TeachAPP does not upload or store audio: only the explanation you explicitly send is saved and, when configured, passed to the AI student. Dictation stops after one minute, at the remaining 4,000-character draft limit, when the page is hidden, or when you leave the session. Permission errors, a missing microphone, network failure, and no speech have clear recovery messages. Automated tests use a fake recognizer and do not access a real microphone; recognition quality and device permissions must be checked manually.

## Topic of the day

`GET /api/progress` returns `topicOfTheDay` from `pickTopicOfTheDay` in `src/ai/planner.ts`, with no model call: a failed topic first (lowest best score, then exam order), otherwise the first topic not taught yet, otherwise a review topic that rotates once per UTC day. The home page shows it in the progress panel with a **Start this topic** action, and the topic picker opens on it until the user chooses another topic.

## Pricing preview

`/pricing` shows the planned plans: Free (3 teach-and-exam cycles, browser voice), Exam Pass ($59 for 90 days) and Monthly ($19). It is linked from the header. Payments are not connected: paid actions are disabled and say so, and no feature is limited by plan. The comparison uses typical 2026 PMP prep prices (courses $250–4,000, study apps about $9–30 per month).

## Student voice

The AI student can read its replies aloud. Turn it on with **Student voice** above the chat; each reply also has a **Listen** button. The setting is remembered per browser and is off by default.

- **Cloud voice.** `POST /api/sessions/:id/messages/:messageId/speech` reads only a stored student reply owned by the caller, never arbitrary text, and returns MP3.
  - `DEEPGRAM_API_KEY` (preferred): Deepgram Aura-2, English replies only. Paid from Deepgram's sign-up credit, which needs no card.
  - `GOOGLE_TTS_API_KEY`: Google Cloud Text-to-Speech, Chirp 3: HD, English and Russian. Google bills automatically beyond its free tier, so keep that account on the Free Trial and restrict the key.
- **Browser voice.** Used with no key, for replies the cloud voice does not support (Russian with Deepgram), on any provider error, and after the cap. It picks the most natural installed voice: Edge "Natural" voices, macOS Premium or Enhanced voices, then Chrome's Google voices; macOS novelty voices are never used.
- **Limits.** Characters are reserved per provider in the durable `tts_usage` table before each call and are never released. Monthly caps (UTC months): Deepgram 1,000,000 by default, at most 3,000,000; Google 900,000 by default, at most 1,000,000. `TTS_MONTHLY_CHARACTER_CAP` can only lower them. One reply can be synthesized at most three times; the browser keeps audio for repeat plays on the same page. No automatic retries.
- The OpenAI `ai_usage` ledger and its $4 cap are unchanged and do not cover text-to-speech.
- Some browsers block audio that does not follow a click, so an automatic reading may stay silent; **Listen** still works.

## History without login

The guest release passed **263 tests** using an isolated PostgreSQL database, TypeScript checks, scoped ESLint, and the Vercel build. Production deployment `dpl_B3BgHY8JKdpZtRU7X3qqBs2r9zM7` verifies guest history reopening, live reply/notebook/exam (3/3), cached IDs, and 404 isolation for another browser. `/login` redirects home and the shared admin login is disabled. Existing records and `ai_usage` were not migrated or reset. Chrome verification also confirmed that login controls are absent and a new browser-owned lesson remains in history after opening the site in a fresh tab, despite the old demo cookie.

The site opens directly into the workspace. Email, Google, and admin login controls are removed; `/login` and `/auth/callback` redirect home. Each browser keeps a random UUID in localStorage and sends it as `x-anonymous-id`. History loads in pages of 20 from PostgreSQL; messages, notebooks, results, and progress survive reloads and returning to the same browser.

Clearing site data, switching browser/device, or ending a private-browsing session loses access to that browser's history. This is bearer-ID access, not a personal account or cross-device backup; do not share the browser ID. The UI states this next to history.

Normal frontend requests explicitly omit cookies and authorization headers. An old shared-demo cookie or Supabase session cannot silently select the shared account. Existing guest IDs remain valid unless previously retired by an account import; retired IDs are replaced with a fresh browser ID. Legacy account records and imported data remain in the database; they are not exposed or copied into every visitor's guest history. Legacy account APIs remain in source for compatibility, but there is no account-entry UI; production demo login is disabled.

All learning writes require same-origin JSON and owner checks. New reply claims have a three-second browser/owner cooldown. Notebook and exam claims now enforce a three-second cooldown per owner and operation across all their sessions, under a database row lock. Cached completed results bypass this cooldown and do not spend again. Changing browser IDs can bypass a per-browser limit; the durable **global $4 OpenAI guard** still bounds this app's generation spending. No ledger reset or schema/data migration is required for this change.

All app tables retain RLS with no browser data policies. The server connects with its existing database role; the browser reads history only through owner-checked API routes. Supabase is still the cloud PostgreSQL host; Auth/SMTP/Google configuration is unnecessary for the current guest workflow.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Optional repository integration tests use a separate disposable database:

```sh
TEST_DATABASE_URL='YOUR_TEST_POSTGRES_CONNECTION_STRING' npm test
```

The integration suite applies the schema and removes only its own test users and budget records. It is skipped when `TEST_DATABASE_URL` is absent. Provider tests mock HTTP and do not spend API credits; a live smoke test requires a configured key.

## History sidebar and conversation layout — 15 November 2026

Published at https://teachapp.vercel.app as `dpl_2bopWWkw2iwWTejVfdKMHN1MjNjY` on 15 November 2026. No Git commit or push was made.

History opens from the panel button beside TeachAPP on every study page. Desktop uses an adjacent sidebar; narrow screens use a native modal drawer with close controls and focus management. The active session is highlighted, and history refreshes after creating a lesson, saving an explanation, or completing an exam. Existing browser ownership and storage keys are unchanged.

The home page uses a styled topic disclosure with status labels, best scores, and a checkmark for the selected topic. Choosing a topic updates its description and closes the menu. The native disclosure supports keyboard activation; Escape closes it and restores focus. The conversation distinguishes right-aligned user messages from left-aligned AI student replies, shows timestamps and waiting status, and groups writing controls in a composer. Enter sends; Shift+Enter inserts a newline; IME composition does not submit. VoiceInput and the backend are unchanged.

Verification: all 275 tests passed with isolated PostgreSQL; TypeScript, scoped ESLint and production build passed. Safari verified topic selection, session creation, sidebar refresh, active selection, and narrow drawer navigation. Native automation could not reliably focus the textarea, so keyboard submission still needs a direct manual check. Narrow verification used desktop zoom rather than a physical phone.

## Comparison, practice topics and export — 15 November 2026

Published at https://teachapp.vercel.app as `dpl_8UpBQBQwzu3dTHA4BUNbqcJBZbra`. Public production checks confirmed four topics, export of an existing saved attempt, and HTTP 404 for another browser. These checks made no model calls; no data or `ai_usage` migration/reset was performed.

The review compares the latest two saved attempts in the same session: score change, newly correct and regressed answers, and new notebook notes cited in improved answers. Comparisons use immutable snapshots; a changed question, option or answer key disables the score delta. A first attempt shows guidance to explain more and retry. Cited notes do not prove what caused an improvement.

The package now contains four topics and twelve original questions: project stakeholders, project risks, change control and Scrum delivery. See `content/exams/pmp/README.md` for scope and reference sources.

**Download this session** saves TXT for reading or JSON for reuse. Downloads include saved messages, the current notebook and every saved attempt, including available legacy results. Unsaved drafts are excluded. Downloads do not restore browser access; importing a file is not implemented. The owner-checked export omits the browser access ID and unattempted answer keys.

Verification: **275 tests in 24 files passed** with isolated PostgreSQL, plus TypeScript/build and scoped ESLint. Safari downloads were checked as real TXT and JSON files, including both saved attempt scores. Desktop comparison and export were visually checked with labelled local fixtures; narrow layout reflow was also checked using Safari at 200% zoom. A physical-phone check remains outstanding. No paid model calls were made for these checks. No schema, environment, voice or spending-guard changes are required; comparison and export spend no OpenAI tokens.

## Architecture and ownership

| Location | Responsibility |
| --- | --- |
| `src/app/page.tsx`, `src/app/session/[id]`, `src/app/login`, `src/components` | Frontend: topics, browser history, teaching session, notebook, exam comparison and session export; legacy login routes redirect home |
| `src/app/api` | Backend: thin route handlers, request validation and verified account/guest identity |
| `src/server/auth.ts`, `src/server/demo-auth.ts`, `src/lib/auth-client.ts` | Supabase verification and browser session; signed demo cookie support |
| `src/components/auth-provider.tsx` | Shared verified account state for the header and history |
| `src/server` | Backend: Postgres, repositories, content loading and deterministic grading |
| `src/ai`, `prompts` | OpenAI client, student conversation, grounded notebook extraction, notebook-only examinee, and deterministic debrief |
| `src/lib/types.ts` | Shared API and content contracts |
| `src/lib/anon-id.ts` | Browser-generated anonymous UUID in localStorage |
| `content/exams` | Exam packages; engine code contains no exam-specific facts |
| `db/schema.sql` | Database schema |
| `tests` | Scoring, auth verification, account isolation, history transfer and callback safeguards |
| `PROJECT_CONTEXT.md` | Team context and the full target MVP |

`src/ai/client.ts` is the single provider-call boundary. Notebook and examinee outputs use strict JSON schemas, then application-level source/ID validation. Debriefs are deterministic. The provider uses native server-side `fetch`; no model SDK is required.

## API available in this phase

Browser session and history requests require `x-anonymous-id: <UUID>`. Email and Google accounts use `Authorization: Bearer <access token>`; the demo endpoint uses a server-issued cookie. `src/lib/api.ts` manages browser requests. An explicit bearer token takes precedence, and invalid credentials never fall back to guest access. The guest header is used separately for importing history into a verified Supabase account.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/topics` | Topic summaries joined with the current owner's progress; answer keys are never returned |
| GET | `/api/progress` | Actual UTC activity streak and saved gaps from the latest attempt per topic; `topicOfTheDay: null` |
| GET | `/api/sessions?offset=0` | Browser owner; `{ sessions, nextOffset }` with last activity and latest saved score |
| GET | `/api/auth/me` | `{ account, demoAvailable }`; verified current account or null |
| POST | `/api/auth/demo` | Demo sign-in; `{ username, password }` sets a session cookie when enabled |
| DELETE | `/api/auth/demo` | Clears the demo session cookie |
| POST | `/api/sessions` | `{ topicId }` → `{ sessionId, firstMessage: null }` |
| POST | `/api/auth/claim` | Requires verified Supabase account plus guest header; transfers guest history and retires the guest ID |
| GET | `/api/sessions/:id` | `{ session, topic, messages, notebook, learning, latestAttempt, previousAttempt, ai }` for the owner; learning reports revision/freshness and question count |
| GET | `/api/sessions/:id/export` | Owner-only versioned JSON attachment: saved messages, current notebook, all modern attempt snapshots and available legacy attempts; no generation |
| POST | `/api/sessions/:id/messages` | `{ text }` → `{ message }`; saves a user explanation without a student reply |
| POST | `/api/sessions/:id/reply` | Browser owner; `{ messageId }` → `{ message }` with a persisted student reply; completed requests reuse the reply |
| POST | `/api/sessions/:id/notebook` | Browser owner; `{}` → `{ notebook, learning }`; reuses a completed current revision |
| POST | `/api/sessions/:id/exam` | Browser owner, fresh notebook; `{}` → `{ attempt }` with score, question/answer review, notebook snapshot and gaps |
| GET / POST | `/api/sessions/:id/debrief` | Browser owner; saved `{ attemptId, gaps }`, optionally select an attempt by query/body `attemptId`; no generation |

Errors use `{ error: { code, message } }`. In this phase message submission returns JSON, not the student stream in the target MVP. These temporary differences are also recorded in `PROJECT_CONTEXT.md`.

Repositories persist sessions, messages, notebooks, attempts and their snapshots, progress, generation jobs, and AI budget reservations.

## Content handoff

Each exam's `exam.json` declares `id`, `title`, `description` and a list of topic IDs. Add topics to that list and create matching `topics/<topicId>.json` and `questions/<topicId>.json` files. Topic IDs must be globally unique. Content shapes are defined in `src/lib/types.ts` and validated in `src/server/content.ts`.

The `_example.json` files are templates only and are not listed in the exam manifest. Copy them to matching topic filenames and replace every TODO before adding a topic. Question files contain an array with `correctAnswer` and `requiredIdeaIds`; topics use `description` and a string array of `misconceptions`.

The demonstration questions are original, clearly labelled practice material. Content sources and scope are recorded alongside the package. The loader reads exam packages from disk, so new packages do not require engine changes.

## Verification boundary

Grading checks the answer key and requires existing notebook references. Empty notebooks, missing references, and declared guesses cannot score. Notebook claims must be exact excerpts from actual user messages. These deterministic checks prevent invented sources; semantic relevance and whether a citation really entails an answer still depend on model behavior. Unit tests mock the provider; any live smoke-test result is a small sample, not a guarantee for every explanation or prompt injection.

Checked locally on 14 November 2026: 245 tests passed with the isolated PostgreSQL test database; typecheck, production build, and ESLint for the new learning modules passed. A real-provider check produced no notes and 0/3 for nonsense, then three source-verified notes and 3/3 for a complete explanation. Empty teaching and cached repeats made no generation calls. Three live generation calls reserved $0.001869 under the app guard; this is a conservative reservation, not the provider's billed amount. The full ESLint run still reports six pre-existing hook errors in account/data-loading components. Production was also checked in Chrome: `admin / admin` sign-in, dashboard history containing imported and new sessions, and the new session's AI reply, three sourced notebook entries, and 3/3 exam rendered successfully.

Live notebook-grounding experiment on 14 November 2026: **12 of 13 fresh-session trials matched predefined expectations**. Unrelated teaching produced an empty notebook; nonempty but insufficient notes yielded abstentions; teaching only one idea yielded 1/3; complete teaching yielded 3/3. Wrong teaching was reproduced twice, but one trial abstained instead. No answers to untaught questions were observed in this sample. Ten trials called the examinee model; three empty-notebook trials used the deterministic guard. This is an application-level observation after validation, not proof that the model never uses prior knowledge. See the [full experiment report and raw results](reports/notebook-grounding/2026-11-14T15-17-34.760Z/REPORT.md). `node scripts/eval-notebook-grounding.mjs` previews the protocol; adding `--live` creates new demo sessions and makes budgeted paid calls.

## Deployment

Hosting: **Vercel for the Next.js app + Supabase for managed PostgreSQL**. Cloud hosting runs independently of the developer's laptop. The app uses Node.js routes, a 60-second limit for AI endpoints, a small connection pool, and traced content/prompt files. It cannot run as a static GitHub Pages export because auth, persistence, and AI calls need a server.

Initial cloud release verification — 14 November 2026 (before guest-only interface): the Vercel project **teachapp** in **BusinessCup** is running at https://teachapp.vercel.app, deployment `dpl_CC4HrfwWqXt1aWZfcy4HNk11H5iW`. Supabase project **TeachAPP** is in **Singapore**. The public page returns HTTP 200. Eight production API checks returned HTTP 200: demo sign-in restores the same account, history contains the imported session, and its three notebook entries, 3/3 exam result, and saved debrief are readable. Repeated notebook/exam requests returned the same saved result IDs while paid AI was disabled. After enabling the production $4 cap, all three live AI operations returned HTTP 200: student reply, three exact-source notebook notes, and a 3/3 exam. The saved debrief also returned HTTP 200. Chrome verification confirmed sign-in, both imported and new history, and the live session's reply/notebook/exam display.

The three production AI calls added **$0.001468** in conservative reservations. The cloud ledger then contained **7 reservations totalling 3,532,750 nanodollars ($0.00353275)**, with `budget_blocked=false`. Repeating reply, notebook, and exam returned the same saved IDs; a subsequent SQL check confirmed exactly the same count, total, and blocked status. Cached repeats added no reservations. These amounts are the app's conservative guard values, not OpenAI's billed usage.

The final local snapshot was transferred to Supabase in a verified transaction: **39 records across 10 application tables**, with matching full-row fingerprints and counts. Row-level security is enabled on all 10 tables. The transfer includes sessions, messages, notebooks, attempts, answers, progress, generation jobs, and all **4 `ai_usage` reservations totalling $0.00206475**, with no budget block. This is the conservative reserved amount, not an OpenAI billing statement. Guest records retain their original ownership; changing the browser origin does not transfer its local anonymous ID into the shared demo account.

The local `OPENAI_BUDGET_USD` remains **0**, and the local app server is stopped. Production `OPENAI_BUDGET_USD=4` and `OPENAI_MODEL=gpt-6-luna` are active; the original reservations remain part of that shared allowance. Live generation and unchanged `ai_usage` on cached repeats are verified. Keep the local instance paused until it uses that same cloud ledger. Backups and migration verification artifacts are retained under ignored `.data/`; do not rerun the initial import against this populated database.

The production database configuration uses the transaction pooler with `sslmode=verify-full` and `DATABASE_SSL_CA`. The PEM was downloaded through Supabase Database Settings from its [official certificate download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). It is supplied as a multiline server environment value, with an operational copy in ignored `.data/cloud/supabase-ca.pem`. The driver adds this certificate to Node's default CA set, requires certificate and hostname verification, and removes URL SSL parameters that could overwrite the explicit verified configuration. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).

The following steps document setup and future cutovers; the schema and initial data transfer above have already been completed. **The repository owner performs all Git commits and pushes.**

1. Sign in to Vercel and Supabase. Create or select a dedicated TeachAPP Supabase project and a Vercel project for this directory. Inspect any existing database before applying the app schema. Use the Next.js framework preset, `npm ci` for installation, and `npm run build` for the build; leave the output directory at its framework default.
2. Obtain the Supabase **transaction pooler** connection string from **Connect** for the server's `DATABASE_URL`. Use the correct database password and TLS settings; never disable certificate verification to work around a connection error. The server role must own the application tables or have BYPASSRLS. The current `pg` code has no named prepared statements or session-level locks. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. Apply `db/schema.sql` to the dedicated cloud database through its SQL editor or an authenticated database connection. This additive schema creates tables, constraints and RLS; **it does not transfer local history or the spending ledger**.
4. Before enabling cloud AI, stop new local generation, let current requests finish, and transfer the saved application data **including `ai_usage`**. Verify its reservation sum and blocked status after transfer. Every running instance using this API budget must then use that same durable database. A fresh database with the same key and a fresh $4 allowance would reset the guard. If intentionally starting with no history, the existing spending reservations must still be preserved, or the cloud allowance must be reduced by those reservations and local AI kept disabled.
5. Add the following settings to the intended Vercel environment **before building**. Keep secrets in its environment settings, not Git or browser code.

| Setting | Cloud value |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL transaction-pooler URI with the provider's TLS settings |
| `DATABASE_SSL_CA` | Supabase CA certificate in PEM format, with real newlines; augments Node's default trust store while retaining certificate and hostname verification |
| `OPENAI_API_KEY` | Existing server-side OpenAI key |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `OPENAI_BUDGET_USD` | Production `4`, active against the migrated shared ledger. Local remains `0` |
| `DEMO_AUTH_ENABLED` | `false` for the current login-free workspace; legacy demo API disabled |
| `AUTH_SECRET` | A separately generated strong server secret of at least 32 characters |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL; needed for Email/Google |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; needed for Email/Google, never a secret/service-role key |

The current guest workspace needs no public Supabase Auth settings. Existing Auth settings may remain for legacy compatibility. Never copy the local loopback `DATABASE_URL` into Vercel. Preview deployments should have a separate test database and no paid AI key until their budget has been deliberately configured.

6. Deploy the local working directory through the Vercel CLI, or use Git integration **after the repository owner commits and pushes their changes**. CLI deployment does not require this agent to make a commit or push. `.vercelignore` excludes `.env.local`, the local PostgreSQL data, and generated files from CLI uploads. After installing/signing in to the official CLI and setting the environment, the commands are:

```sh
npx vercel link
npx vercel deploy --prod
```

Follow the [official CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli). Do not run `vercel env pull .env.local` over the existing local configuration; use a separate ignored file if downloading cloud settings.

7. Keep `DEMO_AUTH_ENABLED=false`. No login provider or SMTP is required for browser history. Preserve the existing database and shared spending ledger.
8. Verify the deployed HTTPS URL: without signing in, save and reopen a session, build a notebook, run the practice exam, and confirm cached repeats do not create new `ai_usage` reservations. Check that the production page is accessible to the intended demo audience, then record the verified runtime status in this README.

Free plans have provider limits and are not an uptime guarantee: for example, [Supabase Free pauses projects after one week of inactivity](https://supabase.com/pricing). Review the chosen hosting plan before the presentation. No paid plan or domain has been purchased by this setup.

### Workspace palette refresh — 15 November 2026

The home page, history, topic chooser, chat, notebook and exam review now use the supplied Pearl / Harbor / Midnight / Santorini / Sea Green palette. Manrope is self-hosted with its OFL license in `public/fonts/`. Conversation behavior, browser ownership, voice integrations and the shared OpenAI budget are unchanged. Desktop Safari and a narrow layout via browser zoom were checked; physical phone testing remains outstanding. All 294 existing tests passed against isolated local PostgreSQL. See `DESIGN.md` for the current visual system.
