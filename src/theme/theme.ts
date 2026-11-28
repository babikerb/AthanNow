/**
 * The app's design tokens, in one place. Everything here comes from design/tokens.json (run
 * `node scripts/sync-tokens.mjs` after editing it), which also generates the SwiftUI side:
 * widgets/DesignTokens.swift and modules/quran-reader/ios/Theme.swift, so the two never drift.
 *
 * In components, prefer the live theme from `useTheme()` (src/design/theme), which resolves these
 * for the current light or dark appearance and Increase Contrast. Import from here for values that
 * don't change with the appearance (spacing, radii, type, fixed palettes) and in static styles.
 */
import type { TextStyle } from 'react-native';

import { colorTokens, motionTokens, paletteTokens, radiiTokens, spacingTokens, typeTokens } from '../design/tokens.generated';

export { textStyle, type Palette, type TypeVariant } from '../design/tokens';
export { useTheme } from '../design/theme';

/** Light and dark colours (and their Increase Contrast versions). */
export const colors = colorTokens;
/** The 4 point spacing rhythm: xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32, huge 48, giant 64. */
export const space = spacingTokens;
/** Corner radii: xs 4, sm 8, control 12, lg 16, card 20, feature 24, sheet 32, pill (a circle or capsule). */
export const radius = radiiTokens;
export const type = typeTokens;
export const motion = motionTokens;
/** Fixed colours outside the light/dark theme. */
export const palette = paletteTokens;

/** Apple's minimum touch target: every control is at least this big to tap. */
export const TOUCH_TARGET = 44;

export type ArabicSize = 'caption' | 'small' | 'name' | 'ayah' | 'ayahLarge';

/** Arabic text: always the mushaf's KFGQPC Hafs, at a size with the line height its marks need. */
export function arabicStyle(size: ArabicSize = 'name'): TextStyle {
  const a = typeTokens.arabic[size];
  return { fontFamily: typeTokens.arabic.family, fontSize: a.size, lineHeight: a.line };
}

export type PageColour = 'system' | keyof typeof paletteTokens.page;
