import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

export type SurfaceTone = 'bg' | 'surface1' | 'surface2' | 'surface3';
export type RadiusRole = 'control' | 'card' | 'feature' | 'sheet';

export interface SurfaceProps extends ViewProps {
  tone?: SurfaceTone;
  radius?: RadiusRole;
  /** 1px hairline border. Drop it on a surface that sits on a clearly different tone. */
  hairline?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/** Depth through tonal steps + hairline, never shadows (BRAND.md section 3). */
export function Surface({ tone = 'surface1', radius = 'card', hairline = true, padding, style, ...rest }: SurfaceProps) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: t.c[tone], borderRadius: t.radii[radius], borderCurve: 'continuous', padding },
        hairline && { borderWidth: StyleSheet.hairlineWidth, borderColor: t.c.hairline },
        style,
      ]}
    />
  );
}

/** Standard content card: surface1, card radius, 16 padding. */
export function Card(props: SurfaceProps) {
  const t = useTheme();
  return <Surface tone="surface1" radius="card" padding={t.spacing.lg} {...props} />;
}
