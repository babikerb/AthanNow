import { NavigationContext } from '@react-navigation/native';
import React, { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '../../design/theme';
import { SCENES, ScenePeriod } from './palettes';
import { starPoints } from './SkyIllustration';

interface Props {
  period: ScenePeriod;
  width: number;
  height: number;
  clearTop: number;
  groundLift: number;
  /** The open sky (pt) kept free of text. */
  zone?: { top: number; bottom: number };
}

/**
 * The moving parts of the full-screen sky, drawn over the still illustration: twinkling stars and a
 * red and white plane that flies by now and then. Every animation runs
 * on the native driver. With Reduce Motion they hold still, and nothing runs while Home is off screen.
 */
function SkyLifeImpl({ period, width, height, clearTop, groundLift, zone }: Props) {
  const scene = SCENES[period];
  const { reduceMotion } = useTheme();
  const focused = useFocusedSafe();
  const still = reduceMotion || !focused;
  const stars = useMemo(() => starPoints(period, width, height, clearTop, groundLift), [period, width, height, clearTop, groundLift]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((st, i) => (
        <Star key={i} index={i} x={st.x} y={st.y} r={st.r} opacity={st.o} still={still} />
      ))}
      {zone && scene.plane && <Plane width={width} y={zone.top + (zone.bottom - zone.top) * 0.34} still={still} />}
    </View>
  );
}

export const SkyLife = memo(SkyLifeImpl);

/** Focus of the enclosing screen; true outside a navigator (the launch overlay). */
function useFocusedSafe() {
  const nav = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => nav?.isFocused() ?? true);
  useEffect(() => {
    if (!nav) return;
    const a = nav.addListener('focus', () => setFocused(true));
    const b = nav.addListener('blur', () => setFocused(false));
    return () => {
      a();
      b();
    };
  }, [nav]);
  return focused;
}

function Star({ index, x, y, r, opacity, still }: { index: number; x: number; y: number; r: number; opacity: number; still: boolean }) {
  const v = useRef(new Animated.Value(opacity)).current;
  useEffect(() => {
    if (still) {
      v.setValue(opacity);
      return;
    }
    // Each star keeps its own slow rhythm so the field shimmers rather than pulsing together.
    const half = 1100 + ((index * 373) % 1700);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: opacity * 0.2, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: opacity, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => loop.start(), (index * 211) % 2600);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [still, opacity, index, v]);
  const d = Math.max(1.6, r * 2.2);
  return <Animated.View style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: '#FFFFFF', opacity: v }} />;
}

const PLANE_W = 56;
const PLANE_H = 18;
const TRAIL_W = 190;

/** A red and white airliner with a fading contrail, crossing every so often. */
function Plane({ width, y, still }: { width: number; y: number; still: boolean }) {
  const x = useRef(new Animated.Value(-(PLANE_W + TRAIL_W))).current;
  useEffect(() => {
    if (still) {
      x.setValue(-(PLANE_W + TRAIL_W));
      return;
    }
    const fly = Animated.loop(
      Animated.sequence([
        Animated.delay(4000),
        Animated.timing(x, { toValue: width + 20, duration: 24000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(x, { toValue: -(PLANE_W + TRAIL_W), duration: 0, useNativeDriver: true }),
        Animated.delay(18000),
      ]),
    );
    fly.start();
    return () => fly.stop();
  }, [still, width, x]);

  if (still) return null;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: y - PLANE_H / 2,
        left: 0,
        width: TRAIL_W + PLANE_W,
        height: PLANE_H,
        flexDirection: 'row',
        alignItems: 'center',
        transform: [{ translateX: x }, { rotate: '-4deg' }],
      }}
    >
      {/* Two engine trails, fading out behind the plane. */}
      <View style={{ width: TRAIL_W, height: 6, justifyContent: 'space-between', marginRight: -4 }}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, borderRadius: 1 }} />
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 1.5, borderRadius: 1 }} />
      </View>
      <Svg width={PLANE_W} height={PLANE_H} viewBox="0 0 56 18">
        {/* Fin and tailplane */}
        <Path d="M6 6.2 L2.5 0.6 L8 0.6 L14 6 Z" fill="#D7263D" />
        <Path d="M5.5 10 L1 12.2 L9 11.6 Z" fill="#D7263D" />
        {/* Fuselage */}
        <Path d="M4 9.2 C4 6.8 7 5.8 12 5.8 L45 5.8 C50.5 5.8 55 7.4 55 9.2 C55 11 50.5 12.4 45 12.4 L10 12.4 C6 12.4 4 11.4 4 9.2 Z" fill="#F7F7F9" />
        {/* Cheatline and nose */}
        <Rect x={10} y={8.6} width={38} height={1.3} fill="#D7263D" />
        <Path d="M48.5 7.2 L52 7.9 L51 8.6 L48 8.4 Z" fill="#2A3240" />
        {/* Wing and engine */}
        <Path d="M24 9.6 L33 16.6 L37.5 16.6 L31.5 9.6 Z" fill="#D9DAE0" />
        <Rect x={28} y={12} width={6} height={2.4} rx={1.2} fill="#BFC1C9" />
      </Svg>
    </Animated.View>
  );
}
