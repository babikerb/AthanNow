import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../design/theme';
import { useResumeSnap } from '../hooks/useResumeSnap';
import { blendsFully, type SkyBlend } from './sky/blend';
import { moonPhase, type MoonPhase } from './sky/moon';
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
  /** Windows appear already lit with the buildings instead of lighting up at Maghrib. */
  windowsLit?: boolean;
  /** Part-way to the next prayer's sky (full layout). */
  blend?: SkyBlend | null;
  /** The moon's phase (default: today's, seen from the north). */
  moon?: MoonPhase;
}

// What is left of a fade whose colours had to stop short for the text.
const FINISH_MS = 1600;

interface Layer {
  id: number;
  period: ScenePeriod;
  v: Animated.Value;
  /** Set on a layer being left: the fade it had reached. */
  left?: SkyBlend | null;
  /** Finishing a fade: its windows are already lit. */
  arrived?: boolean;
}

/**
 * The illustrated sky (full screen on Home, a band in onboarding). In the minutes before a prayer it blends into the
 * next sky in place, so the prayer itself passes without a change. A period change with no blend behind it crossfades
 * the whole illustration once (shortened under Reduce Motion) and snaps if the app has just resumed.
 */
export default function SkyScene({ period, width, height, clearTop, layout, zone, arc, groundLift, instant, fadeMs, windowsLit, blend, moon }: Props) {
  const { motion, reduceMotion } = useTheme();
  const recentlyResumed = useResumeSnap();
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, period, v: new Animated.Value(1) }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const shown = useRef(period);
  const day = new Date().toDateString();
  const today = useMemo(() => moon ?? moonPhase(new Date()), [moon, day]); // eslint-disable-line react-hooks/exhaustive-deps
  // The blend last drawn for the sky on show, kept for the moment the period moves on from it.
  const lastBlend = useRef<SkyBlend | null>(null);
  const reached = lastBlend.current;
  useEffect(() => {
    if (shown.current === period) lastBlend.current = blend ?? null;
  });

  useEffect(() => () => layersRef.current.forEach((l) => l.v.stopAnimation()), []);

  useEffect(() => {
    if (period === shown.current) return;
    const was = shown.current;
    const from = lastBlend.current;
    shown.current = period;
    lastBlend.current = blend ?? null;
    const arriving = from?.to === period && from.k > 0.9;
    if (arriving && blendsFully(was, period) && !instant) {
      // Already drawn as the new sky: carry on in the same layer, so nothing restarts.
      setLayers((cur) => cur.map((l, i) => (i === cur.length - 1 ? { ...l, period } : l)));
      return;
    }
    if (instant || recentlyResumed()) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, period, v: new Animated.Value(1) }]);
      return;
    }
    // The new scene fades in over the old one, which stays opaque underneath so nothing flashes through.
    const layer: Layer = { id: nextId.current++, period, v: new Animated.Value(0), arrived: arriving };
    setLayers([...layersRef.current.slice(-1).map((l) => ({ ...l, left: from })), layer]);
    Animated.timing(layer.v, {
      toValue: 1,
      duration: reduceMotion ? motion.duration.reducedFade : arriving ? FINISH_MS : fadeMs ?? motion.duration.skyCrossfade,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setLayers((cur) => cur.filter((l) => l.id === layer.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <View style={{ width, height }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {layers.map((l) => {
        // A layer still on the previous period (leaving, or about to be moved on) keeps the fade it had reached.
        const at = l.period === period ? blend : l.left ?? reached;
        return (
          <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { opacity: l.v }]}>
            <SkyIllustration period={l.period} width={width} height={height} clearTop={clearTop} layout={layout} zone={zone} arc={arc} groundLift={groundLift} blend={at} moon={today} />
            {layout === 'full' && (
              <SkyLife
                period={l.period}
                width={width}
                height={height}
                clearTop={clearTop ?? 0}
                groundLift={groundLift ?? 0}
                zone={zone}
                windowsLit={windowsLit || l.arrived}
                blend={at}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}
