import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('screen');

type Period = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface Props {
  prayer: Period;
  /** The upcoming prayer period, used to cross-fade the sky during transitions. */
  nextPrayer?: Period;
  /**
   * How far we are into the transition toward `nextPrayer` (0..1). At 0 only the
   * current scene shows; as it rises the current celestial body fades out and the
   * next one fades in, so e.g. the Fajr moon dissolves into the sunrise sun.
   */
  progress?: number;
  /** Absolute Y where the sky strip starts (below the location pill). */
  skyAreaY: number;
}

function getArc(skyAreaY: number) {
  const remaining = H - skyAreaY;
  const skyH = remaining * 0.1;
  return { cx: W * 0.5, cy: skyAreaY + skyH, a: W * 0.44, b: skyH * 0.65 };
}

function arcXY(cx: number, cy: number, a: number, b: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + a * Math.cos(rad), y: cy - b * Math.sin(rad) };
}

const ARC: Record<Exclude<Period, 'sunrise'>, { deg: number; body: 'sun' | 'moon' }> = {
  fajr: { deg: 152, body: 'moon' },
  dhuhr: { deg: 100, body: 'sun' },
  asr: { deg: 65, body: 'sun' },
  maghrib: { deg: 30, body: 'moon' },
  isha: { deg: 22, body: 'moon' },
};

interface StarDef { lf: number; tf: number; r: number; op: number }

const FAJR_STARS: StarDef[] = [
  { lf: 0.1, tf: 0.15, r: 1.1, op: 0.5 }, { lf: 0.23, tf: 0.13, r: 0.8, op: 0.38 },
  { lf: 0.38, tf: 0.17, r: 1.0, op: 0.45 }, { lf: 0.54, tf: 0.14, r: 0.7, op: 0.4 },
  { lf: 0.67, tf: 0.16, r: 1.2, op: 0.5 }, { lf: 0.88, tf: 0.14, r: 0.9, op: 0.45 },
  { lf: 0.3, tf: 0.19, r: 0.7, op: 0.28 }, { lf: 0.6, tf: 0.19, r: 0.8, op: 0.3 },
];
const MAGHRIB_STARS: StarDef[] = [
  { lf: 0.09, tf: 0.14, r: 0.9, op: 0.28 }, { lf: 0.25, tf: 0.13, r: 0.7, op: 0.22 },
  { lf: 0.55, tf: 0.15, r: 1.0, op: 0.3 }, { lf: 0.72, tf: 0.17, r: 0.8, op: 0.25 },
  { lf: 0.91, tf: 0.14, r: 1.0, op: 0.28 },
];
const ISHA_STARS: StarDef[] = [
  { lf: 0.06, tf: 0.14, r: 1.2, op: 0.78 }, { lf: 0.17, tf: 0.19, r: 0.8, op: 0.58 },
  { lf: 0.28, tf: 0.15, r: 1.0, op: 0.7 }, { lf: 0.41, tf: 0.13, r: 0.9, op: 0.6 },
  { lf: 0.5, tf: 0.18, r: 1.4, op: 0.82 }, { lf: 0.62, tf: 0.14, r: 0.7, op: 0.52 },
  { lf: 0.71, tf: 0.19, r: 1.1, op: 0.72 }, { lf: 0.83, tf: 0.15, r: 0.8, op: 0.63 },
  { lf: 0.93, tf: 0.17, r: 1.0, op: 0.68 },
];
const STARS_FOR: Partial<Record<Period, StarDef[]>> = { fajr: FAJR_STARS, maghrib: MAGHRIB_STARS, isha: ISHA_STARS };

function TwinklingStarField({ stars }: { stars: StarDef[] }) {
  const anims = useRef(stars.map((s) => new Animated.Value(s.op))).current;
  useEffect(() => {
    const handles = anims.map((anim, i) => {
      const half = 900 + ((i * 373) % 1300);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: stars[i].op * 0.1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: stars[i].op, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      const t = setTimeout(() => loop.start(), (i * 260) % 2800);
      return { loop, t };
    });
    return () => handles.forEach(({ loop, t }) => { clearTimeout(t); loop.stop(); });
  }, [anims, stars]);

  return (
    <>
      {stars.map((s, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: s.lf * W - s.r, top: s.tf * H - s.r, width: s.r * 2, height: s.r * 2, borderRadius: s.r, backgroundColor: '#FFFFFF', opacity: anims[i] }} />
      ))}
    </>
  );
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * A slow "breathing" loop (0 -> 1 -> 0). `half` is the milliseconds for each
 * direction, so a full cycle is 2 * half. Used to gently pulse celestial glows —
 * deliberately slow (several seconds) so the sky feels alive, not busy.
 */
function useSlowPulse(half: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, half]);
  return v;
}

