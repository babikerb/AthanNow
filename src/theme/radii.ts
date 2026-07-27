/**
 * Global corner-radius scale for AthanNow.
 *
 * Four different "card" surfaces previously used four different radii for
 * the same conceptual role (Settings' group: 14, Calendar's day card: 22,
 * LocationSheet's hero card: 22, Spotlight's tooltip: 20). Consolidated to
 * one shared value per role below — this is the cheapest, highest-visibility
 * fix in the whole system: it makes the app's "this is a contained, elevated
 * thing" grammar read as one decision instead of four.
 */

export const radii = {
  /** Small chips/badges (TODAY badge, small tags). */
  xs: 8,
  /** Compact controls (search rows, segment container). */
  sm: 12,
  /** Standard containers (Settings group — was 14, +2 for visual parity with the others). */
  md: 16,
  /** Elevated "hero" cards (Calendar day card, LocationSheet hero card, Spotlight tooltip — was 22/22/20, now one shared value). */
  lg: 20,
  /** Fully-rounded buttons and pills (Get Started button, GlassPill, segment items). */
  pill: 999,
  /** Icon circles are computed as size/2 at the call site — not a fixed constant. */
  circle: 0,
} as const;

export type RadiusToken = keyof typeof radii;
