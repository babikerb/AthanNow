import { NavigationContext } from '@react-navigation/native';
import React, { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../design/theme';
import { SCENES, ScenePeriod } from './palettes';
import { Cloud, cloudLook, cloudSet, starPoints } from './SkyIllustration';

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
 * The moving parts of the full-screen sky, drawn over the still illustration:
 * - twinkling stars, and a shooting star now and then at Isha and night;
 * - clouds drifting slowly at sunrise and by day;
 * - morning mist lying in the valley at sunrise;
 * - the mosque's windows lighting up at Maghrib and staying lit through Isha, the night and Fajr;
 * - a red and white plane that flies by at Dhuhr and Asr.
 * Every animation runs on the native driver. With Reduce Motion they hold still (lights and mist
 * still show), and nothing moves while Home is off screen.
 */
function SkyLifeImpl({ period, width, height, clearTop, groundLift, zone }: Props) {
  const scene = SCENES[period];
  const { reduceMotion } = useTheme();
  const focused = useFocusedSafe();
  const still = reduceMotion || !focused;
  const stars = useMemo(() => starPoints(period, width, height, clearTop, groundLift), [period, width, height, clearTop, groundLift]);
  // Scene-unit mapping (same as the full-layout illustration).
  const s = width / 390;
  const shift = height / s - 340 - groundLift / s;
  const zTop = zone ? zone.top / s : 0;
  const zH = zone ? Math.max(0, zone.bottom - zone.top) / s : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((st, i) => (
        <Star key={i} index={i} x={st.x} y={st.y} r={st.r} opacity={st.o} still={still} />
      ))}
      {zone && (period === 'isha' || period === 'night') && <ShootingStar width={width} top={clearTop} bottom={zone.bottom} still={still} />}
      {zone && scene.clouds && cloudSet(zTop, zH).map((c, i) => <DriftingCloud key={i} cloud={c} s={s} period={period} still={still} />)}
      {period === 'sunrise' && <Mist s={s} shift={shift} still={still} />}
      <Windows period={period} s={s} shift={shift} width={width} height={height} still={still} />
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

/** One full-layout cloud, swaying slowly sideways so the sun passes behind it. */
function DriftingCloud({ cloud, s, period, still }: { cloud: ReturnType<typeof cloudSet>[number]; s: number; period: ScenePeriod; still: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) {
      x.setValue(0);
      return;
    }
    const half = cloud.period / 2;
    const sway = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: cloud.drift * s, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    sway.start();
    return () => sway.stop();
  }, [still, cloud.drift, cloud.period, s, x]);
  const { tint, alpha } = cloudLook(period);
  // A box around the cloud in scene units, drawn at screen scale.
  const bx = cloud.x - 16;
  const by = cloud.y - cloud.h * 1.45;
  const bw = cloud.w * 1.3 + 32;
  const bh = cloud.h * 1.7;
  return (
    <Animated.View style={{ position: 'absolute', left: bx * s, top: by * s, width: bw * s, height: bh * s, transform: [{ translateX: x }] }}>
      <Svg width={bw * s} height={bh * s} viewBox={`${bx} ${by} ${bw} ${bh}`}>
        <Cloud x={cloud.x} y={cloud.y} w={cloud.w} h={cloud.h} tint={tint} alpha={alpha * cloud.a} />
      </Svg>
    </Animated.View>
  );
}

/** A thin streak across the night sky every 35 to 60 seconds, gone in under a second. */
function ShootingStar({ width, top, bottom, still }: { width: number; top: number; bottom: number; still: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  const [spot, setSpot] = useState({ x: width * 0.6, y: top + 30 });
  useEffect(() => {
    if (still) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const next = (first: boolean) => {
      t = setTimeout(() => {
        if (cancelled) return;
        setSpot({ x: width * (0.35 + Math.random() * 0.5), y: top + 12 + Math.random() * Math.max(20, (bottom - top) * 0.6) });
        p.setValue(0);
        Animated.timing(p, { toValue: 1, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => next(false));
      }, first ? 6000 + Math.random() * 6000 : 35000 + Math.random() * 25000);
    };
    next(true);
    return () => {
      cancelled = true;
      clearTimeout(t);
      p.stopAnimation();
    };
  }, [still, width, top, bottom, p]);
  if (still) return null;
  const L = 86;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: spot.x,
        top: spot.y,
        width: L,
        height: 2,
        opacity: p.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [
          { rotate: '-28deg' },
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) },
        ],
      }}
    >
      <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, borderRadius: 1 }} />
    </Animated.View>
  );
}

