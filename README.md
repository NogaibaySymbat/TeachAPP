# TeachAPP

A study workspace where people prepare by explaining topics to an AI student. The student will use only their notebook when taking practice questions.

**Current scope:** frontend and backend foundation, email-link and Google sign-in, and account-only session history. The login screen offers only Email and Google. AI modules, prompts, topic content, student replies, notebook generation, exams, debriefs, and recommendations are not implemented. No generated responses or results are simulated.

Production URL: **not deployed yet**.

## Run locally

Requirements: Node.js 22.12+ and PostgreSQL 15+.

For local development:

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://localhost:3000. Setup prepares an ignored `.env.local` and starts an isolated PostgreSQL database at port 55433; it does not configure sign-in providers. Database files stay in ignored `.data/postgres`; `npm run db:local` restarts it and reapplies additive migrations after a reboot. Existing `.env.local` files are preserved. Configure Supabase below to use Email or Google on http://localhost:3000/login.

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

Open http://localhost:3000. Without a database, the app still opens; persistence endpoints return an error. The initial topic list is intentionally empty until the content team supplies topics.

## Sign-in and saved history

The login page offers **Email** and **Google**. Email opens a second step for requesting a sign-in link; Google starts OAuth through Supabase. Guests can start a session, but viewing the history list requires an account; the API enforces this as well. History loads in pages of 20.

Successful Email or Google sign-in attaches the browser's guest sessions and progress to the verified personal account. Signing in to the same account on another device restores its history.

The old demo login endpoint remains only for internal testing, has no UI, and is disabled by default (`DEMO_AUTH_ENABLED=false`). Explicitly enabling it also requires an `AUTH_SECRET` of at least 32 characters. Its shared account has no administration privileges, uses an eight-hour signed HttpOnly cookie, and never imports personal guest history.

Configure the shared Supabase connection:

1. Create or use a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Use the project's publishable key (or legacy anon key), never a secret/service-role key. The Postgres database may be in the same project or separate.
3. Set the Supabase Site URL and allow the exact app callback URLs: `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback` for local development, and your deployed HTTPS `/auth/callback` URL for production.
4. Reapply `db/schema.sql` for the additive account migration, then restart the dev server. Public environment values must be present before a production build.

