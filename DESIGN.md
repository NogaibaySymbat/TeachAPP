---
name: "TeachAPP Study Workspace"
description: "Pearl and Harbor teaching workspace grounded in the implemented study surfaces."
colors:
  pearl: "#f6f2ef"
  harbor: "#b0c8cc"
  midnight: "#363e4f"
  santorini: "#d9dfe3"
  sea-green: "#8ea39d"
  surface: "#fff"
  muted: "#596271"
  line: "#d2d7da"
  wash: "#e9edef"
  action-hover: "#252d3c"
  focus: "#396b7a"
  field-border: "#a4afb7"
  secondary-border: "#89949f"
  disabled-ink: "#5c6571"
  harbor-ink: "#40545d"
  harbor-line: "#8da8ad"
  harbor-hover: "#c4d6d8"
  green-ink: "#24332f"
  green-line: "#526e62"
  heading-accent: "#4f686d"
  error: "#8b2929"
  error-surface: "#f7ece8"
typography:
  headline:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "clamp(34px, 4vw, 50px)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  session-title:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  message:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "15px"
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.6
  metadata:
    fontFamily: "Manrope, \"Avenir Next\", \"Segoe UI\", sans-serif"
    fontSize: "12px"
    lineHeight: 1.6
rounded:
  control: "14px"
  navigation: "12px"
  option: "10px"
  disclosure: "16px"
  composer: "18px"
  panel: "24px"
  panel-mobile: "20px"
  notice: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  control-gap: "12px"
  md: "16px"
  lg: "20px"
  section: "24px"
  aside: "28px"
  study-panel: "30px"
  wide: "32px"
  gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.midnight}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.midnight}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-disabled:
    backgroundColor: "{colors.santorini}"
    textColor: "{colors.disabled-ink}"
  composer:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.composer}"
    padding: "16px"
  history-link:
    textColor: "{colors.midnight}"
    rounded: "{rounded.navigation}"
    padding: "12px"
  course-chip:
    textColor: "{colors.midnight}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  study-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.panel}"
    padding: "30px"
  progress-badge:
    backgroundColor: "{colors.sea-green}"
    textColor: "{colors.green-ink}"
  topic-card:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.disclosure}"
  topic-selected:
    backgroundColor: "{colors.harbor}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.option}"
    padding: "12px"
---

# Design System: TeachAPP Study Workspace

## Overview

**Creative North Star: "Pearl / Harbor study workspace"**

A calm teaching workspace built from Pearl canvas, Harbor navigation and rounded task surfaces. Midnight gives headings, actions and user messages a consistent anchor; Sea Green progress marks and Santorini notebook panels separate supporting work.

Manrope keeps the invitation, controls and conversation in one voice. Depth comes from adjacent color fields and fine borders, with compact metadata and generous task spacing. This record replaces the retired account-entry system and describes the current workspace only.

**Key Characteristics:**
- Five supplied colors with explicit readable companion inks
- Self-hosted Manrope throughout
- Rounded task panels and visible topic cards
- Flat tonal depth and restrained state feedback

## Colors

A soft, cool palette balances warm Pearl with blue-gray and green task surfaces. Frontmatter values are authoritative; semantic CSS aliases paper, ink and accent resolve to Pearl and Midnight.

### Primary

Midnight carries primary actions, headings, the book mark, avatar and user message bubbles. Action hover deepens it; focus uses a separate blue outline.

### Secondary

Harbor carries history navigation and selected topics. Harbor ink and Harbor line are the local text/border companions; Harbor hover gives history rows a visible state.

### Tertiary

Sea Green identifies progress with Green ink and Green line: the Today's topic badge and the streak outline on the home page. Santorini separates the student's notebook and disabled controls; disabled ink stays readable.

### Neutral

Pearl is the canvas, disclosure and composer surface. White surface holds topic, chat and exam panels. Wash fills student messages and notices; muted ink supports secondary text, and line separates content. Field and secondary borders make controls legible. Heading accent supplies the softer invitation line. Error ink and error surface are reserved for failures.

**The Readable Surface Rule.** Use Harbor ink on Harbor supporting text and Green ink on Sea Green text; the general muted ink belongs on the light neutral surfaces.

## Typography

