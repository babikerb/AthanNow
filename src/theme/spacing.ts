/**
 * Global spacing scale for AthanNow.
 *
 * The literals already in use across the app (2, 3, 4, 5, 6, 8, 9, 10, 12,
 * 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 32, 40, 44, 56) already cluster
 * close to a 4pt grid — the app was already unconsciously gridding, just
 * without naming it. This formalizes that grid into one closed scale.
 *
 * Odd literals round to the nearest token without visibly changing layout
 * (e.g. `paddingVertical: 26` -> `spacing.xl + 2`, close enough to snap to
 * `spacing.xl`). The one deliberate exception is any touch-target-adjacent
 * padding that was already too small (e.g. a 9pt vertical pad on a button) —
 * those should grow to clear the 44pt minimum, not snap to the nearest
 * (still too small) token.
 */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export type SpacingToken = keyof typeof spacing;
