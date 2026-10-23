import { colorTokens, skyShiftMinutes, skyStages } from '../design/tokens.generated';

/**
 * Legacy colour bridge. The source of truth is design/tokens.json; everything here derives from it.
 * New code should use `useTheme()` from src/design.
 */

export type Palette = {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  /**
   * @deprecated Fails AA contrast (4.5:1) against the background it's paired
   * with (~3.27-3.30:1). Do not use for new real-text call sites, use
   * `textSecondary` for de-emphasized real text, or `textQuaternary` for
   * decorative-only glyphs. Existing real-text usages are being migrated off
   * this field in a later pass; it stays defined until that migration is
   * complete.
   */
  textTertiary: string;
  /**
   * Decorative glyphs only, e.g. a disclosure chevron sitting right next to
   * the value it's pointing at, never real `<Text>` content. Same alpha
   * value as the legacy `textTertiary` (0.36), which fails AA for body text;
   * that's acceptable here specifically because these pixels don't carry
   * information on their own (the adjacent text/value does). If you're
   * tempted to put a string in this color, use `textSecondary` instead.
   */
  textQuaternary: string;
  separator: string;
  /** Text-safe accent for this surface family (also fine for icons). */
  accent: string;
  accentSoft: string;
  /** Text/icon colour for content sitting on an `accent` fill. */
  onAccent: string;
  danger: string;
};

// The app is dark-mode only by design (no system-theme following), near-
// black greys, no purple tint.
export const darkPalette: Palette = {
  background: colorTokens.dark.bg,
  surface: colorTokens.dark.surface1,
  surfaceElevated: colorTokens.dark.surface2,
  textPrimary: colorTokens.dark.text,
  textSecondary: colorTokens.dark.textSecondary,
  textTertiary: colorTokens.dark.textTertiary,
  textQuaternary: colorTokens.dark.glyphQuiet,
  separator: colorTokens.dark.hairline,
  accent: colorTokens.dark.accentText,
  accentSoft: colorTokens.dark.accentSoft,
  onAccent: colorTokens.dark.onAccentText,
  danger: colorTokens.dark.danger,
};

export const lightPalette: Palette = {
  background: colorTokens.light.bg,
  surface: colorTokens.light.surface1,
  surfaceElevated: colorTokens.light.surface2,
  textPrimary: colorTokens.light.text,
  textSecondary: colorTokens.light.textSecondary,
  textTertiary: colorTokens.light.textTertiary,
  textQuaternary: colorTokens.light.glyphQuiet,
  separator: colorTokens.light.hairline,
  accent: colorTokens.light.accentText,
  accentSoft: colorTokens.light.accentSoft,
  onAccent: colorTokens.light.onAccentText,
  danger: colorTokens.light.danger,
};

// Explicit, documented exception: these three surfaces intentionally ignore
// the light/dark theme system because they are "always night sky" / "always
// instrument panel" interfaces by product design, not an oversight. Every
// permanently-dark surface in the app (Athan, Onboarding, Qibla) must
// reference this single constant, no screen may hardcode its own near-black.
export const NIGHT_BG = colorTokens.dark.bg;

// Shared state colors, previously duplicated ad hoc per screen (Qibla's
// "aligned" green, Settings'/LocationSheet's destructive/error red).

/**
 * Sky-text tokens, verified against the *scrimmed* Dhuhr sky background
 * specifically (the binding worst case across all prayer gradients, once
 * `AmbientGradient`'s scrim is applied). Replaces the three unrelated ad hoc
 * translucent-white values previously hand-picked per label on the Athan
 * screen (subline 0.55, hijri 0.38, past-row 0.32) with two fixed tokens.
 */
export const skyTextPrimary: string = colorTokens.dark.skyText;
export const skyTextSecondary: string = colorTokens.dark.skyTextSecondary;

/**
 * Reading-surface palette for the Quran mushaf reader, forced light,
 * independent of the rest of the app's forced-dark chrome palette above.
 * Warm ivory paper + soft warm-brown ink (not pure black), so a full page of
 * Arabic text doesn't read as stark/harsh the way white-on-black (or even
 * near-black-on-white) would. Full `Palette` shape (not a partial subset) so
 * it can be threaded into `Sheet`/`BookmarkSheet`/`SurahPickerSheet` too,
 * keeping the whole Quran tab on one consistent light surface.
 */
export const readingPalette: Palette = {
  background: colorTokens.paper.bg,
  surface: colorTokens.paper.surface1,
  surfaceElevated: colorTokens.paper.surface2,
  textPrimary: colorTokens.paper.text,
  textSecondary: colorTokens.paper.textSecondary,
  textTertiary: colorTokens.paper.textTertiary,
  textQuaternary: colorTokens.paper.glyphQuiet,
  separator: colorTokens.paper.hairline,
  accent: colorTokens.paper.accentText,
  accentSoft: colorTokens.paper.accentSoft,
  onAccent: colorTokens.paper.onAccentText,
  danger: colorTokens.paper.danger,
};

/**
 * Atmospheric gradients keyed to each prayer stage (ported from Jamaa).
 * Consumed by the AmbientGradient component on the Athan screen.
 */
/** Sky ramps now come from design/tokens.json (OKLCH-authored, validated). Same shape as before for existing consumers. */
export const prayerGradients: Record<string, string[]> = Object.fromEntries(
  Object.entries(skyStages).map(([k, v]) => [k, [...v.colors]]),
);

/** Minutes before the next prayer that the sky begins shifting (kept for the widget/blend helpers). */
export const gradientShiftMinutes: Record<string, number> = { ...skyShiftMinutes };

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
export const prayerStatusBarLight: Record<string, boolean> = Object.fromEntries(
  Object.entries(skyStages).map(([k, v]) => [k, v.statusBarLight]),
);

/** The Quran mushaf typeface (Amiri Quran, loaded via expo-font). */
export const QURAN_FONT = 'AmiriQuran';
