---
name: TeachAPP Authentication
description: Scoped account-entry system derived from the shipped login screen.
colors:
  auth-background: "#1f1f1f"
  auth-surface: "#373737"
  auth-ink: "#f5f5f5"
  auth-muted: "#aaa"
  auth-line: "#383838"
  auth-accent: "#ff4165"
  auth-field: "#292929"
  auth-focus: "#ff8fa5"
  auth-error: "#ffb3c0"
typography:
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(38px, 5vw, 58px)"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.025em"
  brand:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "0.92em"
    fontWeight: 800
    letterSpacing: "-0.04em"
  body:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "17px"
    lineHeight: 1.55
  label:
    fontFamily: '"Avenir Next", Avenir, "Segoe UI", sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.35
rounded:
  pill: "999px"
  field: "12px"
  circle: "50%"
spacing:
  methods-gap: "16px"
  mobile-gutter: "20px"
  desktop-gutter: "24px"
components:
  method:
    backgroundColor: "{colors.auth-surface}"
    textColor: "{colors.auth-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "18px 72px"
  submit:
    backgroundColor: "{colors.auth-accent}"
    textColor: "{colors.auth-background}"
    rounded: "{rounded.pill}"
  email-field:
    backgroundColor: "{colors.auth-field}"
    textColor: "{colors.auth-ink}"
    rounded: "{rounded.field}"
    padding: "16px 18px"
---

# Design System: TeachAPP Authentication

## Overview

**Creative North Star: "Focused account entry"**

A focused charcoal account-entry surface adapted from the supplied login reference. Large light headings, gray pill actions, and a restrained pink accent keep the choice legible. The serif invitation and bold sans brand are an intentional pairing from that reference.

This record covers /login and /auth/callback only. The existing study workspace remains light, with its own paper, green ink, and green action tokens in globals.css; these auth tokens do not replace that system.

**Key Characteristics:**
- Charcoal canvas with tonal separation
- Equal-width pill methods
- Serif invitation with bold sans brand
- Pink email action and account-creation emphasis

## Colors

### Primary

Pink marks the email submission action and account-creation emphasis. The pale pink focus and error colors communicate interaction and feedback.

### Neutral

Charcoal forms the full route background; gray surfaces hold method buttons and callback notices. Light ink carries headings and actions, muted gray carries supporting copy, and a subtle line separates the bottom explanation. Fields and the close control share the darker field tone.

**The Route Boundary Rule.** Authentication colors are scoped to /login and /auth/callback; the light workspace retains its existing palette.

## Typography

The headline uses Georgia with Times New Roman and serif fallbacks. Body text and the brand use Avenir Next, Avenir, Segoe UI, and sans-serif fallbacks. The displayed font depends on installed fonts; no bundled face is asserted.

The headline, brand, body, and method-label roles are recorded above. The brand size is relative to its heading. At widths up to 520px, the heading becomes clamp(32px, 9vw, 42px), supporting copy becomes 15px, and method labels become 17px. Email labels and errors use 15px; the submit label uses 18px. The serif/sans relationship is specific to the approved reference, not a new project-wide display-font policy.

## Layout

Authentication uses a full-height flex column (100dvh). The content width is min(100% - 48px, 600px), centered horizontally; top padding is clamp(112px, 15vh, 160px). Method buttons form one column with the recorded gap. The bottom explanation uses automatic top margin, a divider, and safe-area-aware bottom padding.

At widths up to 520px, content uses 20px side gutters, top padding becomes 108px, and bottom content padding falls from 72px to 48px. Method controls have an 80px minimum height on desktop and 68px on mobile. The email field and submit control have a 60px minimum height. The close control is 52px, becoming 44px on mobile.

## Elevation & Depth

Authentication uses tonal layers without box shadows. Resting controls are distinguished by fill; keyboard focus uses a 3px outline with a 5px offset. No authored animation or transition is present in this surface.

## Shapes

Method and submit controls are pills. The close control is circular. Email fields have softly rounded corners with a visible gray border. Callback notices inherit the existing 8px notice radius.

## Components

Method buttons have centered labels and independently positioned left icons. Email uses a stroked envelope SVG; Google uses the supplied official colored raster mark on a white circle. Their shared hover fill is #444, with white text, on hover-capable devices.

The email field uses a #656565 border and the accent caret. The submit action turns #ff6b86 on hover. Pending controls use #303030 with #b8b8b8 text and a wait cursor. The back control is a muted, transparent text action; the circular close link returns to the workspace. Each retains the auth focus outline.

Email selection reveals the passwordless address form; successful submission reveals the sent state. Errors are inline alerts. Missing provider configuration shows an unavailable message, not a success state. Callback feedback uses the same auth colors inside the inherited notice shape.

## Do's and Don'ts

### Do:
- Do keep the charcoal theme scoped to authentication routes.
- Do preserve visible focus outlines and readable pending/error states.
- Do preserve the reference’s serif invitation and sans brand pairing.

### Don't:
- Don’t apply the authentication palette to the existing light workspace.
- Don’t introduce password or demo controls into this account-entry surface.
