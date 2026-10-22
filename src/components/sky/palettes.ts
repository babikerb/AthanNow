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
  /** Status bar icons over the top of this sky. */
  statusBar: 'light' | 'dark';
}

// Coordinates are in the scene's 390 x 340 viewBox.
export const SCENES: Record<ScenePeriod, ScenePalette> = {
  fajr: {
    sky: ['#1B1830', '#2C2747', '#4A3B5E', '#6B4A63'],
    ridges: ['#3A3352', '#2B2540', '#211B30'],
    body: { kind: 'crescent', x: 300, y: 96, r: 11, color: '#E7E3F8', waning: true },
    stars: 12,
    starOpacity: 0.45,
    clouds: false,
    statusBar: 'light',
  },
  sunrise: {
    sky: ['#2E3352', '#5A5872', '#B88A86', '#E2A884'],
    ridges: ['#8C7488', '#5B4C66', '#33293F'],
    body: { kind: 'sun', x: 112, y: 214, r: 28, color: '#F6D7A8' },
    stars: 0,
    starOpacity: 0,
    clouds: false,
    statusBar: 'light',
  },
  dhuhr: {
    sky: ['#6A8AA1', '#8FA9B9', '#B5C4CB'],
    ridges: ['#8AA0B0', '#627C90', '#3C4C61'],
    body: { kind: 'sun', x: 92, y: 78, r: 16, color: '#FFF4DC' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    statusBar: 'light',
  },
  asr: {
    sky: ['#5F7E7C', '#93A89E', '#C2B9A0'],
    ridges: ['#8E9A8C', '#5F6E68', '#36404A'],
    body: { kind: 'sun', x: 304, y: 128, r: 20, color: '#F3D9A6' },
    stars: 0,
    starOpacity: 0,
    clouds: true,
    statusBar: 'light',
  },
  maghrib: {
    sky: ['#3B2E4F', '#8A5A6A', '#D98C6A', '#E9A27A'],
    ridges: [],
    body: { kind: 'sun', x: 282, y: 214, r: 60, color: '#F7D9B0' },
    stars: 5,
    starOpacity: 0.3,
    clouds: false,
    statusBar: 'light',
  },
  isha: {
    sky: ['#1A1530', '#2A2148', '#3E2D63'],
    ridges: ['#2A2340', '#221C35', '#1E1829'],
    body: { kind: 'crescent', x: 306, y: 78, r: 18, color: '#EDE6F8' },
    stars: 18,
    starOpacity: 0.7,
    clouds: false,
    statusBar: 'light',
  },
  night: {
    sky: ['#141022', '#1E1832', '#2C2444'],
    ridges: ['#251F38', '#211B31', '#1D1729'],
    body: { kind: 'crescent', x: 84, y: 66, r: 15, color: '#E4DDF0' },
    stars: 28,
    starOpacity: 0.75,
    clouds: false,
    statusBar: 'light',
  },
};

// Deterministic star field (same sky every launch), kept above the ridges and off the chrome strip.
function seededStars(n: number) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => ({ x: 8 + rnd() * 374, y: 56 + rnd() * 130, r: 0.6 + rnd() * 0.9, o: 0.5 + rnd() * 0.5 }));
}
export const STAR_FIELD = seededStars(28);
