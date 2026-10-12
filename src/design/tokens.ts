import type { TextStyle } from 'react-native';

import {
  colorTokens,
  motionTokens,
  radiiTokens,
  skyShiftMinutes,
  skyStages,
  spacingTokens,
  typeTokens,
  type ColorScheme,
  type SkyStage,
} from './tokens.generated';

export { colorTokens, motionTokens, radiiTokens, skyShiftMinutes, skyStages, spacingTokens, typeTokens };
export type { ColorScheme, SkyStage };

export type Palette = { -readonly [K in keyof typeof colorTokens.dark]: string };
export type TypeVariant = keyof typeof typeTokens.scale;

export const spacing = spacingTokens;
export const radii = radiiTokens;
export const motion = motionTokens;

/** Resolve one palette for a scheme + Increase Contrast state. */
export function resolvePalette(scheme: ColorScheme, highContrast: boolean): Palette {
  const key = scheme === 'dark' ? (highContrast ? 'darkHC' : 'dark') : highContrast ? 'lightHC' : 'light';
  return colorTokens[key] as Palette;
}

/** Warm "paper" surface for Quran reading (independent of app scheme). */
export const paperPalette = colorTokens.paper;

/**
 * RN text style for a type variant. Display-family variants use the bundled
 * Fraunces SemiBold; everything else is the system font (SF Pro). Tabular +
 * lining figures are always on so times and countdowns never jitter.
 */
export function textStyle(variant: TypeVariant): TextStyle {
  const t = typeTokens.scale[variant];
  const display = t.family === 'display';
  return {
    fontFamily: display ? typeTokens.families.display : undefined,
    // Custom fonts ship a single weight; setting fontWeight on them would synthesize bold.
    fontWeight: display ? undefined : (t.weight as TextStyle['fontWeight']),
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.tracking,
    fontVariant: ['tabular-nums', 'lining-nums'],
  };
}

export const FONT_FILES_NOTE =
  'Load Fraunces_600SemiBold from @expo-google-fonts/fraunces under the family name "Fraunces-SemiBold" with expo-font.';
