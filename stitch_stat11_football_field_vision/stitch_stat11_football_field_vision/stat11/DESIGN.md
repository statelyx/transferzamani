---
name: STAT11
colors:
  surface: '#0c141a'
  surface-dim: '#0c141a'
  surface-bright: '#323a40'
  surface-container-lowest: '#070f15'
  surface-container-low: '#151d22'
  surface-container: '#192126'
  surface-container-high: '#232b31'
  surface-container-highest: '#2e363c'
  on-surface: '#dbe3ec'
  on-surface-variant: '#bbcbbb'
  inverse-surface: '#dbe3ec'
  inverse-on-surface: '#293138'
  outline: '#869486'
  outline-variant: '#3d4a3e'
  surface-tint: '#4ae183'
  primary: '#54e98a'
  on-primary: '#003919'
  primary-container: '#2ecc71'
  on-primary-container: '#005027'
  inverse-primary: '#006d37'
  secondary: '#42ee81'
  on-secondary: '#003917'
  secondary-container: '#02d168'
  on-secondary-container: '#005325'
  tertiary: '#99df91'
  on-tertiary: '#003909'
  tertiary-container: '#7ec378'
  on-tertiary-container: '#085014'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bfe9c'
  primary-fixed-dim: '#4ae183'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005228'
  secondary-fixed: '#63ff93'
  secondary-fixed-dim: '#31e377'
  on-secondary-fixed: '#00210b'
  on-secondary-fixed-variant: '#005225'
  tertiary-fixed: '#acf4a4'
  tertiary-fixed-dim: '#91d78a'
  on-tertiary-fixed: '#002203'
  on-tertiary-fixed-variant: '#0c5216'
  background: '#0c141a'
  on-background: '#dbe3ec'
  surface-variant: '#2e363c'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for a high-performance football analytics environment. It captures the essence of the "Digital Pitch"—a space where raw data meets the tactical beauty of the game. The personality is authoritative, precise, and elite, catering to power users who demand high information density without sacrificing aesthetic polish.

The style is a hybrid of **Modern Corporate** and **Tactile Pitch-Aesthetic**. It avoids the clutter of traditional sports sites by utilizing a strict "pitch-grid" logic, where semi-transparent field markings serve as both structural dividers and decorative motifs. The interface should feel like a premium tactical board used by world-class analysts: dark, focused, and vibrantly accented by "Action Green" highlights.

## Colors

The palette is rooted in the "Deep Pitch" spectrum. The primary background uses a near-black forest green to provide maximum contrast for white data points and vibrant green accents.

- **Primary Action (#2ECC71):** Used for interactive elements, primary buttons, and positive performance indicators.
- **Highlight Green (#57FF8F):** Reserved for "Live" status indicators, peak statistics, and hover states to create a glowing, energetic effect.
- **Turf Green (#1B5E20):** Used for low-priority fills, progress bar backgrounds, and subtle field-texture overlays.
- **Pitch Lines (#FFFFFF at 10-20% opacity):** White is used sparingly for text and as a structural tool to mimic the crisp, chalky lines of a football field.

## Typography

Typography is optimized for rapid data scanning. **Hanken Grotesk** provides a sharp, technical character for headlines and primary labels, echoing modern sports broadcasting graphics. **Inter** is used for body text and tabular data due to its exceptional legibility at small sizes.

For statistics and scoreboards, use the `data-mono` style to ensure numbers align perfectly in vertical columns. `label-caps` should be used for table headers and category descriptors to maintain a structured, professional hierarchy. On mobile, headlines scale down by 20%, while body sizes remain constant to ensure readability.

## Layout & Spacing

The layout follows a **compact fluid grid** system. Information density is a priority, mimicking the data-rich environments of professional scouting platforms.

- **Desktop:** A 12-column grid with 16px gutters. Dashboards often utilize a 3-column split (Sidebar: 2 cols, Main Feed: 7 cols, Stats Panel: 3 cols).
- **Mobile:** A single-column flow with 16px horizontal margins.
- **Pitch Overlays:** Use a background "Pitch Pattern" (subtle diagonal grass stripes) that aligns with the grid. Decorative lines (like the center circle) should be placed at 50% width and 50% height of specific container sections to maintain the football metaphor.

## Elevation & Depth

This design system uses **Tonal Layering** and **Pitch Lines** instead of traditional drop shadows to maintain a crisp, flat aesthetic.

- **Level 0 (Base):** `#081C15` - The deep turf background.
- **Level 1 (Cards):** `#102A22` - Used for primary content containers. These should have a `1px` solid border using `#FFFFFF` at 10% opacity to mimic field markings.
- **Level 2 (Interaction/Popovers):** `#16352B` - Used for dropdowns, tooltips, and hovering states.
- **Accents:** Use a subtle "Inner Glow" (0px blur, 1px spread) on active cards using the Primary Green at 20% opacity to indicate selection.

## Shapes

The shape language is "Architectural Soft." A `rounded-sm` (4px) base is used for almost all elements to maintain a professional, precision-engineered look.

- **Buttons & Inputs:** 4px corner radius.
- **Feature Cards:** 8px (`rounded-lg`) to provide a slight visual distinction for high-level containers.
- **Data Tags/Chips:** Full pill-shaped rounding for player positions (e.g., "FWD", "MID") to contrast against the sharp-edged data tables.

## Components

### Buttons
Primary buttons use the `Primary Green` with black text for maximum punch. Secondary buttons use a transparent background with a 1px white border (pitch line style). Hover states should trigger a subtle glow effect (`Highlight Green`).

### Data Tables
Tables are the heart of the system. Use zebra-striping with `#102A22` and `#16352B`. Rows should have a 1px bottom border using the "Pitch Line" style. The "Key Stat" column should always use the `Primary Green` for the text color.

### Player Attribute Hexagons
Tactical visualizations should use a `tertiary_color` (Grass Green) fill at 30% opacity, with a `Primary Green` 2px stroke.

### Input Fields
Dark-themed inputs with a 1px border. On focus, the border transitions to `Primary Green` and the background shifts slightly lighter to `#16352B`.

### Live Score Tickers
Continuous horizontal elements that use the `Highlight Green` for the "Live" clock, creating a sense of urgency and real-time movement.