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
  /** A red and white plane with a contrail flying across the open sky now and then (full layout). */
  plane: boolean;
  /** Status bar icons over the top of this sky (band layout). */
  statusBar: 'light' | 'dark';
  /**
   * Full-screen layout: the sky runs top to bottom with text on it, so these stops are tuned for the
   * text that sits there (screen offsets 0 = top, 1 = bottom), with the tone of that text.
   * Checked: primary text >= 6.3:1 and the gold next-prayer accent >= 4.85:1 over 3-80% of the height.
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
    plane: false,
    statusBar: 'light',
    full: { sky: [['#121430', 0], ['#1B1E44', 0.3], ['#272858', 0.55], ['#3A3367', 0.74], ['#5A4472', 0.86], ['#86607C', 0.95], ['#A8787F', 1]], tone: 'light' },
  },
  sunrise: {
    sky: ['#2E3352', '#5A5872', '#B88A86', '#E2A884'],
    ridges: ['#8C7488', '#5B4C66', '#33293F'],
    body: { kind: 'sun', x: 112, y: 214, r: 28, color: '#F6D7A8' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#1D2446', 0], ['#283057', 0.3], ['#353A65', 0.55], ['#454370', 0.72], ['#6A5479', 0.85], ['#B97B7A', 0.93], ['#EDB383', 1]], tone: 'light' },
  },
  dhuhr: {
    sky: ['#6A8AA1', '#8FA9B9', '#B5C4CB'],
    ridges: ['#8AA0B0', '#627C90', '#3C4C61'],
    body: { kind: 'sun', x: 92, y: 78, r: 16, color: '#FFF4DC' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    plane: true,
    statusBar: 'light',
    full: { sky: [['#7BA3C6', 0], ['#8AAFCD', 0.3], ['#9DBBD5', 0.55], ['#B6CCDD', 0.78], ['#C9D8E2', 0.92], ['#D6E0E5', 1]], tone: 'dark' },
  },
  asr: {
    sky: ['#5F7E7C', '#93A89E', '#C2B9A0'],
    ridges: ['#8E9A8C', '#5F6E68', '#36404A'],
    body: { kind: 'sun', x: 304, y: 128, r: 20, color: '#F3D9A6' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    plane: true,
    statusBar: 'light',
    full: { sky: [['#89A9A6', 0], ['#98B4AA', 0.3], ['#AABEAC', 0.55], ['#BFC6AA', 0.76], ['#D3CBA4', 0.9], ['#E0CC9C', 1]], tone: 'dark' },
  },
  maghrib: {
    sky: ['#3B2E4F', '#8A5A6A', '#D98C6A', '#E9A27A'],
    ridges: [],
    body: { kind: 'sun', x: 282, y: 238, r: 46, color: '#F7D9B0' },
    stars: 5,
    starOpacity: 0.3,
    clouds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#231C3E', 0], ['#32254F', 0.28], ['#45305C', 0.5], ['#5E3A63', 0.68], ['#7E4666', 0.8], ['#A85868', 0.88], ['#D27A6C', 0.95], ['#EC9C74', 1]], tone: 'light' },
  },
  isha: {
    sky: ['#1A1530', '#2A2148', '#3E2D63'],
    ridges: ['#2A2340', '#221C35', '#1E1829'],
    body: { kind: 'crescent', x: 306, y: 78, r: 18, color: '#EDE6F8' },
    stars: 18,
    starOpacity: 0.7,
    clouds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#100F26', 0], ['#171535', 0.35], ['#211C45', 0.65], ['#2E2554', 0.88], ['#392D5F', 1]], tone: 'light' },
  },
  night: {
    sky: ['#141022', '#1E1832', '#2C2444'],
    ridges: ['#251F38', '#211B31', '#1D1729'],
    body: { kind: 'crescent', x: 84, y: 66, r: 15, color: '#E4DDF0' },
    stars: 28,
    starOpacity: 0.75,
    clouds: false,
    plane: false,
    statusBar: 'light',
    full: { sky: [['#0A0A18', 0], ['#100F22', 0.4], ['#18152F', 0.75], ['#211C3B', 1]], tone: 'light' },
  },
};

// Deterministic star field (same sky every launch), kept above the ridges and off the chrome strip.
function seededStars(n: number) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => ({ x: 8 + rnd() * 374, y: 56 + rnd() * 130, r: 0.6 + rnd() * 0.9, o: 0.5 + rnd() * 0.5 }));
}
export const STAR_FIELD = seededStars(28);
