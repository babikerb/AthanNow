import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Mask, RadialGradient, Stop } from 'react-native-svg';

import { skyArt } from '../design/tokens.generated';
import { useTheme } from '../design/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResumeSnap } from '../hooks/useResumeSnap';

const { width: W, height: H } = Dimensions.get('screen');

type Period = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface Props {
  /** Which stage to show. A stage change crossfades the art once, in step with the gradient (no continuous blend
   *  toward the next stage as its time approaches). */
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

// Quiet daytime atmosphere: one or two soft, low-opacity clouds on the bright stages (dhuhr, asr). Static: stillness reads as
// premium here. (Birds and sun rays were removed in the sky polish pass.)
interface CloudDef { lf: number; tf: number; scale: number; op: number }

const DHUHR_CLOUDS: CloudDef[] = [
  { lf: 0.16, tf: 0.09, scale: 1, op: 0.42 },
  { lf: 0.7, tf: 0.12, scale: 0.75, op: 0.3 },
];
const ASR_CLOUDS: CloudDef[] = [{ lf: 0.2, tf: 0.11, scale: 0.85, op: 0.28 }];
const CLOUDS_FOR: Partial<Record<Period, CloudDef[]>> = { dhuhr: DHUHR_CLOUDS, asr: ASR_CLOUDS };

/** A quiet cloud: one long pill and one small bump, flat low-opacity fill (two shapes, no outline, no motion). */
function Cloud({ def }: { def: CloudDef }) {
  const s = def.scale;
  return (
    <View style={{ position: 'absolute', left: def.lf * W, top: def.tf * H, opacity: def.op, width: 72 * s, height: 28 * s }} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, top: 10 * s, width: 72 * s, height: 18 * s, borderRadius: 9 * s, backgroundColor: skyArt.cloud }} />
      <View style={{ position: 'absolute', left: 18 * s, top: 0, width: 34 * s, height: 22 * s, borderRadius: 11 * s, backgroundColor: skyArt.cloud }} />
    </View>
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
        <Animated.View key={i} style={{ position: 'absolute', left: s.lf * W - s.r, top: s.tf * H - s.r, width: s.r * 2, height: s.r * 2, borderRadius: s.r, backgroundColor: skyArt.star, opacity: anims[i] }} />
      ))}
    </>
  );
}

function CelestialGlow({ x, y, radius, color, opacity = 0.85 }: { x: number; y: number; radius: number; color: string; opacity?: number }) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `glow-${rawId}`;
  const d = radius * 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - radius, top: y - radius, width: d, height: d, opacity }}>
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
    </View>
  );
}

/** The sun: a steady disc with a static halo (no rays, no pulse). */
function ActiveSun({ x, y, prayer }: { x: number; y: number; prayer: Period }) {
  const cfg = {
    dhuhr: { r: 22, glow: skyArt.sunGlowDhuhr, glowR: 60 },
    asr: { r: 16, glow: skyArt.sunGlowAsr, glowR: 44 },
    maghrib: { r: 11, glow: skyArt.sunGlowMaghrib, glowR: 34 },
  } as const;
  const { r, glow, glowR } = cfg[prayer as keyof typeof cfg] ?? { r: 16, glow: skyArt.sunGlowDhuhr, glowR: 44 };
  return (
    <>
      <CelestialGlow x={x} y={y} radius={glowR} color={glow} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: skyArt.sun }} />
    </>
  );
}

const MOON_COLOR = skyArt.moon;

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
          <Circle cx={r} cy={r} r={r} fill={skyArt.maskOn} />
          <Circle cx={r + offset} cy={r - r * 0.16} r={r * 1.04} fill={skyArt.maskOff} />
        </Mask>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={MOON_COLOR} mask={`url(#${maskId})`} />
    </Svg>
  );
}

function SunriseSun({ x, y }: { x: number; y: number }) {
  const r = 13;
  return (
    <>
      <CelestialGlow x={x} y={y} radius={38} color={skyArt.sunriseGlow} />
      <View style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: skyArt.sunrise }} />
    </>
  );
}

function SkyArt({ prayer, skyAreaY }: Props) {
  const arc = useMemo(() => getArc(skyAreaY), [skyAreaY]);
  const { cx, cy, a, b } = arc;
  const pos = arcXY(cx, cy, a, b, DEG[prayer]);
  const stars = STARS_FOR[prayer];
  const body = BODY[prayer];
  const clouds = CLOUDS_FOR[prayer];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars && <TwinklingStarField key={prayer} stars={stars} />}
      {clouds && clouds.map((c, i) => <Cloud key={`cloud-${i}`} def={c} />)}
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

interface ArtLayer {
  id: number;
  prayer: Period;
  v: Animated.Value;
}

/**
 * The sky scene's celestial art. A stage change fades the old art out while the new art fades in over the same duration
 * as the gradient crossfade (AmbientGradient), so the sun/moon/stars never hard-cut. Snaps when the app has just resumed.
 */
export default function SkyScene({ prayer, skyAreaY }: Props) {
  const { motion, reduceMotion } = useTheme();
  const recentlyResumed = useResumeSnap();
  const nextId = useRef(1);
  const [layers, setLayers] = useState<ArtLayer[]>(() => [{ id: 0, prayer, v: new Animated.Value(1) }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const shown = useRef(prayer);

  useEffect(() => () => layersRef.current.forEach((l) => l.v.stopAnimation()), []);

  useEffect(() => {
    if (prayer === shown.current) return;
    shown.current = prayer;
    if (recentlyResumed()) {
      layersRef.current.forEach((l) => l.v.stopAnimation());
      setLayers([{ id: nextId.current++, prayer, v: new Animated.Value(1) }]);
      return;
    }
    const layer: ArtLayer = { id: nextId.current++, prayer, v: new Animated.Value(0) };
    const outgoing = layersRef.current.slice(-2);
    setLayers([...outgoing, layer]);
    const cfg = {
      duration: reduceMotion ? motion.duration.reducedFade : motion.duration.skyCrossfade,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    };
    Animated.parallel([Animated.timing(layer.v, { toValue: 1, ...cfg }), ...outgoing.map((l) => Animated.timing(l.v, { toValue: 0, ...cfg }))]).start(({ finished }) => {
      if (finished) setLayers((cur) => cur.filter((l) => l.id === layer.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayer]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.map((l) => (
        <Animated.View key={l.id} style={[StyleSheet.absoluteFill, { opacity: l.v }]} pointerEvents="none">
          <SkyArt prayer={l.prayer} skyAreaY={skyAreaY} />
        </Animated.View>
      ))}
    </View>
  );
}
