// The sky between prayers: which scene is turning into which, how far along it is, and the blended
// colours. Pure, so the fade can be checked for every minute without drawing it.
import { SCENES, SKY_TONES, type ScenePeriod } from './palettes';

/** A sky part-way to the next one. */
export interface SkyBlend {
  to: ScenePeriod;
  /** 0..1 through the fade. Moves the sun and moon, the stars, the clouds and the windows. */
  k: number;
  /** 0..1 for the colours: the same as `k`, or held back where the text on the sky would stop reading. */
  colorK: number;
}

/** Minutes the sky takes to turn into each scene. Longest where the real sky changes most. */
export const FADE_MINUTES: Record<ScenePeriod, number> = { fajr: 5, sunrise: 10, dhuhr: 5, asr: 5, maghrib: 10, isha: 5, night: 5 };

// The fade moves in this many steps: small enough that no step shows, few enough that the sky isn't
// redrawn every second.
const STEPS = 120;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function mix(a: string, b: string, k: number): string {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const [x, y] = [rgb(a), rgb(b)];
  return toHex(x.map((v, i) => lerp(v, y[i], k)));
}

type Stops = [string, number][];

function colorAt(stops: Stops, o: number): string {
  if (o <= stops[0][1]) return stops[0][0];
  for (let i = 1; i < stops.length; i++) {
    const [c1, o1] = stops[i];
    const [c0, o0] = stops[i - 1];
    if (o <= o1) return mix(c0, c1, (o - o0) / (o1 - o0));
  }
  return stops[stops.length - 1][0];
}

// Text sits on the sky down to here; below it is only horizon.
const TEXT_END = 0.8;
const HORIZON_FROM = 0.94;

/**
 * Two gradients with different stops, as one gradient between them. `horizonK` carries the open
 * horizon below the text on ahead, so a sunset can build there while the sky behind the text waits.
 */
export function mixStops(a: Stops, b: Stops, k: number, horizonK = k): Stops {
  if (k <= 0 && horizonK <= 0) return a;
  if (k >= 1) return b;
  const offsets = [...new Set([...a, ...b].map(([, o]) => o).concat(TEXT_END, (TEXT_END + HORIZON_FROM) / 2, HORIZON_FROM))].sort((x, y) => x - y);
  return offsets.map((o) => [mix(colorAt(a, o), colorAt(b, o), lerp(k, horizonK, smooth(TEXT_END, HORIZON_FROM, o))), o]);
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The gold of the next prayer's time, drawn in to the text colour as a sky that will flip tone turns. */
export function accentFor(from: ScenePeriod, to: ScenePeriod, colorK: number): string {
  const tone = SKY_TONES[SCENES[from].full.tone];
  return SCENES[from].full.tone === SCENES[to].full.tone ? tone.accent : mix(tone.accent, tone.text, smooth(0, 0.06, colorK));
}

/** The lowest contrast of `color` against the blended sky over the part of the screen text sits on. */
export function lowestContrast(from: ScenePeriod, to: ScenePeriod, colorK: number, color: string): number {
  const stops = mixStops(SCENES[from].full.sky, SCENES[to].full.sky, colorK);
  let low = Infinity;
  for (let o = 0.03; o <= TEXT_END; o += 0.01) low = Math.min(low, contrast(colorAt(stops, o), color));
  return low;
}

const limits = new Map<string, number>();

/**
 * How far the colours can go before the text on them drops under 4.5:1. Skies that share a tone can
 * go all the way; where dark text will become light (or the reverse) neither reads in the middle, so
 * the colours stop short and the rest of the change happens at the prayer.
 */
export function colorLimit(from: ScenePeriod, to: ScenePeriod): number {
  const tone = SCENES[from].full.tone;
  if (tone === SCENES[to].full.tone) return 1;
  const key = `${from}>${to}`;
  const known = limits.get(key);
  if (known != null) return known;
  let k = 0;
  while (k < 1) {
    const at = k + 0.01;
    if (lowestContrast(from, to, at, SKY_TONES[tone].text) < 4.5 || lowestContrast(from, to, at, accentFor(from, to, at)) < 4.5) break;
    k = at;
  }
  limits.set(key, k);
  return k;
}

/** The blend `msLeft` before `from` gives way to `to`, or null while the sky is simply itself. */
export function blendAt(from: ScenePeriod, to: ScenePeriod, msLeft: number): SkyBlend | null {
  const span = FADE_MINUTES[to] * 60000;
  if (from === to || msLeft > span || msLeft < 0) return null;
  const k = Math.round((1 - msLeft / span) * STEPS) / STEPS;
  if (k <= 0) return null;
  // Eased, so the sky starts to turn without a visible beginning.
  const eased = k * k * (3 - 2 * k);
  return { to, k: eased, colorK: eased * colorLimit(from, to) };
}

/** True when the fade reaches the next sky's colours, so the swap at the prayer is invisible. */
export const blendsFully = (from: ScenePeriod, to: ScenePeriod) => colorLimit(from, to) === 1;
