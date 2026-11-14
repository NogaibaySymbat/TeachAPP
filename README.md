# TODO: product name

Prepare for the PMP exam by teaching an AI student. The student then takes
PMP-style questions using only what you taught it. Its score shows whether
you are ready on that topic.

Live: TODO link

## How it works

1. Pick a topic.
2. Explain it to the student in chat.
3. See the student's notebook: everything it learned from you.
4. The student takes 3-5 situational questions using only the notebook.
5. Debrief: which ideas were missing. Re-explain and retake.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Structure

- `content/`  exam content (topics, questions). No code. A new exam is a new folder.
- `prompts/`  prompts for each AI module.
- `src/ai/`   AI modules: student, notebook, examinee, debrief, planner.
- `src/server/`  database access, content loading, grading.
- `src/app/api/` HTTP routes (thin wrappers).
- `src/app/`, `src/components/`  UI.
- `src/lib/types.ts`  shared API contract.
- `db/schema.sql`  database tables.
- `tests/`  honesty test and grading test.

## Why the notebook

The model already knows PMP. During the exam the student receives only the
notebook, not the chat, and must tie every answer to a notebook entry.
Answers without a reference count as guessed and are marked wrong.
Correctness is checked by code against the answer key, not by the model.