**Display Font:** Manrope, with sans-serif fallback.
**Body Font:** Manrope, with Avenir Next, Segoe UI and sans-serif fallbacks.

The variable face is self-hosted at `public/fonts/manrope-variable.ttf` (weights 200–800, swap loading), with its adjacent OFL license. There is no distinct mono face.

### Hierarchy

Frontmatter records the actual headline, session title, panel title, body, message, label and metadata roles. Supporting copy varies from 13–15px; small privacy/status annotations use 11px. The brand is 20px/800 with a 10px subtitle. The main invitation is bounded to 21ch; paragraphs generally stop at 68ch. At 520px and below, the invitation is 34px/1.16, the session heading 27px, topic names 15px, and messages 14px. Tabular numerals support timestamps and scores.

**The One Typeface Rule.** Use the bundled Manrope for headings, body and controls; hierarchy comes from size, weight and spacing.

## Layout

Header, main and footer share a 1240px maximum width with 40px gutters, decreasing to 24px at 1000px and 16px at 520px. The workspace header is at least 80px tall. Panels align at their top edges; gaps and padding favor the 12/16/20/24/32px rhythm.

The home task grid uses a flexible primary column and 320px supporting column, narrowed to 280px below 1000px and stacked below 800px. The session has a 350px notebook column and stacks at 1000px. With desktop history open, the frame adds a 280px fixed, independently scrolling rail; task grids stack from 761–1150px. At 760px and below, history becomes a native modal drawer, width min(320px, 100% - 40px), with body scroll locked and focus restored on close. Content remains in normal document flow.

Chat transcript scrolling is bounded by 52dvh with a 250px minimum; messages occupy at most 88%, then 94% below 760px and 96% below 520px. Composer actions stack below 520px. Small-screen panels use 20px corners and padding, with chat padding reduced to 16px.

## Elevation & Depth

No box shadows are used. Color fields, one-pixel borders and alignment establish hierarchy. The modal drawer alone dims the page with a translucent backdrop (rgb(36 44 60 / 35%)); this is a navigation state, not decorative elevation.

**The Tonal Depth Rule.** Separate workspace regions with surface colors and fine borders; the shipped workspace has no box shadows.

## Shapes

Panels use broad rounded corners; controls, navigation rows and disclosures use smaller related radii from the frontmatter. Pills are native to course metadata, streaks and compact voice controls. Chat bubbles use 18px corners with a 5px lower corner toward the speaker's side. Desktop history has square edges; the drawer rounds only its right corners to 24px. Icons are inline stroked SVGs, generally 16–22px.

## Components

### Buttons

Primary buttons are Midnight with white labels, 44px minimum height and the recorded padding. The topic start action fills its panel width with a 50px minimum height. Secondary buttons are transparent with a one-pixel secondary border. Hover-capable devices darken enabled buttons; disabled buttons use Santorini and disabled ink. Focus is a 3px focus-color outline with 4px offset.

### Chips

Course context is a fine outlined pill with 11px bold text. The progress streak sits in the topic panel heading with a Green line outline and 13px semibold text, and appears only once the streak is above zero. These are status/context, not new primary actions.

### Cards / Containers

White topic and chat panels share the panel radius; topic padding is 30px and chat padding 24px. Notebook asides use 28px padding. The notebook uses Santorini and exam review white. The home page has no progress panel; the white How it works example sits beside the invitation on wide screens and after the topic panel on narrow ones. Panels rely on color rather than shadow. Notices use Wash, 8px corners and 16px padding; failures use the error pair.

The notebook separates the student's latest restatement/question from exact source quotes. Quote entries use white surfaces, 14px corners and 13px text; source and Clarify actions have 44px targets. A textual New badge and border identify additions in the current visit, with a 3-second Harbor-to-white highlight (disabled for reduced motion). The note list scrolls at 480px. A View notebook anchor connects the chat to the panel, while Clarify focuses the composer and preserves its draft.

### Inputs / Fields

The Pearl composer has a one-pixel line border, 18px corners and 16px padding. Its textarea is transparent and borderless with an 88px minimum height, vertical resizing and muted placeholder. Focus within changes the composer border to heading accent; the textarea retains visible keyboard focus. Voice language selection is a 44px minimum-height Pearl control with a field border and 12px corners.

