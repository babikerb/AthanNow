/**
 * Global design tokens for AthanNow.
 *
 * Accent is the single brand color, used sparingly for active/selected states.
 * Prayer gradients are ported from the Jamaa app for a richer, premium sky scene.
 */

// Brand accent — sampled from the app icon background. Used sparingly for
// active/selected states and highlights only; never as a full surface fill.
export const ACCENT = '#315C46';
export const ACCENT_SOFT = 'rgba(49, 92, 70, 0.16)';
export const ACCENT_BORDER = 'rgba(49, 92, 70, 0.35)';

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  accent: string;
};

// Neutral light theme — true greys, no purple tint. Accent supplies the only color.
export const lightPalette: Palette = {
  background: '#F2F2F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#111113',
  textSecondary: 'rgba(17, 17, 19, 0.60)',
  textTertiary: 'rgba(17, 17, 19, 0.38)',
  separator: 'rgba(17, 17, 19, 0.10)',
  accent: ACCENT,
};

// Neutral dark theme — near-black greys, no purple tint.
export const darkPalette: Palette = {
  background: '#0B0B0D',
  surface: '#161618',
  surfaceElevated: '#202023',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.62)',
  textTertiary: 'rgba(255, 255, 255, 0.36)',
  separator: 'rgba(255, 255, 255, 0.10)',
  accent: ACCENT,
};

/**
 * Atmospheric gradients keyed to each prayer stage (ported from Jamaa).
 * Consumed by the AmbientGradient component on the Athan screen.
 */
export const prayerGradients: Record<string, string[]> = {
  // Pre-dawn: muted indigo -> dusky mauve
  fajr: ['#0c0b1c', '#18153a', '#2c2258', '#4e3348', '#7a5560'],
  // Sunrise: deep navy -> blue-violet -> rose-mauve -> warm peach-gold
  sunrise: ['#060b18', '#0e1532', '#2c1848', '#6e2c50', '#b46050', '#d49448'],
  // Noon: hazy sky blue
  dhuhr: ['#8eb2c4', '#6090a8', '#4a7090', '#366078'],
  // Afternoon: muted teal -> dusty amber
  asr: ['#1c3448', '#2a4e68', '#466880', '#706258', '#907040'],
  // Dusk: deep violet -> muted brick -> warm amber
  maghrib: ['#121024', '#201846', '#4a1e30', '#783030', '#9a5838', '#a87840'],
  // Night: deep navy
  isha: ['#070d18', '#0b1522', '#0f1828', '#091220'],
};

/**
 * How long before the next prayer the sky begins shifting toward that prayer's
 * gradient (minutes). Tuned per stage: the slow approach to Maghrib (sunset) and
 * the long pre-dawn drift from Isha toward Fajr shift over a wide window, while
 * midday changes are quicker.
 */
export const gradientShiftMinutes: Record<string, number> = {
  fajr: 35,
  sunrise: 20,
  dhuhr: 50,
  asr: 95, // long, slow slide into the sunset
  maghrib: 45,
  isha: 75, // long drift toward the coming dawn
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

// Sample an evenly-spaced color ramp at normalized position p (0..1).
function sampleRamp(colors: string[], p: number): [number, number, number] {
  const n = colors.length;
  if (n === 1) return hexToRgb(colors[0]);
  const x = Math.max(0, Math.min(1, p)) * (n - 1);
  const i = Math.floor(x);
  if (i >= n - 1) return hexToRgb(colors[n - 1]);
  const f = x - i;
  const a = hexToRgb(colors[i]);
  const b = hexToRgb(colors[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/**
 * Blend two gradient ramps (which may differ in length) by factor t (0..1),
 * resampling both to a common number of stops. t=0 returns `from`, t=1 `to`.
 */
export function blendGradients(from: string[], to: string[], t: number, stops = 6): string[] {
  const tt = Math.max(0, Math.min(1, t));
  const out: string[] = [];
  for (let s = 0; s < stops; s++) {
    const p = s / (stops - 1);
    const a = sampleRamp(from, p);
    const b = sampleRamp(to, p);
    out.push(`#${toHex(a[0] + (b[0] - a[0]) * tt)}${toHex(a[1] + (b[1] - a[1]) * tt)}${toHex(a[2] + (b[2] - a[2]) * tt)}`);
  }
  return out;
}

/** Whether to use a light (white) status bar over each prayer gradient. */
export const prayerStatusBarLight: Record<string, boolean> = {
  fajr: true,
  sunrise: true,
  dhuhr: false, // light sky -> dark status bar
  asr: true,
  maghrib: true,
  isha: true,
};

/** The Quran mushaf typeface (Amiri Quran, loaded via expo-font). */
export const QURAN_FONT = 'AmiriQuran';
