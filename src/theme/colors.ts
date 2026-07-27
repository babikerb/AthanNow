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
/**
 * Same hue as `ACCENT`, lightened and slightly more saturated — for the one
 * context where the base accent's real problem shows up: `ACCENT` is a dark,
 * fairly desaturated green, and against a near-black surface (the tab bar's
 * `barTintColor`) that reads as low-contrast dark-on-dark, not as a legible
 * "this tab is active" signal. This isn't a second brand color — it's the
 * same green pushed brighter specifically for dark backdrops, the same idea
 * as an iOS system color having a light and dark variant of one hue. Use
 * this instead of `ACCENT` wherever a green needs to sit on a dark surface
 * and actually be seen (currently: the tab bar's active tint).
 */
export const ACCENT_ON_DARK = '#4FAE86';

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  /**
   * @deprecated Fails AA contrast (4.5:1) against the background it's paired
   * with (~3.27-3.30:1). Do not use for new real-text call sites — use
   * `textSecondary` for de-emphasized real text, or `textQuaternary` for
   * decorative-only glyphs. Existing real-text usages are being migrated off
   * this field in a later pass; it stays defined until that migration is
   * complete.
   */
  textTertiary: string;
  /**
   * Decorative glyphs only — e.g. a disclosure chevron sitting right next to
   * the value it's pointing at — never real `<Text>` content. Same alpha
   * value as the legacy `textTertiary` (0.36), which fails AA for body text;
   * that's acceptable here specifically because these pixels don't carry
   * information on their own (the adjacent text/value does). If you're
   * tempted to put a string in this color, use `textSecondary` instead.
   */
  textQuaternary: string;
  separator: string;
  accent: string;
};

// The app is dark-mode only by design (no system-theme following) — near-
// black greys, no purple tint.
export const darkPalette: Palette = {
  background: '#0B0B0D',
  surface: '#161618',
  surfaceElevated: '#202023',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.62)',
  textTertiary: 'rgba(255, 255, 255, 0.36)',
  textQuaternary: 'rgba(255, 255, 255, 0.36)',
  separator: 'rgba(255, 255, 255, 0.10)',
  accent: ACCENT,
};

// Explicit, documented exception: these three surfaces intentionally ignore
// the light/dark theme system because they are "always night sky" / "always
// instrument panel" interfaces by product design, not an oversight. Every
// permanently-dark surface in the app (Athan, Onboarding, Qibla) must
// reference this single constant — no screen may hardcode its own near-black.
export const NIGHT_BG = '#070d18';

// Shared state colors, previously duplicated ad hoc per screen (Qibla's
// "aligned" green, Settings'/LocationSheet's destructive/error red).
export const STATE_SUCCESS = '#34C759';
export const ERROR = '#E5484D';

/**
 * Sky-text tokens — verified against the *scrimmed* Dhuhr sky background
 * specifically (the binding worst case across all prayer gradients, once
 * `AmbientGradient`'s scrim is applied). Replaces the three unrelated ad hoc
 * translucent-white values previously hand-picked per label on the Athan
 * screen (subline 0.55, hijri 0.38, past-row 0.32) with two fixed tokens.
 */
export const skyTextPrimary = '#FFFFFF';
export const skyTextSecondary = 'rgba(255,255,255,0.82)';

/**
 * Reading-surface palette for the Quran mushaf reader — forced light,
 * independent of the rest of the app's forced-dark chrome palette above.
 * Warm ivory paper + soft warm-brown ink (not pure black), so a full page of
 * Arabic text doesn't read as stark/harsh the way white-on-black (or even
 * near-black-on-white) would. Full `Palette` shape (not a partial subset) so
 * it can be threaded into `Sheet`/`BookmarkSheet`/`SurahPickerSheet` too,
 * keeping the whole Quran tab on one consistent light surface.
 */
export const readingPalette: Palette = {
  background: '#F6F1E5',
  surface: '#F6F1E5',
  surfaceElevated: '#EFE7D6',
  textPrimary: '#3A3128',
  textSecondary: 'rgba(58, 49, 40, 0.64)',
  textTertiary: 'rgba(58, 49, 40, 0.42)',
  textQuaternary: 'rgba(58, 49, 40, 0.32)',
  separator: 'rgba(58, 49, 40, 0.14)',
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
