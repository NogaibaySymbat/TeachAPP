# TeachAPP agent handoff

Read `AGENTS.md` and `TEAM_HANDOFF.md` first, then the relevant code and README sections. This file is a short entry point for Claude Code, not a replacement for the user's task.

## Current product decisions

- TeachAPP is a web study workspace: the human teaches an AI student, and the student takes a practice exam using its notebook.
- The live UI has no login. Preserve browser-owned history and existing anonymous storage keys. `/login` and `/auth/callback` redirect home; production demo auth is disabled.
- Old account code and data remain for compatibility. Do not restore account UI from historical plans or expose legacy account data to guests.
- Browser microphone input exists. Spoken bot replies, TTS, and realtime voice conversations are NOT implemented. No new voice provider has been selected. A teammate owns the voice assistant; do not modify it without coordination.
- The content contains four topics and twelve original questions (stakeholders, risks, change control, Scrum), not a complete or official PMP exam. Latest/previous attempt comparison and owner-only TXT/JSON exports are implemented. Exports include historical snapshots; they cannot be imported to restore access.

## Engineering constraints

- Follow `AGENTS.md`: read the relevant installed Next.js documentation before changing code.
- Inspect the working tree first and preserve other contributors' changes. The repository owner performs Git commits and pushes; do not perform them automatically.
- Keep OpenAI calls in `src/ai/client.ts`. The currently allowed model is `gpt-6-luna`; do not change it without updating and validating pricing and budget accounting.
- Preserve the shared $4 application cap and durable `ai_usage` reservations. Never reset the ledger, reimport old production data, or enable a second independent local $4 allowance. Existing local AI is disabled with budget 0 after cloud cutover.
- Do not run paid live experiments as routine tests. Mocked tests do not need real provider calls. Use a separate disposable database for integration tests, never production.
- Keep ownership checks, same-origin JSON validation, cached completed requests, concurrency guards, and verified database TLS.
- Keep secrets server-side. Never print or commit `.env.local`, `.data/` credentials, browser access UUIDs, or cloud CLI tokens. Do not overwrite local configuration by pulling cloud env into it.
- Content belongs in `content/exams`; contracts in `src/lib/types.ts`; schema in `db/schema.sql`. Coordinate contract/schema changes and update documentation.
- Notebook entries must quote user messages. The examinee receives public questions and notebook entries, not answer keys or the conversation. Grading and debrief are deterministic.
- Existing citation-ID validation does not prove semantic entailment. Do not claim perfect notebook-only grounding; see the experiment and limitations in `TEAM_HANDOFF.md`.
- Use English for new product copy, code comments, and prompts unless the user requests otherwise. Team handoff documentation may be Russian.

## Verification and documentation

Use `npm run typecheck`, relevant tests, lint, and build as appropriate to the change. Full integration coverage requires `TEST_DATABASE_URL`; without it, some tests are skipped. Do not report skipped tests as verified or scoped lint as full lint.

The handoff records a 275-test run for the 15 November comparison/content/export extension; these are not fresh results for your changes. Report what you actually ran and any unresolved limitation.

`PROJECT_CONTEXT.md` includes a historical hackathon plan below its implementation summary. Its old login, streaming, automatic retry, and voice-exclusion descriptions are not the current implementation. Follow the latest explicit user direction and current handoff; do not silently implement historical roadmap items.
