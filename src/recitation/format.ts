const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** 12 -> ١٢, for ayah numbers set beside Arabic text. */
export function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** 75.4 -> "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 1 -> "1x", 1.25 -> "1.25x". */
export function rateLabel(rate: number): string {
  return `${rate}x`;
}

/** The family name the Uthmani Quran face is loaded under (App.tsx). */
export const QURAN_FONT = 'AmiriQuran';