/**
 * Sunrise mist: soft bands of fog lying between the hills, drifting slowly and breathing a little.
 * Drawn with soft-edged radial fills at low opacity.
 */
function Mist({ s, shift, still }: { s: number; shift: number; still: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) {
      a.setValue(0);
      b.setValue(0);
      breathe.setValue(1);
      return;
    }
    const sway = (v: Animated.Value, dx: number, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: dx * s, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const loops = [
      sway(a, 30, 22000),
      sway(b, -24, 27000),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 0.7, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [still, s, a, b, breathe]);

  // Bands in scene units: one along the far ridge, one in the lower valley.
  const band = (cy: number, rx: number, ry: number, opacity: number, v: Animated.Value, key: string) => {
    const left = (195 - rx - 40) * s;
    const top = (cy + shift - ry) * s;
    const w = (rx * 2 + 80) * s;
    const h = ry * 2 * s;
    return (
      <Animated.View key={key} style={{ position: 'absolute', left, top, width: w, height: h, opacity: breathe, transform: [{ translateX: v }] }}>
        <Svg width={w} height={h} viewBox={`0 0 ${rx * 2 + 80} ${ry * 2}`}>
          <Defs>
            <RadialGradient id={`mist${key}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#F6E2D6" stopOpacity={opacity} />
              <Stop offset="0.6" stopColor="#F6E2D6" stopOpacity={opacity * 0.55} />
              <Stop offset="1" stopColor="#F6E2D6" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={rx + 40} cy={ry} rx={rx + 40} ry={ry} fill={`url(#mist${key})`} />
        </Svg>
      </Animated.View>
    );
  };
  return (
    <>
      {band(232, 230, 16, 0.42, a, 'far')}
      {band(272, 260, 18, 0.32, b, 'valley')}
    </>
  );
}

// The mosque's windows (scene units, matching the skyline in SkyIllustration): arched openings in
// the prayer hall and the arcade, slits in the minarets, dots round the drum.
const WINDOWS: { x: number; y: number; w: number; h: number }[] = [
  // prayer hall arches
  ...[243, 263, 283, 303, 323].map((x) => ({ x: x - 3.5, y: 297, w: 7, h: 13 })),
  // drum
  ...[258, 270, 282, 294, 306].map((x) => ({ x: x - 1.5, y: 279, w: 3, h: 3 })),
  // left arcade under the low dome
  ...[34, 52, 70, 88, 106].map((x) => ({ x: x - 3, y: 304, w: 6, h: 10 })),
  // minaret slits
  { x: 215.5, y: 244, w: 3, h: 7 },
  { x: 215.5, y: 276, w: 3, h: 7 },
  { x: 349.5, y: 250, w: 3, h: 7 },
  { x: 349.5, y: 282, w: 3, h: 7 },
  { x: 142, y: 276, w: 3, h: 6 },
  // side dome building
  { x: 372, y: 305, w: 6, h: 9 },
];
// How lit the windows are in each period.
const LIT: Record<ScenePeriod, number> = { fajr: 1, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 1, isha: 1, night: 0.8 };

/** Warm light in the mosque's windows. At Maghrib it comes on gradually over a few seconds. */
function Windows({ period, s, shift, width, height, still }: { period: ScenePeriod; s: number; shift: number; width: number; height: number; still: boolean }) {
  const level = LIT[period];
  const v = useRef(new Animated.Value(period === 'maghrib' && !still ? 0 : level)).current;
  useEffect(() => {
    if (period !== 'maghrib' || still) {
      v.setValue(level);
      return;
    }
    const on = Animated.timing(v, { toValue: level, duration: 5000, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    on.start();
    return () => on.stop();
  }, [period, still, level, v]);
  if (level === 0) return null;
  const vbH = height / s;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
      <Svg width={width} height={height} viewBox={`0 0 390 ${vbH}`}>
        <G transform={`translate(0 ${shift})`} fill="#F4C46A">
          {WINDOWS.map((w, i) =>
            w.h > w.w * 1.4 ? (
              // arched top
              <Path key={i} d={`M${w.x} ${w.y + w.h} V${w.y + w.w / 2} A${w.w / 2} ${w.w / 2} 0 0 1 ${w.x + w.w} ${w.y + w.w / 2} V${w.y + w.h} Z`} opacity={0.85 + (i % 3) * 0.05} />
            ) : (
              <Rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx={w.w / 2} opacity={0.9} />
            ),
          )}
        </G>
      </Svg>
    </Animated.View>
  );
}
