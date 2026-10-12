import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type TextStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { colorTokens, skyStages, typeTokens, type SkyStage } from '../design/tokens';
import { useTheme } from '../design/theme';

/**
 * iOS widget sizes in points on a 393pt-wide iPhone (15/16 class; the 390pt 12-14 class is 158/338/354). These are the exact proportions the WidgetKit
 * versions must match; `radius` is the system widget corner and `padding` the content inset.
 */
export const WIDGET_SIZES = {
  small: { width: 170, height: 170 },
  medium: { width: 364, height: 170 },
  large: { width: 364, height: 382 },
} as const;
export const WIDGET_RADIUS = 22;
export const WIDGET_PADDING = 16;

export type WidgetFamily = keyof typeof WIDGET_SIZES;

/** Widgets always sit on the night/dusk sky, so they read the dark tokens regardless of app appearance. */
export const wc = colorTokens.dark;

const alphaHex = (a: number) => Math.round(a * 255).toString(16).padStart(2, '0');

/** Display numeral style (Fraunces SemiBold, tabular). */
export const numeral = (size: number): TextStyle =>
  ({
    fontFamily: typeTokens.families.display,
    fontSize: size,
    lineHeight: Math.round(size * 1.08),
    letterSpacing: -size * 0.03,
    fontVariant: ['tabular-nums', 'lining-nums'],
    color: wc.skyText,
  }) as TextStyle;

interface FrameProps {
  family: WidgetFamily;
  stage: SkyStage;
  /** Visual scale for thumbnails (1 = real size). Layout stays at real size, then is scaled. */
  scale?: number;
  children: React.ReactNode;
}

/** The widget container: sky ramp for the current prayer stage, the stage scrim, a gentle mount fade, no border or shadow. */
export function WidgetFrame({ family, stage, scale = 1, children }: FrameProps) {
  const { reduceMotion } = useTheme();
  const { width, height } = WIDGET_SIZES[family];
  const sky = skyStages[stage] ?? skyStages.isha;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (!reduceMotion) Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [opacity, reduceMotion]);

  return (
    <View style={{ width: width * scale, height: height * scale }}>
      <Animated.View
        style={{
          width,
          height,
          borderRadius: WIDGET_RADIUS,
          borderCurve: 'continuous',
          overflow: 'hidden',
          opacity,
          transformOrigin: [0, 0, 0],
          transform: [{ scale }],
        }}
      >
        <LinearGradient colors={[...sky.colors]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`${colorTokens.dark.scrimBase}${alphaHex(0.05)}`, `${colorTokens.dark.scrimBase}${alphaHex(sky.scrimBottom)}`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, padding: WIDGET_PADDING }}>{children}</View>
      </Animated.View>
    </View>
  );
}