### Navigation

Harbor history rows use compact titles and secondary metadata; the current page uses Pearl. The new-session action is Midnight with Pearl text and a plus SVG. Desktop navigation is collapsible; narrow navigation uses the modal drawer. Pointer toggles slide the panel left/right over 240ms with cubic-bezier(0.32, 0.72, 0, 1), and the backdrop fades in sync. The desktop content reflows once and uses an interruptible translation to bridge its position change. Closed desktop history stays mounted but inert and hidden from assistive technology. Keyboard toggles and Escape are immediate; reduced motion keeps a 160ms fade without translation. The header toggle is a transparent 44px control with a Santorini hover surface. On desktop it is hidden while history is open, leaving only the close button inside the rail; keyboard focus follows the visible control.

### Topic cards

Every topic is a visible toggle button in a four-column grid (two columns below 1000px). Cards are Pearl with a field border, 16px corners, 16px padding and a 92px minimum height, showing the title, status and a Sea Green Today's topic badge. The selected card is Harbor with a 2px Midnight border. Choosing a card only selects it; the single Midnight start button below names the selected topic and begins the session.

### Conversation

User bubbles align right in Midnight/Pearl; student bubbles align left in Wash/Midnight. Timestamp metadata remains separate from message text. The composer groups writing, voice controls and submission. Color changes use 160ms ease-out; reduced-motion preference removes these transitions. There is no entrance animation.

### Milo avatar

Restored on top of the production design at `14be3d8`, preserving its home page, topic cards, chat and notebook layout. The chat heading uses a 56px inline SVG book in a 16px-radius tile, followed by “Milo · AI student” and a factual text status. Midnight strokes and a Pearl page sit on Santorini when empty, Harbor while notes accumulate, and Sea Green after a fresh passed exam.

The face progresses from neutral (zero distinct nonempty notes), through curious (one), learning (two), and engaged (three or more), to celebrating (a fully passed exam matching the current fresh notebook revision). Duplicate quotes and unsent drafts do not count. Smiling acknowledges saved notes, not correctness or measured understanding. Listening, thinking, writing, examining and paused states have separate text feedback; thinking, writing and examining use focused eyes. Paused replies preserve the saved-progress expression.

Mouth opacity and tile color transition over 180ms ease-out only when state changes. Reduced motion removes both transitions. The SVG is decorative and hidden from assistive technology; the visible status uses `role="status"`. No background loop, raster asset or extra model request is used.

### Saved learning feedback

Restores the morning features without changing production's homepage or workspace grid. New notebook entries use stable source-plus-quote keys, a 200ms arrival (4px translation/opacity, stagger capped at 160ms), and the existing 3-second Harbor highlight. Reduced motion keeps the New badge/border with no animation. “From your explanation” is a native disclosure containing the original message and a source link; an expanded source occupies the full note width.

Only a newly completed exam opens the optional question-by-question review. Numbered steps show review position, never fake generation progress. The teacher can skip to all results or revisit a saved exam without an API call. Each transition focuses its heading; “Help Milo with this question” focuses the composer, preserves its draft and shows the question as context. Failed-question answer keys remain hidden under the existing grading policy. Reloaded/stale results open in full. During review, the notebook score and Milo's passed-exam expression wait for the summary.

Attempt comparison retains the current detailed evidence and adds a score arrow and Sea Green improvement acknowledgement. Only comparable positive score changes qualify. The checkmark's 280ms turn/scale occurs once when finishing a newly completed review; replay/reload, regressions and changed questions do not celebrate. Reduced motion uses a 140ms fade. No sound, confetti, timer, new dependency or paid request is added.

## Do's and Don'ts

### Do:
- Do preserve the five supplied palette roles and their surface-specific text colors.
- Do keep visible focus, text status labels and SVG state indicators alongside color.
- Do stack task columns and use the modal history drawer at the implemented narrow breakpoints.
- Do use sentence case, rounded panels and the bundled Manrope.

### Don't:
- Don't reintroduce the retired charcoal/pink authentication identity into the workspace.
- Don't substitute a system display face for Manrope.
- Don't treat synthesized sidecar tonal ramps as additional approved application tokens.
