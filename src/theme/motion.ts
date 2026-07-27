import { Easing } from 'react-native';

/**
 * Global motion primitives for AthanNow.
 *
 * The app's existing animation craft (SkyScene's twinkle/pulse system,
 * Spotlight's ring pulse) is genuinely well-tuned — the problem is that it's
 * undocumented, un-shared, and never checks the user's reduced-motion
 * preference. This file names the durations/easings already in use so new
 * code reaches for a shared token instead of inventing a new number, and
 * pairs with `useReducedMotion` (`src/hooks/useReducedMotion.ts`) which
 * every `Animated.loop` must check before starting.
 */

export const duration = {
  /** Press-state feedback. */
  instant: 100,
  /** Small fades (already used at Spotlight.tsx:52 — codify, don't invent a new number). */
  fast: 180,
  /** Standard transitions (already used at QuranScreen.tsx:96-99 for immersive-mode toggle — codify). */
  base: 220,
  /** Sheet/card entrance. */
  slow: 320,
  /** Full-screen reveal / onboarding entrance. */
  slower: 600,
} as const;

export const easing = {
  /** "Settle in from motion" feel — used for entrance reveals. */
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  standard: Easing.out(Easing.cubic),
  /** Press-state feedback. */
  decel: Easing.out(Easing.quad),
} as const;

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;

/**
 * Shared pressed-state opacity for tappable rows/buttons/pills. This is the
 * value the app already used most often (`Pressable`'s `opacity: pressed ?
 * PRESSED_OPACITY : 1` pattern, and `IconButton`'s `pressed` style) — call
 * sites should reference this instead of hardcoding their own number (0.7,
 * 0.8, 0.85 all appeared as one-off outliers before this was introduced).
 */
export const PRESSED_OPACITY = 0.6;
