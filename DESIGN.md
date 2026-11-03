---
name: Cuadrant
description: A restrained, neutral interface for workforce planning.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.141 0.005 285.823)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.21 0.006 285.885)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.967 0.001 286.375)"
  muted-foreground: "oklch(0.552 0.016 285.938)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.92 0.004 286.32)"
  ring: "oklch(0.705 0.015 286.067)"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
rounded:
  sm: "0.125rem"
  md: "0.375rem"
  lg: "0.625rem"
  xl: "0.75rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
---

# Design System: Cuadrant

## Overview

**Creative North Star: "The Modern Utility"**

Cuadrant's visual language is a restrained, crisp working surface for company and installation planning. It favors familiar system typography, neutral tonal roles, clear borders, and compact controls over decorative brand expression. Information is organized for repeated operational tasks: a persistent sidebar anchors navigation and installation context while the main workspace carries forms, tables, and schedules.

Light and dark themes share the same low-chroma structure, with contrast and surface roles adapted for each. The implementation uses a single system sans-serif stack and a rounded-control vocabulary. No further brand palette or visual rejection is established.

**Key Characteristics:**
- Neutral, low-chroma surfaces with explicit semantic foreground and border roles
- Sidebar-led application frame with dense, scannable work areas
- Crisp controls with modest rounded corners

## Colors

The shared theme is near-monochrome: semantic roles distinguish surfaces and states, with a separate dark-theme mapping.

### Primary
- **Charcoal Ink** (`{colors.primary}`): Default strong control and sidebar emphasis in the light theme; mapped to a light surface role in dark theme.

### Neutral
- **Paper White** (`{colors.background}`): Main application canvas in light theme.
- **Ink Text** (`{colors.foreground}`): Primary text and icon color in light theme.
- **Card Surface** (`{colors.card}`): Raised-by-contrast content surface; white in light theme.
- **Soft Neutral** (`{colors.secondary}`): Secondary and muted surface role.
- **Quiet Text** (`{colors.muted-foreground}`): Supporting text and lower-priority labels.
- **Fine Divider** (`{colors.border}`): Borders and table/container boundaries.
- **Focus Gray** (`{colors.ring}`): Keyboard focus ring role.

### Named Rules
**The Semantic Surface Rule.** Assign colors by theme role rather than introducing page-specific palette values; dark mode remaps the same roles.

## Typography

**Display Font:** System sans-serif stack (platform system UI)
**Body Font:** System sans-serif stack (platform system UI)

**Character:** Familiar and utilitarian, with compact labels and clear hierarchy. The observed theme establishes a font stack but not a distinct display face or global type scale.

### Hierarchy
- **Body** (system default sizing): Main interface copy, form content, and table data.
- **Label** (typically compact, medium weight where emphasized): Navigation labels, field labels, and supporting metadata.

## Layout

The application uses a persistent sidebar for company/installation context, primary navigation, and user actions, with a flexible main region for task content. Main content is padded at 1rem on small layouts and 1.5rem at medium and wider layouts. Tables and schedule grids prioritize scanning and operational density; allow them to use available width while preserving minimum readable controls. The component styles use a small spacing vocabulary, including 0.5rem, 1rem, and 1.5rem steps.

## Elevation & Depth

Depth is primarily communicated through tonal surface roles and borders rather than a pervasive shadow system. A few overlays and dialogs use subtle shadows to distinguish transient layers; keep resting content flat and avoid adding elevation without a clear layering need.

## Shapes

The form language is softly rounded but controlled: the shared radius is 0.625rem, with smaller radii used on compact controls and schedule entries and larger radii on selected panels. Borders are thin and neutral. Avoid pill silhouettes except for genuinely circular indicators or avatars.

## Components

### Buttons
- **Character:** Restrained and crisp, with clear semantic emphasis.
- **Shape:** Compact rounded corners, commonly 0.375rem to 0.625rem.
- **Primary:** Strong foreground/background contrast using semantic primary roles.
- **Hover / Focus:** Use theme accent states and a visible ring for keyboard focus; retain a distinct focus-visible treatment.
- **Secondary / Ghost:** Use neutral surface and border roles without competing with the primary action.

### Cards / Containers
- **Corner Style:** Modest rounding, typically 0.625rem to 0.75rem.
- **Background:** Card role against the application background.
- **Shadow Strategy:** Flat by default; use subtle shadow only for overlays.
- **Border:** Thin semantic border for tables and grouped content where separation is needed.
- **Internal Padding:** Commonly 0.75rem to 1.5rem, depending on content density.

### Inputs / Fields
- **Style:** Neutral surface, semantic border, and modest rounding.
- **Focus:** Visible theme ring and clear border/focus state.
- **Error / Disabled:** Use semantic destructive or muted states; preserve readable contrast.

### Navigation
- **Style:** Sidebar-led, with company and active installation context in the header, primary navigation in the content area, and user actions in the footer. Active and hover states use sidebar semantic roles. The sidebar includes an installation-switching menu.

### Planning Schedule
Schedule entries use compact bordered, rounded cells with employee color indicators and drag affordances. Keep the grid readable and preserve keyboard focus visibility on interactive entries.

## Do's and Don'ts

### Do:
- **Do** use the shared semantic color roles so light and dark themes remain coherent.
- **Do** keep navigation, tables, and planning controls compact and easy to scan.
- **Do** make keyboard focus visible on interactive controls.

### Don't:
- **Don't** invent a broader brand accent palette from isolated data or fallback colors.
- **Don't** add decorative shadows to resting cards or containers.
- **Don't** use oversized display typography that competes with operational content.
