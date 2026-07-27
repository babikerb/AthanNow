import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Mask, Path, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';

const { width: W, height: H } = Dimensions.get('screen');

type Period = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface Props {
  /** Which stage to show — the sky switches directly, no cross-fade/blend
   *  toward the next stage as its time approaches (removed per explicit
   *  feedback; each stage renders discretely). */
  prayer: Period;
  /** Absolute Y where the sky strip starts (below the location pill). */
  skyAreaY: number;
}

// The body travels along a shallow ellipse anchored just below the header. `b`
// (vertical radius) is deliberately small relative to `a` (horizontal radius) —
// a wide, gentle arc reads as "the sky" without the body wandering into the
// content below it.
function getArc(skyAreaY: number) {
  const remaining = H - skyAreaY;
  const skyH = remaining * 0.1;
  return { cx: W * 0.5, cy: skyAreaY + skyH, a: W * 0.42, b: skyH * 0.72 };
}

function arcXY(cx: number, cy: number, a: number, b: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + a * Math.cos(rad), y: cy - b * Math.sin(rad) };
}

// Where each period's celestial body sits on the arc, and which body it is. During
// a transition we interpolate the position between the two so a single body travels
// across the strip (and, when the type changes, morphs sun<->moon in place) rather
// than two separate bodies cross-fading at two different spots.
const DEG: Record<Period, number> = {
  fajr: 152,
  sunrise: 130,
  dhuhr: 100,
  asr: 65,
  maghrib: 30,
  isha: 22,
};

