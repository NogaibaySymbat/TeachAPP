# TeachAPP

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

A study workspace for exam preparation by explaining topics to an AI student. The intended student uses only the notebook built from the user's explanations when answering practice questions. The first content package is PMP.

## Capabilities and Constraints

- Current implementation covers the frontend, backend, PostgreSQL persistence, account identity, and saved session history. AI behavior and exam content remain deferred at the user's request.
- The user chose passwordless email links for personal accounts and subsequently requested a login screen with only Email and Google. Account creation happens during the first successful sign-in.
- The history list requires a verified account. Successful personal sign-in can attach the browser's guest sessions to that account.
- Email and Google use Supabase Auth. Live email delivery and Google OAuth require external provider configuration; the current local environment has no Supabase credentials. The UI reports unavailable sign-in without pretending it succeeded.
- The legacy shared demo login endpoint is retained for internal tests, disabled by default, and absent from the interface. It has no administrator privileges.
- No deployment, completed AI lesson, generated notebook, or exam outcome is claimed by the current implementation.

## Brand Commitments

The product name is TeachAPP, as confirmed by the user. The user supplied a TikTok login screenshot as the reference for the account-entry screen and explicitly requested only Email and Google. This scoped request does not replace the visual identity of the rest of the workspace.

## Evidence on Hand

README.md records current setup and limitations. PROJECT_CONTEXT.md describes the team's broader target MVP; proposed AI workflows there are not evidence of implemented functionality. The login surface brief records the user's current visual direction. Browser captures are in `.impeccable/review/`.
