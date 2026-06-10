/**
 * Global design tokens for AthanNow.
 *
 * Accent is the single brand color used across the app (pills, active states,
 * icons, the focused selection in sheets, etc). Prayer gradients drive the
 * Athan sky scene and are intentionally desaturated for a premium, calm look.
 */

export const ACCENT = '#866099';
export const ACCENT_SOFT = 'rgba(134, 96, 153, 0.18)';
export const ACCENT_BORDER = 'rgba(134, 96, 153, 0.40)';

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

export const lightPalette: Palette = {
  background: '#F5F3F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#1A151E',
  textSecondary: 'rgba(26, 21, 30, 0.62)',
  textTertiary: 'rgba(26, 21, 30, 0.38)',
  separator: 'rgba(26, 21, 30, 0.10)',
  accent: ACCENT,
};

export const darkPalette: Palette = {
  background: '#0D0A11',
  surface: '#181320',
  surfaceElevated: '#211A2B',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.62)',
  textTertiary: 'rgba(255, 255, 255, 0.36)',
  separator: 'rgba(255, 255, 255, 0.10)',
  accent: ACCENT,
};

/**
 * Atmospheric gradients keyed to each prayer stage, used by the Athan sky scene.
 * Each array is consumed directly by react-native-linear-gradient.
 */
export const prayerGradients: Record<string, string[]> = {
  fajr: ['#1e2530', '#2d384a', '#181e29'],
  sunrise: ['#3a3330', '#54463d', '#2b2522'],
  dhuhr: ['#283c4f', '#36526d', '#1f2e3d'],
  asr: ['#3b362d', '#524b3e', '#29251f'],
  maghrib: ['#362528', '#4f3338', '#241a1c'],
  isha: ['#12161f', '#1b212e', '#0d1017'],
};