const BODY: Record<Period, 'sun' | 'moon' | 'sunrise'> = {
  fajr: 'moon',
  sunrise: 'sunrise',
  dhuhr: 'sun',
  asr: 'sun',
  maghrib: 'moon',
  isha: 'moon',
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

// Static (no animation, matching the app's established motion restraint —
// stillness reads as premium here, not a missed opportunity for more
// movement) daytime atmosphere: a couple of soft, low-opacity clouds and a
// couple of small hand-drawn-style birds, gated to the bright daytime
// stages only (dhuhr/asr for clouds; dhuhr/asr/sunrise for birds — fajr/
// maghrib/isha are night/dusk scenes with stars, clouds and birds wouldn't
// read there). Kept deliberately sparse (2 of each, at most) — restraint
// over decoration, same as everywhere else in this app.
interface CloudDef { lf: number; tf: number; scale: number; op: number }
interface BirdDef { lf: number; tf: number; scale: number; flip?: boolean }

const DHUHR_CLOUDS: CloudDef[] = [
  { lf: 0.16, tf: 0.09, scale: 1, op: 0.5 },
  { lf: 0.74, tf: 0.13, scale: 0.7, op: 0.36 },
];
const ASR_CLOUDS: CloudDef[] = [{ lf: 0.2, tf: 0.11, scale: 0.8, op: 0.32 }];
const CLOUDS_FOR: Partial<Record<Period, CloudDef[]>> = { dhuhr: DHUHR_CLOUDS, asr: ASR_CLOUDS };

const DHUHR_BIRDS: BirdDef[] = [
  { lf: 0.4, tf: 0.07, scale: 1 },
  { lf: 0.47, tf: 0.095, scale: 0.65, flip: true },
];
const ASR_BIRDS: BirdDef[] = [{ lf: 0.58, tf: 0.08, scale: 0.85 }];
const SUNRISE_BIRDS: BirdDef[] = [{ lf: 0.72, tf: 0.085, scale: 0.9 }];
const BIRDS_FOR: Partial<Record<Period, BirdDef[]>> = { dhuhr: DHUHR_BIRDS, asr: ASR_BIRDS, sunrise: SUNRISE_BIRDS };

/** A soft 4-blob cloud silhouette — three overlapping "puffs" plus a base
 *  to fill the underside, all one flat low-opacity white fill. Intentionally
 *  simple flat shapes (not a gradient/blur) to match the app's icon-language
 *  restraint elsewhere, not a photoreal cloud. */
function Cloud({ def }: { def: CloudDef }) {
  const s = def.scale;
  const left = def.lf * W;
  const top = def.tf * H;
  return (
    <View style={{ position: 'absolute', left, top, opacity: def.op, width: 64 * s, height: 30 * s }} pointerEvents="none">
      <View style={{ position: 'absolute', left: 6 * s, top: 6 * s, width: 22 * s, height: 22 * s, borderRadius: 11 * s, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', left: 22 * s, top: 0, width: 26 * s, height: 26 * s, borderRadius: 13 * s, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', left: 40 * s, top: 8 * s, width: 20 * s, height: 20 * s, borderRadius: 10 * s, backgroundColor: '#FFFFFF' }} />
      <View style={{ position: 'absolute', left: 4 * s, top: 16 * s, width: 56 * s, height: 12 * s, borderRadius: 6 * s, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}

/** The classic minimalist "flying bird" doodle — two connected shallow
 *  curves (a wide, gentle "M"), stroke only, no fill. Exactly the "2
 *  curves" shorthand for a bird silhouette, drawn once, never animated. */
function Bird({ def }: { def: BirdDef }) {
  const s = def.scale;
  const w = 15 * s;
  const h = 5.5 * s;
  const left = def.lf * W;
  const top = def.tf * H;
  return (
    <Svg
      width={w * 2}
      height={h * 1.7}
      style={{ position: 'absolute', left, top, transform: def.flip ? [{ scaleX: -1 }] : undefined }}
      pointerEvents="none"
    >
      <Path
        d={`M0 ${h} Q ${w / 2} 0 ${w} ${h} Q ${w * 1.5} 0 ${w * 2} ${h}`}
        stroke="rgba(40,38,44,0.4)"
        strokeWidth={1.4 * s}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TwinklingStarField({ stars }: { stars: StarDef[] }) {
  const reducedMotion = useReducedMotion();
  const anims = useRef(stars.map((s) => new Animated.Value(s.op))).current;
  useEffect(() => {
    if (reducedMotion) {
      // Settle every star at a fixed mid-brightness between its twinkle trough
      // (op * 0.1) and peak (op) — still visible and not animating, rather
      // than fully off or looking broken/dimmed.
      anims.forEach((anim, i) => anim.setValue(stars[i].op * 0.55));
      return;
    }
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
  }, [anims, stars, reducedMotion]);

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
  const reducedMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) {
      // Settle at the peak (not the trough) so the glow reads as steady-and-lit
      // rather than dimmed/broken when motion is reduced.
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, half, reducedMotion]);
  return v;
}

/**
 * A soft, true radial-gradient halo behind a sun-type body — replaces the old
 * "two flat-opacity rings" approximation (which read as visible concentric
 * bands, a big part of the "vibe coded" look) with an actual smooth falloff
 * to transparent, via `react-native-svg`'s `RadialGradient`.
 */
function CelestialGlow({
  x,
  y,
  radius,
  color,
  opacity,
  scale,
}: {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
}) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `glow-${rawId}`;
  const d = radius * 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - radius, top: y - radius, width: d, height: d, opacity, transform: [{ scale }] }}
    >
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <Stop offset="45%" stopColor={color} stopOpacity={0.24} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

function ActiveSun({ x, y, prayer }: { x: number; y: number; prayer: Period }) {
  const cfg = {
    dhuhr: { r: 22, glow: '#FFF9CC', glowR: 60, rays: true },
    asr: { r: 16, glow: '#E0B25E', glowR: 44, rays: false },
    maghrib: { r: 11, glow: '#E0783C', glowR: 34, rays: false },
  } as const;
  const { r, glow, glowR, rays } = cfg[prayer as keyof typeof cfg] ?? { r: 16, glow: '#FFF9CC', glowR: 44, rays: false };
  const RAY_LEN = 9;
  const RAY_GAP = 5;

  // Slow glow pulse — asr breathes the slowest, then maghrib, then dhuhr.
  const pulse = useSlowPulse(prayer === 'asr' ? 5200 : prayer === 'maghrib' ? 4400 : 3800);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <>
      <CelestialGlow x={x} y={y} radius={glowR} color={glow} opacity={glowOpacity} scale={glowScale} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#FFF6CC' }} />
      {rays && RAY_ANGLES.map((deg) => {
        const isDiag = deg % 90 !== 0;
        const len = isDiag ? RAY_LEN * 0.6 : RAY_LEN;
        const dist = r + RAY_GAP + len / 2;
        const rad = (deg * Math.PI) / 180;
        const rx = x + dist * Math.sin(rad);
        const ry = y - dist * Math.cos(rad);
        return <View key={deg} style={{ position: 'absolute', left: rx - 1, top: ry - len / 2, width: 2, height: len, borderRadius: 1, backgroundColor: 'rgba(255,245,180,0.55)', transform: [{ rotate: `${deg}deg` }] }} />;
      })}
    </>
  );
}

const MOON_COLOR = '#E7E3F8';

/**
 * The Fajr/Maghrib/Isha crescent.
 *
 * Previously this painted a full bright disc, then overlaid a second full
 * disc filled with a hardcoded flat color (guessing at what the sky behind it
 * looked like) to fake a shadowed edge. Because the real sky is a multi-stop
 * animated gradient (and sometimes a darkening scrim on top of that), the
 * guess was essentially always wrong and the "shadow" read as a mismatched
 * dark smudge rather than a crescent.
 *
 * Fixed properly with `react-native-svg`: the shadowed portion is carved out
 * with a true alpha `Mask` (a second circle painted black inside the mask
 * definition), not a painted color. The masked-out pixels are genuinely
 * transparent, so whatever is actually behind the moon at render time — the
 * live gradient, the scrim, a star — shows through correctly with zero
 * color-matching guesswork, and the silhouette itself is real crescent
 * geometry instead of "two discs that hopefully blend."
 */
function ActiveMoon({ x, y, prayer }: { x: number; y: number; prayer: Period }) {
  const isFajr = prayer === 'fajr';
  const size = isFajr ? 32 : 38;
  const r = size / 2;
  // Offset direction flips between fajr (waning, before sunrise) and
  // maghrib/isha (waxing, after sunset) so the lit edge always faces the
  // direction the body is travelling along the arc.
  const offset = (isFajr ? 1 : -1) * r * 0.62;
  const rawId = useId().replace(/:/g, '');
  const maskId = `moon-mask-${rawId}`;

  return (
    <Svg width={size} height={size} style={{ position: 'absolute', left: x - r, top: y - r }}>
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
          <Circle cx={r} cy={r} r={r} fill="#fff" />
          <Circle cx={r + offset} cy={r - r * 0.16} r={r * 1.04} fill="#000" />
        </Mask>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={MOON_COLOR} mask={`url(#${maskId})`} />
    </Svg>
  );
}

function SunriseSun({ x, y }: { x: number; y: number }) {
  const r = 13;
  const pulse = useSlowPulse(4600);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return (
    <>
      <CelestialGlow x={x} y={y} radius={38} color="#E0913C" opacity={glowOpacity} scale={glowScale} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#EFBE50' }} />
    </>
  );
}

export default function SkyScene({ prayer, skyAreaY }: Props) {
  const arc = useMemo(() => getArc(skyAreaY), [skyAreaY]);
  const { cx, cy, a, b } = arc;
  const pos = arcXY(cx, cy, a, b, DEG[prayer]);
  const stars = STARS_FOR[prayer];
  const body = BODY[prayer];
  const clouds = CLOUDS_FOR[prayer];
  const birds = BIRDS_FOR[prayer];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars && <TwinklingStarField key={prayer} stars={stars} />}
      {clouds && clouds.map((c, i) => <Cloud key={`cloud-${i}`} def={c} />)}
      {birds && birds.map((b, i) => <Bird key={`bird-${i}`} def={b} />)}
      {body === 'sunrise' ? (
        <SunriseSun x={pos.x} y={pos.y} />
      ) : body === 'sun' ? (
        <ActiveSun x={pos.x} y={pos.y} prayer={prayer} />
      ) : (
        <ActiveMoon x={pos.x} y={pos.y} prayer={prayer} />
      )}
    </View>
  );
}
