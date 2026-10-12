import React, { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

/** Low-contrast loading placeholder: surface2 block gently breathing between 55% and 100% opacity. Static under Reduce Motion. */
export function Skeleton({ width = '100%', height = 16, radius, tone = 'surface2', style }: { width?: DimensionValue; height?: number; radius?: number; tone?: 'surface2' | 'surface3'; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (t.reduceMotion) {
      v.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t.reduceMotion, v]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ width, height, borderRadius: radius ?? t.radii.control, borderCurve: 'continuous', backgroundColor: t.c[tone], opacity: v }, style]}
    />
  );
}
