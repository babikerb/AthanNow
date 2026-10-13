import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '../design/theme';
import { useResumeSnap } from '../hooks/useResumeSnap';
import { colorTokens } from '../design/tokens.generated';

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
const alphaHex = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

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
  const recentlyResumed = useResumeSnap();

  useEffect(() => () => layersRef.current.forEach((l) => l.v.stopAnimation()), []);

  useEffect(() => {
    if (key(colors) === shown.current) return;
    shown.current = key(colors);

    if (recentlyResumed()) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, colors, v: new Animated.Value(1) }]);
      return;
    }

    const layer: Layer = { id: nextId.current++, colors, v: new Animated.Value(0) };
    // At most three skies stacked (outgoing, still-fading, incoming) so a rapid second change never pops a half-faded layer.
    setLayers((cur) => [...cur.slice(-2), layer]);
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
      {layers.map((l) => (
        <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { opacity: l.v }]}>
          <Sky colors={l.colors} />
        </Animated.View>
      ))}
      {/* Static noise tile: breaks up 8-bit banding on the large dark ramps. Mounted once, above the skies, below the scrim. */}
      <Image source={DITHER} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.dither]} fadeDuration={0} accessibilityElementsHidden importantForAccessibility="no" />
      {scrimBottomOpacity > 0 && (
        <LinearGradient
          colors={[`${colorTokens.dark.scrimBase}${alphaHex(0.05)}`, `${colorTokens.dark.scrimBase}${alphaHex(scrimBottomOpacity)}`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DITHER = require('../../assets/dither.png');

const styles = StyleSheet.create({
  cross: { opacity: 0.3 },
  // ~1 LSB of noise on 8-bit ramps: enough to break banding without visible grain.
  dither: { opacity: 0.013, pointerEvents: 'none' },
});
