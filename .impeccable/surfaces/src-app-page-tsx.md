---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/session/[id]/page.tsx","src/components/dashboard.tsx","src/components/app-shell.tsx","src/components/topic-choice.tsx","src/components/session-workspace.tsx","src/app/globals.css"]
---

# TeachAPP study workspace

Mode: Operate. Scope: home, history navigation, chat, notebook and exam review. Preserve browser-owned data, all API behavior, voice controls and the shared $4 budget. User supplied a five-swatch reference and explicitly requested a prettier frontend in that style; this pins the visual direction. Implement directly in code with real existing content, without another approval round. No decorative raster assets are needed.

## Direction contract

THESIS: A calm, clearly organized teaching workspace; topic choice and conversation are the primary tasks, not a marketing hero.

OWN-WORLD: Pearl #F6F2EF canvas, Harbor #B0C8CC navigation, Midnight #363E4F ink/actions, Santorini #D9DFE3 secondary surfaces, Sea Green #8EA39D learning surfaces. Rounded, generous controls with dark readable text; self-hosted Manrope throughout.

STORY: Choose a topic, explain it, inspect the student's notebook, then review the exam. History remains accessible from the header on every study page.

FIRST VIEWPORT: Slim brand/header row, left-aligned two-line 48px invitation, compact course/history context, then a broad topic work area beside a narrower Sea Green progress/how-it-works panel. Session: compact title/export controls, white chat pane and distinct notebook column. At small widths all task columns stack, history becomes the existing modal drawer.

FORM: User-pinned soft color-block workspace takes precedence over concept seed a3b0e5c7 (assigned index 4). Signature interaction: topic disclosure visibly highlights the current choice; subtle chevron rotation and control-color feedback, no entrance motion or content initially hidden. Native focus and reduced motion retained.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
