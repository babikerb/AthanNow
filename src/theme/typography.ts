/**
 * Global type scale for AthanNow.
 *
 * A closed 12-step scale replacing the app's 19 ad hoc `fontSize` literals.
 * Sizes were chosen to cover every real current use case (a mechanical
 * snap-to-nearest migration, not a redesign of any screen's information
 * density) while collapsing them down to these named steps.
 *
 * Ratio shape: 11->12->13->14 is a near-linear +1 each (matches iOS's own
 * Dynamic Type steps at the tight bottom of the scale — the right reference
 * for a native app). From 14->16->17->20->24->28->34->44 the steps widen
 * (~1.14, 1.06, 1.18, 1.2, 1.17, 1.21, 1.29) — a genuine progressive scale.
 *
 * Letter-spacing rule baked into each token: spacing tightens roughly
 * -0.02 x fontSize above 20px (headline moments read better tightened) and
 * loosens slightly (+0.1 to +0.3) below 13px in all-caps/eyebrow contexts
 * (section headers, "TODAY" badge) where tracking improves legibility of
 * small caps. This is a property of the token now, not a per-screen choice.
 *
 * Second typeface: `Fraunces-SemiBold` (see App.tsx's `useFonts` call) is
 * reserved for exactly three headline moments app-wide — the onboarding
 * wordmark, the Athan-screen countdown, and the Qibla degree readout — all
 * using the `hero` token. Everything else stays on the system sans face.
 * If the Fraunces font hasn't been loaded/installed yet, RN falls back to
 * the system font at the token's numeric `fontWeight`, which is correct
 * default behavior — no extra guarding needed at call sites.
 */

export const type = {
  // Badges, "TODAY" pill, eyebrow micro-labels.
  caption2: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.2 },
  // Section footers, hijri date, timestamps.
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.3 },
  // Row sub-values, secondary metadata.
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.1 },
  // Tooltip body, skip/next buttons, segment labels.
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0 },
  // Default row label, paragraph copy.
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  // Emphasized inline row text.
  bodyEmph: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  // Header pill titles, "Next"/CTA buttons.
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  // Hero prayer name, section headline.
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: -0.2 },
  // Sheet titles, LocationSheet city name.
  title2: { fontSize: 24, lineHeight: 29, fontWeight: '800' as const, letterSpacing: -0.4 },
  // Screen-level headline moments.
  title1: { fontSize: 28, lineHeight: 33, fontWeight: '800' as const, letterSpacing: -0.5 },
  // Calendar date label (was 26/800).
  display: { fontSize: 34, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.6 },
  // Countdown, onboarding wordmark — numeric/display use, no fixed lineHeight
  // (self-sized). One of the three reserved Fraunces-SemiBold moments.
  hero: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1.2 },
} as const;

export type TypeToken = keyof typeof type;

/** The reserved second typeface for headline moments (see file doc comment above). */
export const HEADLINE_FONT_FAMILY = 'Fraunces-SemiBold';
