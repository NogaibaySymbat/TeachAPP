# TeachAPP

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

A study workspace for exam preparation by explaining topics to an AI student. The intended student uses only the notebook built from the user's explanations when answering practice questions. The first content package is PMP.

## Capabilities and Constraints

- Current implementation covers the frontend, backend, PostgreSQL persistence, account identity, saved session history, OpenAI student chat, automatic notebook extraction, a notebook-only student practice exam, deterministic grading, and a debrief. The user authorized the complete learning cycle while retaining a small shared API budget.
- The latest user decision removes login controls. Users immediately start lessons and reopen their own browser's history, notebook, and results. `/login` and `/auth/callback` redirect to the workspace.
- A persistent random browser ID selects owner-scoped PostgreSQL data. Clearing browser data or changing devices loses access; the interface explains this. The client omits old cookies/bearer tokens, so the shared demo account is not silently reused. Existing account data stays stored separately.
- Student replies require an owner identity, an OpenAI key, and remaining app budget. GPT-6 Luna uses short replies and a persistent conservative $4 allowance shared by all users. Three-second per-owner operation cooldowns and cached results limit repeat work. Errors preserve explanations and offer an explicit retry.
- The practice package includes four topics and twelve original questions: stakeholders, project risks, change control and Scrum delivery. It is not an official PMP exam or a prediction of real exam readiness. A perfect practice score marks the topic as passed in this app.
- Notebook entries quote the user's own messages and retain source links. The examinee sees only notebook entries and public questions/options; code grades against answer keys, rejecting guesses and missing citations. Debriefs map incorrect answers to authored key ideas without another model call. Semantic relevance remains model-dependent.
- Learning operations reuse completed results for the same explanation revision, reject stale concurrent work, and preserve prior results on failure. Attempts retain notebook/question snapshots for review. The app is deployed at https://teachapp.vercel.app.
- The session composer offers browser speech-to-text in Russian or English after an explicit microphone click. Users stop, review, and add the dictated text to their draft before sending. Typed text remains intact, and unsupported browsers retain text entry. Browser recognition may process audio online; TeachAPP stores no audio and makes no OpenAI transcription call. One-minute capture and text limits, permission/error states, and cleanup on navigation are included.

- The review compares the latest two saved attempts, including regressions and cited new notes. Changed question snapshots disable the delta; citations do not prove causality. Owner-only TXT/JSON downloads include saved messages, notebook and all available attempts. No import or cross-device access restoration is implemented. These features make no model calls.

- History is a collapsible left sidebar, becoming a modal navigation drawer at narrow widths. Topics are visible cards with statuses; one start button begins the selected topic. User and student messages have distinct alignment and timestamps; writing controls are grouped as a chat composer. The workspace uses the user-supplied Pearl, Harbor, Midnight, Santorini and Sea Green palette with self-hosted Manrope. Existing voice input remains.

## Brand Commitments

The product name is TeachAPP. The earlier TikTok-inspired account-entry surface is retired from the current navigation. The study workspace follows the user-supplied five-swatch reference: Pearl #F6F2EF, Harbor #B0C8CC, Midnight #363E4F, Santorini #D9DFE3 and Sea Green #8EA39D, with rounded surfaces and Manrope typography. Browser history and direct access are the current flow.

## Evidence on Hand

README.md records current setup and limitations. PROJECT_CONTEXT.md describes the team's broader target MVP; proposed AI workflows there are not evidence of implemented functionality. The login surface brief records a historical design, not the current flow. Browser captures are in `.impeccable/review/`.
