---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/session/[id]/page.tsx","src/components/dashboard.tsx","src/components/app-shell.tsx","src/components/topic-choice.tsx","src/components/session-workspace.tsx","src/app/globals.css"]
---

# TeachAPP study workspace

Mode: Operate. Current scope (2026-11-15): restore Milo's expressive book avatar in the session header. The user pins the current live production design, matching `14be3d8`, as visual truth. Preserve its homepage, topic cards, history, chat and notebook structure, browser-owned data, all API behavior, voice controls and shared $4 budget. Earlier local redesigns are archived, not part of this restoration. No decorative raster assets are needed.

## Direction contract

THESIS: A calm, clearly organized teaching workspace; topic choice and conversation are the primary tasks, not a marketing hero.

OWN-WORLD: Pearl #F6F2EF canvas, Harbor #B0C8CC navigation, Midnight #363E4F ink/actions, Santorini #D9DFE3 secondary surfaces, Sea Green #8EA39D learning surfaces. Rounded, generous controls with dark readable text; self-hosted Manrope throughout.

STORY: Choose a topic, explain it, inspect the student's notebook, then review the exam. History remains accessible from the header on every study page.

FIRST VIEWPORT: Production's PMP header and learning invitation, a white How it works example beside it, then four visible topic cards with one named start action. On narrow screens the example follows topic choice. Session retains title/export controls, white chat pane and distinct notebook column; only its AI tile/header becomes Milo. At small widths task columns stack and history becomes the existing modal drawer.

FORM: User-pinned production workspace takes precedence over earlier concept seeds and dropdown variants. Milo's 56px geometric book begins neutral and smiles as distinct saved notes accumulate; only a fresh current-revision full-score exam celebrates. Expression is separate from listening/thinking/writing/paused activity. It acknowledges progress without claiming understanding. A 180ms mouth-opacity/color transition is removed for reduced motion. No entrance motion or background animation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

FINISH VERDICT (2026-11-15): neutral and passed-exam faces verified in local Safari at desktop and narrow widths; source delta preserves production layout. Typecheck, lint, 19 focused tests and build pass. Detector has no findings. No shipping raster assets. Published by explicit owner request as dpl_GagMv3M8faRGzGV37pbEVcFeuPc9; Milo verified in an existing session at teachapp.vercel.app. Source commit/push remains the owner's responsibility.

RESTORATION EXTENSION (2026-11-15): user requests the morning features 1, 3, 4, 5 on the working site. Preserve the pinned production layout; restore note arrival/source disclosure, saved-question walkthrough with draft-preserving return, and earned improvement feedback alongside Milo. Focal motion is the actual score improvement; supporting note feedback identifies new saved evidence. Replays are immediate and free of model calls. Reduced-motion alternatives retain textual evidence.

LOCAL REFINEMENT (2026-11-16): user requests local file improvements and reserves commit/push. Preserve the palette, topic cards, Milo, voice and learning feedback. Add a first-viewport topic anchor, shorten the static example, collapse the empty transcript, group chat tools, move export below the workspace/results, and distinguish automatic notebook updates from manual recovery. No new dependency or animation. AI prompt refinements preserve concrete source quotes and request abstention when essential answer steps lack evidence; model, call count and shared budget are unchanged.

REFINEMENT VERDICT (2026-11-16): desktop and narrow browser inspection passed for home and empty chat; topic/notebook anchors transfer focus, no horizontal overflow, a local message saves with AI disabled, and the inspected console has no errors. Typecheck, lint, build and 249 tests pass; 59 database tests skipped. AI prompt changes have not had a live paid evaluation. Local screenshot: `.data/qa-ui-20261116/home.jpg`. No production deployment, commit or push performed.