For **Email**, enable Supabase's Email provider and configure custom SMTP for delivery to real users. The default Magic Link email template works with this browser callback. Supabase's built-in sender is restricted to project-team recipients; follow the [official SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

For **Google**:

1. In Google Auth Platform, configure the app's audience and consent screen, then create an OAuth client of type **Web application**.
2. Add the app origin under **Authorized JavaScript origins**, such as `http://localhost:3000` during development and your production HTTPS origin.
3. Under **Authorized redirect URIs**, enter the **Supabase callback URL shown in its Google provider settings**. This is different from the app's `/auth/callback` allowlist entry above.
4. Enable Google in Supabase Auth and enter the Google Client ID and Client Secret there. These credentials belong in Supabase's provider configuration, not in this app's public environment variables.
5. Configure only the sign-in scopes `openid`, `userinfo.email`, and `userinfo.profile`. The app requests no additional Google API permissions. Follow the [official Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), including audience/test-user restrictions while the OAuth app is in testing.

Without provider configuration, the login screen reports that sign-in is unavailable. Local tests do not send real emails or complete a real Google login.

The browser SDK stores and refreshes the auth session. API requests send its access token; the server verifies it with Supabase `getUser` before resolving an app account. Guest IDs cannot access account-owned or already-imported history. Failed verification never falls back to guest permissions. See [Supabase's verification reference](https://supabase.com/docs/reference/javascript/auth-getuser).

All app tables have row-level security enabled with no browser policies. Use a table-owner/BYPASSRLS database role for the server's `DATABASE_URL`; browser Supabase clients use Auth only, and cannot read app tables directly. Guest-to-account transfer preserves messages, notebooks, attempts, and progress. Failed transfers preserve the browser's pending guest identity so the user can retry.

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

The integration suite applies the schema and removes only users it creates. It is skipped when `TEST_DATABASE_URL` is absent.

## Architecture and ownership

| Location | Responsibility |
| --- | --- |
| `src/app/page.tsx`, `src/app/session/[id]`, `src/app/login`, `src/components` | Frontend: topics, history, Email/Google sign-in, teaching session, notebook and exam states |
| `src/app/api` | Backend: thin route handlers, request validation and verified account/guest identity |
| `src/server/auth.ts`, `src/server/demo-auth.ts`, `src/lib/auth-client.ts` | Supabase verification and browser session; legacy demo cookie support |
| `src/components/auth-provider.tsx` | Shared verified account state for the header and history |
| `src/server` | Backend: Postgres, repositories, content loading and deterministic grading |
| `src/ai`, `prompts` | Team-owned AI scaffold and prompt drafts; not connected to the app yet |
| `src/lib/types.ts` | Shared API and content contracts |
| `src/lib/anon-id.ts` | Browser-generated anonymous UUID in localStorage |
| `content/exams` | Exam packages; engine code contains no exam-specific facts |
| `db/schema.sql` | Database schema |
| `tests` | Scoring, auth verification, account isolation, history transfer and callback safeguards |
| `PROJECT_CONTEXT.md` | Team context and the full target MVP |

`src/ai` and `prompts` are deliberately left for the ML developer. No model SDK or API key is required for this phase.

## API available in this phase

Guest session requests require `x-anonymous-id: <UUID>`. Email and Google accounts use `Authorization: Bearer <access token>`; the legacy demo endpoint uses a server-issued cookie. `src/lib/api.ts` manages browser requests. An explicit bearer token takes precedence, and invalid credentials never fall back to guest access. The guest header is used separately for importing history into a verified Supabase account.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/topics` | Topic summaries joined with the current owner's progress; answer keys are never returned |
| GET | `/api/progress` | Actual UTC activity streak; `topicOfTheDay: null`, `gaps: []` until ML integration |
| GET | `/api/sessions?offset=0` | Requires sign-in; `{ sessions, nextOffset }` with last activity and latest saved score |
| GET | `/api/auth/me` | `{ account, demoAvailable }`; verified current account or null |
| POST | `/api/auth/demo` | Legacy internal endpoint, disabled by default; `{ username, password }` sets a demo session cookie when explicitly enabled |
| DELETE | `/api/auth/demo` | Clears any legacy demo session cookie |
| POST | `/api/sessions` | `{ topicId }` → `{ sessionId, firstMessage: null }` |
| POST | `/api/auth/claim` | Requires verified Supabase account plus guest header; transfers guest history and retires the guest ID |
| GET | `/api/sessions/:id` | `{ session, messages, notebook }` for the session owner |
| POST | `/api/sessions/:id/messages` | `{ text }` → `{ message }`; saves a user explanation without a student reply |
| POST | `/api/sessions/:id/notebook` | `501 AI_NOT_CONNECTED` for an owned session |
| POST | `/api/sessions/:id/exam` | `501 AI_NOT_CONNECTED` for an owned session |
| GET | `/api/sessions/:id/debrief` | `501 AI_NOT_CONNECTED` for an owned session |

Errors use `{ error: { code, message } }`. In this phase message submission returns JSON, not the student stream in the target MVP. These temporary differences are also recorded in `PROJECT_CONTEXT.md`.

Repositories persist sessions and messages and read notebooks, attempts, and topic progress. Attempt writes, progress updates after grading, and AI orchestration remain integration work.

## Content handoff

Each exam's `exam.json` declares `id`, `title`, `description` and a list of topic IDs. Add topics to that list and create matching `topics/<topicId>.json` and `questions/<topicId>.json` files. Topic IDs must be globally unique. Content shapes are defined in `src/lib/types.ts` and validated in `src/server/content.ts`.

The `_example.json` files are templates only and are not listed in the exam manifest. Copy them to matching topic filenames and replace every TODO before adding a topic. Question files contain an array with `correctAnswer` and `requiredIdeaIds`; topics use `description` and a string array of `misconceptions`.

No exam facts or practice questions have been invented for the scaffold. The loader reads exam packages from disk, so new packages do not require engine changes.

## Verification boundary

Grading checks the answer key and requires existing notebook references. The tests prove that empty notebooks, missing references, and declared guesses cannot score. They do **not** prove semantic grounding: the full empty-or-meaningless-explanation honesty test requires the ML pipeline, which is deferred.

## Deployment

Target: Vercel with managed Postgres. Add `DATABASE_URL` and both Supabase public environment values before building, apply `db/schema.sql`, configure production callbacks, Email SMTP and Google OAuth as described above, deploy this repository, and replace the production URL above. Keep legacy demo auth disabled. Content files are included in Next.js output tracing.