function ActiveSun({ x, y, prayer }: { x: number; y: number; prayer: Period }) {
  const cfg = {
    dhuhr: { r: 22, glow: 'rgba(255,252,200,0.38)', rays: true },
    asr: { r: 16, glow: 'rgba(200,144,56,0.28)', rays: false },
    maghrib: { r: 11, glow: 'rgba(220,110,40,0.22)', rays: false },
  } as const;
  const { r, glow, rays } = cfg[prayer as keyof typeof cfg] ?? { r: 16, glow: 'rgba(255,252,200,0.28)', rays: false };
  const RAY_LEN = 9;
  const RAY_GAP = 4;

  // Slow glow pulse — asr breathes the slowest, then maghrib, then dhuhr.
  const pulse = useSlowPulse(prayer === 'asr' ? 5200 : prayer === 'maghrib' ? 4400 : 3800);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.14] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <>
      <Animated.View style={{ position: 'absolute', left: x - r - 12, top: y - r - 12, width: (r + 12) * 2, height: (r + 12) * 2, borderRadius: r + 12, backgroundColor: glow, opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <Animated.View style={{ position: 'absolute', left: x - r - 5, top: y - r - 5, width: (r + 5) * 2, height: (r + 5) * 2, borderRadius: r + 5, backgroundColor: 'rgba(255,252,210,0.15)', opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#FFF6CC' }} />
      {rays && RAY_ANGLES.map((deg) => {
        const isDiag = deg % 90 !== 0;
        const len = isDiag ? RAY_LEN * 0.6 : RAY_LEN;
        const dist = r + RAY_GAP + len / 2;
        const rad = (deg * Math.PI) / 180;
        const rx = x + dist * Math.sin(rad);
        const ry = y - dist * Math.cos(rad);
        return <View key={deg} style={{ position: 'absolute', left: rx - 1, top: ry - len / 2, width: 2, height: len, borderRadius: 1, backgroundColor: 'rgba(255,245,180,0.60)', transform: [{ rotate: `${deg}deg` }] }} />;
      })}
    </>
  );
}

function ActiveMoon({ x, y, prayer }: { x: number; y: number; prayer: Period }) {
  const isFajr = prayer === 'fajr';
  const size = isFajr ? 34 : 40;
  const shadowColor = isFajr ? '#0c0b1c' : '#070d18';
  const offsetX = isFajr ? 12 : -12;

  // A soft, steady moonlit halo. The moon never pulses; only the stars twinkle.
  const halo = size + 22;

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - halo / 2,
          top: y - halo / 2,
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: 'rgba(200,190,245,0.16)',
          opacity: 0.7,
        }}
      />
      <View style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, overflow: 'hidden', borderRadius: size / 2 }}>
        <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: 'rgba(200,185,240,0.62)' }]} />
        <View style={{ position: 'absolute', left: offsetX, top: -4, width: size, height: size, borderRadius: size / 2, backgroundColor: shadowColor }} />
      </View>
    </>
  );
}

function SunriseSun({ x, y }: { x: number; y: number }) {
  const r = 13;
  const pulse = useSlowPulse(4600);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.16] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <>
      <Animated.View style={{ position: 'absolute', left: x - r - 20, top: y - r - 20, width: (r + 20) * 2, height: (r + 20) * 2, borderRadius: r + 20, backgroundColor: 'rgba(190, 115, 20, 0.22)', opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <Animated.View style={{ position: 'absolute', left: x - r - 8, top: y - r - 8, width: (r + 8) * 2, height: (r + 8) * 2, borderRadius: r + 8, backgroundColor: 'rgba(210, 135, 30, 0.18)', opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#EFBE50' }} />
    </>
  );
}

/** One full celestial scene (stars + sun/moon) for a single prayer period. */
function PrayerScene({ prayer, arc, opacity }: { prayer: Period; arc: ReturnType<typeof getArc>; opacity: number }) {
  const { cx, cy, a, b } = arc;
  if (prayer === 'sunrise') {
    const { x, y } = arcXY(cx, cy, a, b, 130);
    return (
      <View style={[StyleSheet.absoluteFill, { opacity }]}>
        <SunriseSun x={x} y={y} />
      </View>
    );
  }
  const stars = STARS_FOR[prayer];
  const { deg, body } = ARC[prayer];
  const { x, y } = arcXY(cx, cy, a, b, deg);
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]}>
      {stars && <TwinklingStarField key={prayer} stars={stars} />}
      {body === 'sun' ? <ActiveSun x={x} y={y} prayer={prayer} /> : <ActiveMoon x={x} y={y} prayer={prayer} />}
    </View>
  );
}

export default function SkyScene({ prayer, nextPrayer, progress = 0, skyAreaY }: Props) {
  const arc = useMemo(() => getArc(skyAreaY), [skyAreaY]);

  // Clamp and only treat it as a transition when there's a distinct next period.
  const t = nextPrayer && nextPrayer !== prayer ? Math.max(0, Math.min(1, progress)) : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <PrayerScene prayer={prayer} arc={arc} opacity={1 - t} />
      {t > 0 && nextPrayer && <PrayerScene prayer={nextPrayer} arc={arc} opacity={t} />}
    </View>
  );
}
