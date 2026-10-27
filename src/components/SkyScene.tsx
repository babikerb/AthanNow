import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../design/theme';
import { useResumeSnap } from '../hooks/useResumeSnap';
import { SkyIllustration } from './sky/SkyIllustration';
import { SkyLife } from './sky/SkyLife';
import { ScenePeriod } from './sky/palettes';

export type { ScenePeriod } from './sky/palettes';

interface Props {
  period: ScenePeriod;
  width: number;
  height: number;
  /** Height of chrome over the top of the scene; the sun or moon stays below it. */
  clearTop?: number;
  layout?: 'band' | 'full';
  /** Full layout: the open sky (pt) kept free of text. */
  zone?: { top: number; bottom: number };
  /** Full layout: 0..1 position of the sun or moon along its arc. */
  arc?: number;
  groundLift?: number;
  /** Swap scenes immediately instead of crossfading (the development scene switcher). */
  instant?: boolean;
  /** Crossfade length when the period changes (default: the theme's slow sky crossfade). */
  fadeMs?: number;
}

interface Layer {
  id: number;
  period: ScenePeriod;
  v: Animated.Value;
}

/**
 * The illustrated sky (full screen on Home, a band in onboarding). Still within a period; a period change crossfades
 * the whole illustration once (shortened under Reduce Motion) and snaps if the app has just resumed.
 */
export default function SkyScene({ period, width, height, clearTop, layout, zone, arc, groundLift, instant, fadeMs }: Props) {
  const { motion, reduceMotion } = useTheme();
  const recentlyResumed = useResumeSnap();
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, period, v: new Animated.Value(1) }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const shown = useRef(period);

  useEffect(() => () => layersRef.current.forEach((l) => l.v.stopAnimation()), []);

  useEffect(() => {
    if (period === shown.current) return;
    shown.current = period;
    if (instant || recentlyResumed()) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, period, v: new Animated.Value(1) }]);
      return;
    }
    // The new scene fades in over the old one, which stays opaque underneath so nothing flashes through.
    const layer: Layer = { id: nextId.current++, period, v: new Animated.Value(0) };
    setLayers([...layersRef.current.slice(-1), layer]);
    Animated.timing(layer.v, {
      toValue: 1,
      duration: reduceMotion ? motion.duration.reducedFade : fadeMs ?? motion.duration.skyCrossfade,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setLayers((cur) => cur.filter((l) => l.id === layer.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <View style={{ width, height }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {layers.map((l) => (
        <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { opacity: l.v }]}>
          <SkyIllustration period={l.period} width={width} height={height} clearTop={clearTop} layout={layout} zone={zone} arc={arc} groundLift={groundLift} />
          {layout === 'full' && <SkyLife period={l.period} width={width} height={height} clearTop={clearTop ?? 0} groundLift={groundLift ?? 0} zone={zone} />}
        </Animated.View>
      ))}
    </View>
  );
}
