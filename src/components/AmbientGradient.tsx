import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '../design/theme';

interface AmbientGradientProps {
  /** Gradient stops, top to bottom (the sky ramps are authored and validated for a vertical read). */
  colors: string[];
  /**
   * Darkening scrim: linear from 5% black at the top to `scrimBottomOpacity` at the bottom. The token validator
   * (scripts/sync-tokens.mjs) checks hero-text contrast against exactly this model. Defaults to 0.
   */
  scrimBottomOpacity?: number;
}

interface Layer {
  id: number;
  colors: string[];
  v: Animated.Value;
}

const key = (c: string[]) => c.join('|');
/** Colour changes this soon after returning to the foreground snap instead of fading. */
const RESUME_SNAP_MS = 2500;

function Sky({ colors }: { colors: string[] }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* A faint opposing diagonal keeps the soft, non-banded atmosphere of the original two-gradient sky. */}
      <LinearGradient colors={colors} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, styles.cross]} />
    </View>
  );
}

/**
 * Ambient sky background. When `colors` change (a prayer-stage boundary) the new sky fades in over the old one
 * once, slowly (motion.duration.skyCrossfade, 4 s); there is no continuous blend toward the next stage.
 * Skies are stacked as layers, so a change that lands mid-fade keeps the half-faded layer underneath instead of
 * jumping. The fade is skipped when the app has just returned to the foreground, and shortens to the reduced
 * fade under Reduce Motion.
 */
export default function AmbientGradient({ colors, scrimBottomOpacity = 0 }: AmbientGradientProps) {
  const { motion, reduceMotion } = useTheme();
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, colors, v: new Animated.Value(1) }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const shown = useRef(key(colors));
  const lastActiveAt = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') lastActiveAt.current = Date.now();
    });
    return () => {
      sub.remove();
      layersRef.current.forEach((l) => l.v.stopAnimation());
    };
  }, []);

  useEffect(() => {
    if (key(colors) === shown.current) return;
    shown.current = key(colors);

    if (Date.now() - lastActiveAt.current < RESUME_SNAP_MS) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, colors, v: new Animated.Value(1) }]);
      return;
    }

    const layer: Layer = { id: nextId.current++, colors, v: new Animated.Value(0) };
    setLayers((cur) => [...cur, layer]);
    Animated.timing(layer.v, {
      toValue: 1,
      duration: reduceMotion ? motion.duration.reducedFade : motion.duration.skyCrossfade,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Fully faded in: everything beneath it is hidden, so drop it.
      if (finished) setLayers((cur) => cur.slice(Math.max(0, cur.findIndex((l) => l.id === layer.id))));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {layers.map((l, i) =>
        i === 0 ? (
          <Sky key={l.id} colors={l.colors} />
        ) : (
          <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { opacity: l.v }]}>
            <Sky colors={l.colors} />
          </Animated.View>
        ),
      )}
      {scrimBottomOpacity > 0 && (
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', `rgba(0,0,0,${scrimBottomOpacity})`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cross: { opacity: 0.3 },
});
