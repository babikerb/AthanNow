/**
 * Global icon-size scale for AthanNow.
 *
 * Icon sizes previously ranged 9-40px with sixteen distinct, unnamed values.
 * Consolidated to the six named steps below.
 */

export const iconSize = {
  /** Inline accent glyphs (location pin inside the header pill, chevron-down). */
  xs: 12,
  /** Secondary/inline icons (search field icon). */
  sm: 16,
  /** Default row icon (Settings row icons already use exactly this — codify it). */
  md: 20,
  /** Prominent standalone icon (LocationSheet icon badge glyph, Sheet close glyph target). */
  lg: 24,
  /** Sheet close button glyph (already 28 — codify). */
  xl: 28,
  /** Large hero badge icons (empty-state illustrations). */
  xxl: 40,
} as const;

export type IconSizeToken = keyof typeof iconSize;

/**
 * Every icon-bearing pressable — regardless of visual icon size — must
 * resolve to at least a 44x44pt hit area (the Apple HIG minimum). Use this
 * instead of hand-picked `hitSlop` numbers (`8`, `10`, `12`, ...) scattered
 * across the app; it guarantees the floor by formula instead of eyeballing
 * it per instance.
 */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, Math.ceil((44 - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
