---
name: Snap Grid Soft Premium
colors:
  primary: "#1856FF"
  background: "#F2F4F8"
  surface: "#FFFFFF"
  foreground: "#12131A"
  muted: "#667085"
rounded:
  sm: 12px
  md: 20px
  lg: 28px
---
# Snap Grid Design

## Overview
Snap Grid is a browser extension utility, not a marketing site. The UI should feel precise, calm, and product-like, with a cool silver-white base and a single blue accent. It should look composed and readable at small sizes, especially inside the constrained popup surface.

This is a restrained interface for repeated use. It should feel closer to a focused tool panel than a decorative concept piece. The design needs to support frequent capture, quick inspection, and low-friction editing without visual noise.

## Core Read
- Cool gray-white, never pure white and never warm cream.
- One blue accent only, used for primary actions, active states, and brand recognition.
- Soft material separation, but no heavy chrome.
- Readability and operability come before novelty.
- Popup edges should visually recede so the browser host frame does not become the focal point.

## Color
The palette is intentionally narrow.

- **Primary** {colors.primary} is the only brand accent. It belongs on primary buttons, selected states, and small identity moments.
- **Background** {colors.background} is a cool canvas, not a blank white sheet.
- **Surface** {colors.surface} is reserved for content-bearing layers and controls that need to feel solid.
- **Foreground** {colors.foreground} should read as ink, not a harsh absolute black.
- **Muted** {colors.muted} is for secondary labels and supporting information only.

Semantic success, warning, and destructive colors may appear when the meaning requires them, but they do not participate in brand expression.

## Surfaces
The interface should build hierarchy through material weight, not border accumulation.

- Background layers are quiet and atmospheric.
- Panel layers group content and establish structure.
- Control layers should feel denser and more clickable than the surfaces behind them.
- If a layout starts to look like nested outlines, remove wrappers before adding more styling.

## Interaction
Interactive elements must never dissolve into the background.

- Primary actions can carry stronger blue, contrast, and emphasis.
- Secondary actions may stay restrained, but must still read as actionable.
- Active states must be immediately legible.
- Tool UIs should feel quick and deliberate, not flashy or playful.

## Popup
The browser popup is a special case.

- Treat it as a compact host-controlled surface.
- Do not try to decorate or fight the outer browser frame.
- Reduce edge contrast instead of adding glow, shadow, or border tricks.
- Keep the visual center of gravity inside the content, not at the frame edge.

## Negative Constraints
- Do not modify `components/ui/*` to satisfy page-specific styling.
- Do not introduce a second brand accent.
- Do not use warm creamy backgrounds.
- Do not stack obvious double or triple borders for effect.
- Do not add glow-heavy glassmorphism, colorful atmospherics, or ornamental gradients.
- Do not make the outermost popup layer louder than the content inside it.
- Do not sacrifice clarity for “premium” styling.

## Implementation Boundary
This document defines the design identity and decision criteria.

- Implementation recipes stay in `docs/ui-recipes.md`.
- Engineering and collaboration constraints stay in `AGENTS.md`.
- Global tokens and semantic utilities live in `assets/styles/globals.css`.

## Project Terms
The following project terms are stable and should be reused instead of inventing new adjectives:

- `popup-canvas`: popup outer background used to soften the host frame
- `soft-shell`: outer wrapper surface
- `soft-core`: primary content surface
- `soft-subtle-core`: secondary information surface
- `control-surface`: standard interactive surface
- `soft-primary-button`: primary CTA treatment
- `soft-tag`: low-emphasis state tag
