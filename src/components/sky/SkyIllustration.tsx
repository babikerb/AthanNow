import React, { memo, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { lerp, mix, mixStops, smooth, type SkyBlend } from './blend';
import { moonPath, type MoonPhase } from './moon';
import { INK, SCENES, ScenePeriod, STAR_FIELD } from './palettes';

// Authored once on a 390 x 340 viewBox; `xMidYMax slice` keeps the skyline anchored to the bottom
// edge and crops sky (never ground) on other aspect ratios.
const RIDGE_FAR = 'M0 226 C58 198 112 214 162 204 C222 191 262 224 322 209 C352 201 374 206 390 199 L390 340 L0 340 Z';
const RIDGE_MID = 'M0 262 C52 243 102 260 152 249 C204 238 252 262 302 254 C342 248 370 257 390 249 L390 340 L0 340 Z';
const RIDGE_NEAR = 'M0 296 C62 282 122 296 182 288 C242 280 302 298 390 286 L390 340 L0 340 Z';

// Mosque skyline. Main dome and both minarets sit in the right third; a lower dome, a slim
// minaret and an arcade wall balance the left.
const SKYLINE = [
  // ground
  'M0 318 H390 V340 H0 Z',
  // left: arcade wall with a low dome
  'M18 318 V298 H128 V318 Z',
  'M48 298 C48 280 60 270 73 268 C86 270 98 280 98 298 Z',
  'M72 268 V258 H74 V268 Z',
  // left slim minaret
  'M140 318 V256 H147 V318 Z',
  'M138 262 H149 V265 H138 Z',
  'M140 256 L143.5 242 L147 256 Z',
  // main prayer hall
  'M226 318 V284 H340 V318 Z',
  // drum + main dome
  'M246 284 V277 H318 V284 Z',
  'M248 277 C248 247 266 233 282 230 C298 233 316 247 316 277 Z',
  // finial
  'M281 230 V214 H283 V230 Z',
  // right-third minarets
  'M212 318 V230 H222 V318 Z',
  'M209 264 H225 V268 H209 Z',
  'M212 230 L217 210 L222 230 Z',
  'M346 318 V238 H356 V318 Z',
  'M343 270 H359 V274 H343 Z',
  'M346 238 L351 220 L356 238 Z',
  // small side dome
  'M362 318 V300 H390 V318 Z',
  'M364 300 C364 290 370 284 377 283 C384 284 390 290 390 300 Z',
].join(' ');

// Top of the far ridge in viewBox units; a body pushed lower than this sinks behind the hills.
const HORIZON = 200;
/** Height (in authored units) of the hills and skyline above the bottom edge. */
export const HILLS_UNITS = 340 - 196;

interface Props {
  period: ScenePeriod;
  width: number;
  height: number;
  /** Height (pt) of chrome drawn over the top of the scene (city, date). The sun or moon stays below it. */
  clearTop?: number;
  /**
   * 'band': the illustration fills a strip (cropping sky, never ground).
   * 'full': the sky fills the whole screen with the hills and skyline along the bottom edge.
   */
  layout?: 'band' | 'full';
  /** Full layout: the open sky (pt) kept free of text, where the sun or moon travels. */
  zone?: { top: number; bottom: number };
  /**
   * Full layout: how far the sun (sunrise to sunset) or moon (sunset to sunrise) is along its arc,
   * 0 = rising on the left, 1 = setting on the right. Maghrib keeps its sun low behind the skyline.
   */
  arc?: number;
  /** Full layout: raise the hills by this much (pt) so the skyline sits on top of the tab bar. */
  groundLift?: number;
  /** Full layout: part-way to the next prayer's sky. */
  blend?: SkyBlend | null;
  /** The moon's real phase; a thin crescent without it. */
  moon?: MoonPhase;
}

/**
 * A cumulus outline: flat base, uneven rounded bumps over the top (no two the same size), so it reads
 * as a cloud rather than an ellipse. (x, y) is the left end of the base.
 */
/** Cloud colour: warm at sunrise, white by day, a little stronger on the pale daytime skies. */
export function cloudLook(period: ScenePeriod, blend?: SkyBlend | null) {
  const look = (p: ScenePeriod) => (p === 'sunrise' ? { tint: '#F1C7B4', alpha: 0.3 } : { tint: '#FFFFFF', alpha: 0.42 });
  const a = look(period);
  if (!blend || !SCENES[blend.to].clouds) return a;
  const b = look(blend.to);
  return { tint: mix(a.tint, b.tint, blend.colorK), alpha: lerp(a.alpha, b.alpha, blend.colorK) };
}

/** Full-layout clouds in the open sky (scene units), shared by the drifting layer. */
export function cloudSet(zTop: number, zH: number) {
  return [
    { x: 18, y: zTop + zH * 0.42, w: 118, h: Math.min(30, zH * 0.3), a: 1, drift: 26, period: 70000 },
    { x: 232, y: zTop + zH * 0.86, w: 138, h: Math.min(34, zH * 0.34), a: 0.85, drift: -34, period: 90000 },
    { x: 150, y: zTop + zH * 0.2, w: 64, h: Math.min(16, zH * 0.16), a: 0.6, drift: 40, period: 60000 },
  ];
}

export function cloudPath(x: number, y: number, w: number, h: number): string {
  const pts: [number, number][] = [
    [x, y],
    [x + w * 0.16, y - h * 0.42],
    [x + w * 0.38, y - h * 0.82],
    [x + w * 0.6, y - h],
    [x + w * 0.8, y - h * 0.55],
    [x + w, y],
  ];
  let d = `M${x + h * 0.25} ${y} Q${x} ${y} ${x} ${y - h * 0.08}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = i === 1 ? [x, y - h * 0.08] : pts[i - 1];
    const [x1, y1] = pts[i];
    const r = Math.hypot(x1 - x0, y1 - y0) * (0.56 + (i % 2) * 0.1);
    d += ` A${r} ${r} 0 0 1 ${x1} ${y1}`;
  }
  return `${d} Q${x + w} ${y + h * 0.04} ${x + w - h * 0.25} ${y} Z`;
}

/** One layered cloud: a shaded back layer, the main body, a bright cap, and a wispy trailing base. */
export function Cloud({ x, y, w, h, tint, alpha }: { x: number; y: number; w: number; h: number; tint: string; alpha: number }) {
  return (
    <G>
      <Path d={cloudPath(x + w * 0.12, y + h * 0.1, w * 0.92, h * 0.72)} fill={tint} opacity={alpha * 0.45} />
      <Path d={cloudPath(x, y, w, h)} fill={tint} opacity={alpha} />
      <Path d={cloudPath(x + w * 0.3, y - h * 0.3, w * 0.42, h * 0.62)} fill="#FFFFFF" opacity={alpha * 0.55} />
      <Ellipse cx={x + w * 0.62} cy={y + h * 0.06} rx={w * 0.62} ry={h * 0.08} fill={tint} opacity={alpha * 0.5} />
    </G>
  );
}

/**
 * Star positions (pt) for the full layout, spread over the sky between the chrome and the hills.
 * `count` is how many of the field are drawn; how bright they are is up to the scene.
 */
export function starPoints(count: number, width: number, height: number, clearTop: number, groundLift: number) {
  const s = width / 390;
  const shift = height / s - 340 - groundLift / s;
  const top = clearTop / s;
  const span = shift + HORIZON - 30 - top;
  return STAR_FIELD.slice(0, count).map((st) => ({ x: st.x * s, y: (top + ((st.y - 56) / 130) * span) * s, r: st.r * s, o: st.o }));
}

// How far the Maghrib sun drops to be gone behind the skyline (authored units).
const SUN_SINK = 132;

interface DrawnBody {
  kind: 'sun' | 'moon';
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
}

function SkyIllustrationImpl({ period, width, height, clearTop = 0, layout = 'band', zone, arc, groundLift = 0, blend, moon }: Props) {
  const scene = SCENES[period];
  const next = layout === 'full' && blend ? SCENES[blend.to] : null;
  const k = next ? blend!.k : 0;
  const colorK = next ? blend!.colorK : 0;
  const id = useId().replace(/:/g, '');
  const full = layout === 'full';

  // Band: SVG-style `xMidYMax slice` over the 390 x 340 box. Full: scale by width and let the
  // viewBox run as tall as the screen, with the authored art translated to the bottom.
  const s = full ? width / 390 : Math.max(width / 390, height / 340);
  const vbH = full ? height / s : 340;
  const shift = vbH - 340 - (full ? groundLift / s : 0);
  const visibleTop = full ? 0 : 340 - height / s;

  // The open sky in authored units (full layout only).
  const zTop = zone ? zone.top / s : 0;
  const zBottom = zone ? zone.bottom / s : 0;
  const zH = Math.max(0, zBottom - zTop);
  const place = (p: ScenePeriod, at: number | undefined): DrawnBody => {
    const b = SCENES[p].body;
    const drawn: DrawnBody = { kind: b.kind === 'sun' ? 'sun' : 'moon', x: b.x, y: b.y + shift, r: b.r, color: b.color, opacity: 1 };
    if (full && zone && at != null && p !== 'maghrib') {
      // A real arc: low at either end of the open sky, highest at midday (or midnight for the moon).
      const f = Math.min(1, Math.max(0, at));
      const pad = b.r + 6;
      drawn.x = 28 + b.r + f * (390 - 56 - 2 * b.r);
      drawn.y = zBottom - pad - Math.sin(Math.PI * f) * Math.max(0, zH - 2 * pad);
    } else if (b.y < HORIZON) {
      if (full && zone) drawn.y = (zTop + zBottom) / 2;
      else {
        const minY = visibleTop + clearTop / s + b.r + 6;
        if (b.y < minY) drawn.y = Math.min(minY, HORIZON - b.r * 0.3);
      }
    }
    return drawn;
  };

  // One sun or moon through a fade: it glides and changes size and colour. Where the sun hands over
  // to the moon, the sun sinks behind the skyline first; at dawn the moon is gone before the sun is up.
  const here = place(period, arc);
  let bodies: DrawnBody[] = [here];
  if (next) {
    const there = place(blend!.to, blend!.to === 'sunrise' ? 0 : arc);
    if (here.kind === there.kind) {
      bodies = [{ ...there, x: lerp(here.x, there.x, k), y: lerp(here.y, there.y, k), r: lerp(here.r, there.r, k), color: mix(here.color, there.color, k) }];
    } else if (here.kind === 'sun') {
      bodies = [{ ...here, y: here.y + SUN_SINK * smooth(0, 0.75, k) }, { ...there, opacity: smooth(0.45, 1, k) }];
    } else {
      bodies = [{ ...here, opacity: 1 - smooth(0, 0.5, k) }, { ...there, opacity: smooth(0.5, 1, k) }];
    }
  }

  const stops: [string, number][] = full ? (next ? mixStops(scene.full.sky, next.full.sky, colorK, k) : scene.full.sky) : scene.sky.map((c, i) => [c, i / (scene.sky.length - 1)]);
  // Maghrib has no ridges, so there they fade instead of changing colour.
  const ridges = scene.ridges.length === 3 ? scene.ridges : next?.ridges.length === 3 ? next.ridges : null;
  const ridgeColor = (i: number) => (scene.ridges.length === 3 && next?.ridges.length === 3 ? mix(scene.ridges[i]!, next.ridges[i]!, k) : ridges![i]!);
  const ridgeOpacity = !next ? 1 : scene.ridges.length !== 3 ? k : next.ridges.length !== 3 ? 1 - smooth(0.45, 0.9, k) : 1;
  // Warm at sunrise, white by day; a little stronger on the pale daytime skies.
  const { tint: cloudTint, alpha: cloudAlpha } = cloudLook(period);
  // Without a phase (band layouts), the scene's own crescent.
  const phase = moon ?? { fraction: 0.18, litRight: !(scene.body.kind === 'crescent' && scene.body.waning) };
  const starY = (y: number) => y;

  return (
    <Svg width={width} height={height} viewBox={`0 0 390 ${vbH}`} preserveAspectRatio={full ? 'xMidYMax meet' : 'xMidYMax slice'}>
      <Defs>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([c, o], i) => (
            <Stop key={i} offset={o} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>

      {/* Extends above the viewBox so a taller-than-authored band never shows a seam. */}
      <Rect x={0} y={-400} width={390} height={vbH + 400} fill={stops[0][0]} />
      <Rect x={0} y={0} width={390} height={vbH} fill={`url(#sky${id})`} />

      {!full && scene.stars > 0 && (
        <G opacity={scene.starOpacity}>
          {STAR_FIELD.slice(0, scene.stars).map((st, i) => (
            <Circle key={i} cx={st.x} cy={starY(st.y)} r={st.r} fill="#FFFFFF" opacity={st.o} />
          ))}
        </G>
      )}

      {bodies.map((b) =>
        b.kind === 'sun' ? (
          <Circle key="sun" cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity={b.opacity} />
        ) : (
          <Path
            key="moon"
            d={moonPath(b.r, phase.fraction, phase.litRight)}
            transform={`translate(${b.x} ${b.y}) rotate(${phase.litRight ? -18 : 18})`}
            fill={b.color}
            opacity={b.opacity}
          />
        ),
      )}

      {/* Full layout: clouds drift, so the animated layer (SkyLife) draws them. */}

      <G transform={`translate(0 ${shift})`}>
        {!full && scene.clouds && (
          <>
            <Cloud x={52} y={156} w={120} h={26} tint={cloudTint} alpha={cloudAlpha} />
            <Cloud x={236} y={180} w={110} h={22} tint={cloudTint} alpha={cloudAlpha * 0.8} />
          </>
        )}
        {ridges && (
          <G opacity={ridgeOpacity}>
            <Path d={RIDGE_FAR} fill={ridgeColor(0)} />
            <Path d={RIDGE_MID} fill={ridgeColor(1)} />
            <Path d={RIDGE_NEAR} fill={ridgeColor(2)} />
          </G>
        )}
        <Path d={SKYLINE} fill={INK} />
        {/* Ground under a lifted skyline, overlapping the skyline's own ground so no seam shows. */}
        <Rect x={-1} y={318} width={392} height={422} fill={INK} />
      </G>
    </Svg>
  );
}

export const SkyIllustration = memo(SkyIllustrationImpl);
