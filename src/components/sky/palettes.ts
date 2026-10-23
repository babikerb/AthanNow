// Sky scene palettes, one per period. Flat, layered vector style: a gradient sky, three ridges
// that get lighter and greyer with distance, and one mosque skyline painted in the app's ink so
// the illustration settles into the UI below it.

export type ScenePeriod = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'night';

export const INK = '#17121F';

export type Body =
  | { kind: 'crescent'; x: number; y: number; r: number; color: string; waning?: boolean }
  | { kind: 'sun'; x: number; y: number; r: number; color: string };

export interface ScenePalette {
  /** Top to horizon. */
  sky: string[];
  /** Far, mid, near. Empty for Maghrib, where the sun sits straight behind the skyline. */
  ridges: [string, string, string] | [];
  body: Body;
  stars: number;
  starOpacity: number;
  clouds: boolean;
  /** A small flock flying across the open sky (full layout). */
  birds: boolean;
  /** A red and white plane with a contrail flying across the open sky now and then (full layout). */
  plane: boolean;
  /** Status bar icons over the top of this sky (band layout). */
  statusBar: 'light' | 'dark';
  /**
   * Full-screen layout: the sky runs top to bottom with text on it, so these stops are tuned for the
   * text that sits there (screen offsets 0 = top, 1 = bottom), with the tone of that text.
   * Checked: primary text >= 6.5:1 and the next-prayer accent >= 4.6:1 (gold) over 3-80% of the height.
   */
  full: { sky: [string, number][]; tone: SkyTone };
}

export type SkyTone = 'light' | 'dark';

/** Text colours for text drawn straight on the sky. */
export const SKY_TONES: Record<SkyTone, { text: string; secondary: string; tertiary: string; hairline: string; track: string; accent: string }> = {
  light: { text: '#F2EDF6', secondary: 'rgba(242,237,246,0.78)', tertiary: 'rgba(242,237,246,0.55)', hairline: 'rgba(242,237,246,0.16)', track: 'rgba(242,237,246,0.22)', accent: '#F5CF6A' },
  dark: { text: '#17121F', secondary: 'rgba(23,18,31,0.72)', tertiary: 'rgba(23,18,31,0.5)', hairline: 'rgba(23,18,31,0.14)', track: 'rgba(23,18,31,0.16)', accent: '#3F2E00' },
};

// Coordinates are in the scene's 390 x 340 viewBox.
export const SCENES: Record<ScenePeriod, ScenePalette> = {
  fajr: {
    sky: ['#1B1830', '#2C2747', '#4A3B5E', '#6B4A63'],
    ridges: ['#3A3352', '#2B2540', '#211B30'],
    body: { kind: 'crescent', x: 300, y: 96, r: 11, color: '#E7E3F8', waning: true },
    stars: 12,
    starOpacity: 0.45,
    clouds: false,
    birds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#1B1830', 0], ['#2C2747', 0.45], ['#4A3B5E', 0.78], ['#6B4A63', 1]], tone: 'light' },
  },
  sunrise: {
    sky: ['#2E3352', '#5A5872', '#B88A86', '#E2A884'],
    ridges: ['#8C7488', '#5B4C66', '#33293F'],
    body: { kind: 'sun', x: 112, y: 214, r: 28, color: '#F6D7A8' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    birds: true,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#2A2E4C', 0], ['#383A5A', 0.5], ['#544A68', 0.8], ['#E2A884', 1]], tone: 'light' },
  },
  dhuhr: {
    sky: ['#6A8AA1', '#8FA9B9', '#B5C4CB'],
    ridges: ['#8AA0B0', '#627C90', '#3C4C61'],
    body: { kind: 'sun', x: 92, y: 78, r: 16, color: '#FFF4DC' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    birds: false,
    plane: true,
    statusBar: 'light',
    full: { sky: [['#7E9DB2', 0], ['#9DB4C2', 0.55], ['#BCCAD0', 1]], tone: 'dark' },
  },
  asr: {
    sky: ['#5F7E7C', '#93A89E', '#C2B9A0'],
    ridges: ['#8E9A8C', '#5F6E68', '#36404A'],
    body: { kind: 'sun', x: 304, y: 128, r: 20, color: '#F3D9A6' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    birds: true,
    plane: true,
    statusBar: 'light',
    full: { sky: [['#86A19B', 0], ['#A3B5A8', 0.55], ['#C9BFA5', 1]], tone: 'dark' },
  },
  maghrib: {
    sky: ['#3B2E4F', '#8A5A6A', '#D98C6A', '#E9A27A'],
    ridges: [],
    body: { kind: 'sun', x: 282, y: 238, r: 46, color: '#F7D9B0' },
    stars: 5,
    starOpacity: 0.3,
    clouds: false,
    birds: true,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#33284A', 0], ['#463052', 0.45], ['#623C55', 0.8], ['#D98C6A', 0.92], ['#E9A27A', 1]], tone: 'light' },
  },
  isha: {
    sky: ['#1A1530', '#2A2148', '#3E2D63'],
    ridges: ['#2A2340', '#221C35', '#1E1829'],
    body: { kind: 'crescent', x: 306, y: 78, r: 18, color: '#EDE6F8' },
    stars: 18,
    starOpacity: 0.7,
    clouds: false,
    birds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#1A1530', 0], ['#2A2148', 0.6], ['#3E2D63', 1]], tone: 'light' },
  },
  night: {
    sky: ['#141022', '#1E1832', '#2C2444'],
    ridges: ['#251F38', '#211B31', '#1D1729'],
    body: { kind: 'crescent', x: 84, y: 66, r: 15, color: '#E4DDF0' },
    stars: 28,
    starOpacity: 0.75,
    clouds: false,
    birds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#141022', 0], ['#1E1832', 0.6], ['#2C2444', 1]], tone: 'light' },
  },
};

// Deterministic star field (same sky every launch), kept above the ridges and off the chrome strip.
function seededStars(n: number) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => ({ x: 8 + rnd() * 374, y: 56 + rnd() * 130, r: 0.6 + rnd() * 0.9, o: 0.5 + rnd() * 0.5 }));
}
export const STAR_FIELD = seededStars(28);
