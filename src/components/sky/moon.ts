// The real moon's phase, to the accuracy a drawing needs (Meeus, Astronomical Algorithms ch. 48,
// main terms: the lit fraction is within a percent or so).

export interface MoonPhase {
  /** 0 new, 1 full. */
  fraction: number;
  waxing: boolean;
  /** Lit on the right as seen from here: waxing in the north, waning in the south. */
  litRight: boolean;
}

// A new moon can't be seen; the sky keeps the thinnest crescent rather than an empty arc.
const THINNEST = 0.05;

export function moonPhase(date: Date, latitude = 0): MoonPhase {
  const rad = Math.PI / 180;
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  const D = (297.8501921 + 445267.1114034 * T) * rad; // mean elongation
  const M = (357.5291092 + 35999.0502909 * T) * rad; // sun's mean anomaly
  const N = (134.9633964 + 477198.8675055 * T) * rad; // moon's mean anomaly
  const i =
    Math.PI -
    D -
    rad * (6.289 * Math.sin(N) - 2.1 * Math.sin(M) + 1.274 * Math.sin(2 * D - N) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * N) + 0.11 * Math.sin(D));
  const fraction = (1 + Math.cos(i)) / 2;
  // The phase angle has the sign of the half of the month: 180 at new, through 0 at full.
  const waxing = Math.sin(i) > 0;
  return { fraction: Math.max(THINNEST, Math.round(fraction * 50) / 50), waxing, litRight: latitude < 0 ? !waxing : waxing };
}

/** The lit part of a moon of radius `r` centred on 0,0, as SVG path data. */
export function moonPath(r: number, fraction: number, litRight: boolean): string {
  const rx = Math.abs(1 - 2 * fraction) * r;
  // Down the lit limb, then back up along the terminator: bulging towards the limb for a crescent.
  const limb = litRight ? 1 : 0;
  const back = fraction < 0.5 ? 1 - limb : limb;
  return `M0 ${-r} A${r} ${r} 0 0 ${limb} 0 ${r} A${rx} ${r} 0 0 ${back} 0 ${-r} Z`;
}
