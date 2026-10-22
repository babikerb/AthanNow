import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from './theme';
import { typeTokens, type Palette, type TypeVariant } from './tokens';

export type TextColor = Extract<
  keyof Palette,
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'accentText'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onAccent'
  | 'skyText'
  | 'skyTextSecondary'
>;

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: TextColor;
  /** Marks the element as a heading for VoiceOver. */
  header?: boolean;
}

/** Themed text. Always scales with Dynamic Type; tabular + lining figures come from the variant. */
export function Text({ variant = 'body', color = 'text', header, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <RNText
      accessibilityRole={header ? 'header' : rest.accessibilityRole}
      allowFontScaling
      // Display-family sizes are large and wide; cap them (BRAND.md section 2). Callers can override.
      maxFontSizeMultiplier={typeTokens.scale[variant].family === 'display' ? 1.3 : undefined}
      {...rest}
      style={[t.type(variant), { color: t.c[color] }, style]}
    />
  );
}
