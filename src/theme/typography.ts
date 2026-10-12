/**
 * Legacy type scale, now derived from design/tokens.json (single source of truth). Kept so files that have not moved
 * to `src/design/Text` still spread `...type.body` etc. New code should use `textStyle(variant)` from `src/design`.
 * Display-family variants carry the bundled Fraunces SemiBold; everything else is the system font.
 */
import type { TextStyle } from 'react-native';

import { typeTokens } from '../design/tokens.generated';

type Variant = keyof typeof typeTokens.scale;

const make = (k: Variant): TextStyle => {
  const t = typeTokens.scale[k];
  const display = t.family === 'display';
  return {
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.tracking,
    ...(display ? { fontFamily: typeTokens.families.display } : { fontWeight: t.weight as TextStyle['fontWeight'] }),
  };
};

export const type = {
  caption2: make('caption2'),
  caption: make('caption'),
  footnote: make('footnote'),
  subhead: make('subhead'),
  body: make('body'),
  bodyEmph: make('bodyEmph'),
  headline: make('headline'),
  title3: make('title3'),
  title2: make('title2'),
  title1: make('title1'),
  display: make('display'),
  hero: make('hero'),
} as const;

export type TypeToken = keyof typeof type;

/** The display typeface family name (bundled via expo-font in App.tsx). */
export const HEADLINE_FONT_FAMILY: string = typeTokens.families.display;
