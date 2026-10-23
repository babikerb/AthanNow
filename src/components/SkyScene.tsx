import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../design/theme';
import { useResumeSnap } from '../hooks/useResumeSnap';
import { SkyIllustration } from './sky/SkyIllustration';
import { ScenePeriod } from './sky/palettes';

export type { ScenePeriod } from './sky/palettes';

interface Props {
  period: ScenePeriod;
  width: number;
  height: number;
  /** Height of chrome over the top of the scene; the sun or moon stays below it. */
  clearTop?: number;
}

interface Layer {
  id: number;
  period: ScenePeriod;
  v: Animated.Value;
}

/**
 * The illustrated sky band at the top of Home. Still within a period; a period change crossfades
 * the whole illustration once (shortened under Reduce Motion) and snaps if the app has just resumed.
 */
export default function SkyScene({ period, width, height, clearTop }: Props) {
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
    if (recentlyResumed()) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, period, v: new Animated.Value(1) }]);
      return;
    }
    // The new scene fades in over the old one, which stays opaque underneath so nothing flashes through.
    const layer: Layer = { id: nextId.current++, period, v: new Animated.Value(0) };
    setLayers([...layersRef.current.slice(-1), layer]);
    Animated.timing(layer.v, {
      toValue: 1,
      duration: reduceMotion ? motion.duration.reducedFade : motion.duration.skyCrossfade,
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
          <SkyIllustration period={l.period} width={width} height={height} clearTop={clearTop} />
        </Animated.View>
      ))}
    </View>
  );
}
