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

import { radiiTokens } from '../design/tokens.generated';

/** Legacy radii scale, mapped onto the design radii roles (control 12 / card 20 / pill). */
export const radii = {
  xs: radiiTokens.control,
  sm: radiiTokens.control,
  md: radiiTokens.card,
  lg: radiiTokens.card,
  pill: radiiTokens.pill,
  circle: 0,
} as const;

export type RadiusToken = keyof typeof radii;
