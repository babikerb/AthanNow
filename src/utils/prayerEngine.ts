import { SFSymbol } from 'sf-symbols-typescript';
import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan';

/**
 * Per-row icon for the 6 prayer-list entries (the 5 real prayers + the
 * sunrise boundary marker), shared between the Athan/home screen's list and
 * Calendar's day rows so the same prayer always shows the same glyph in both
 * places, one source, not two screens independently picking similar-looking
 * icons. Deliberately distinct from `getCelestialConfig`'s `symbol` field
 * below, which represents the *sky stage* (the celestial-arc body/animation)
 * rather than "which prayer is this row", the two concepts overlap for some
 * prayers but not all (Fajr's sky-stage symbol is a moon, since it's before
 * sunrise; its list icon is a sunrise glyph, since Fajr the *prayer* marks
 * dawn approaching).
 */
export const PRAYER_LIST_ICONS: Record<string, SFSymbol> = {
  fajr: 'sunrise.fill',
  sunrise: 'sunrise', // outline variant, a boundary marker, not one of the 5 prayers
  dhuhr: 'sun.max.fill',
  asr: 'sun.min.fill',
  maghrib: 'sunset.fill',
  isha: 'moon.stars.fill',
};

export interface CelestialConfig {
  angle: number;
  /** SF Symbol name rendered via expo-symbols (no emoji). */
  symbol: string;
  twinkle: boolean;
  arabicName: string;
}

export function getCelestialConfig(prayerName: string): CelestialConfig {
  switch (prayerName.toLowerCase()) {
    case 'fajr':
      return { angle: 152, symbol: 'moon.stars.fill', twinkle: true, arabicName: 'الفجر' };
    case 'sunrise':
      return { angle: 120, symbol: 'sunrise.fill', twinkle: false, arabicName: 'الشروق' };
    case 'dhuhr':
      return { angle: 100, symbol: 'sun.max.fill', twinkle: false, arabicName: 'الظهر' };
    case 'asr':
      return { angle: 65, symbol: 'cloud.sun.fill', twinkle: false, arabicName: 'العصر' };
    case 'maghrib':
      return { angle: 30, symbol: 'sunset.fill', twinkle: true, arabicName: 'المغرب' };
    case 'isha':
    default:
      return { angle: 22, symbol: 'moon.fill', twinkle: true, arabicName: 'العشاء' };
  }
}

export function formatCountdown(now: Date, nextPrayerTime: Date): string {
  const diffMs = nextPrayerTime.getTime() - now.getTime();
  if (diffMs <= 0) return "Now";

  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m`;
  }
  return `${minutes}m ${pad(seconds)}s`;
}

export function getPrayerTimes(
  coords: { latitude: number; longitude: number }, 
  date: Date,
  methodName: string,
  asrRule: string
) {
  const coordinates = new Coordinates(coords.latitude, coords.longitude);
  
  const methodKey = methodName as keyof typeof CalculationMethod;
  const factory = CalculationMethod[methodKey] as (() => ReturnType<typeof CalculationMethod.MuslimWorldLeague>) | undefined;
  const params = typeof factory === 'function' ? factory() : CalculationMethod.MuslimWorldLeague();

  params.madhab = asrRule === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  // Keeps Fajr/Isha sane in high-latitude regions where the sun never reaches the angle.
  params.highLatitudeRule = HighLatitudeRule.TwilightAngle;

  const pTimes = new PrayerTimes(coordinates, date, params);

  const rows = [
    { id: 'fajr', label: 'Fajr', time: pTimes.fajr },
    { id: 'sunrise', label: 'Sunrise', time: pTimes.sunrise },
    { id: 'dhuhr', label: 'Dhuhr', time: pTimes.dhuhr },
    { id: 'asr', label: 'Asr', time: pTimes.asr },
    { id: 'maghrib', label: 'Maghrib', time: pTimes.maghrib },
    { id: 'isha', label: 'Isha', time: pTimes.isha },
  ];

  let currentPrayer = pTimes.currentPrayer() === 'none' ? 'isha' : pTimes.currentPrayer();
  const nextPrayerKey = pTimes.nextPrayer();
  
  let nextPrayerName = nextPrayerKey === 'none' ? 'fajr' : nextPrayerKey;
  let nextPrayerTime = pTimes.timeForPrayer(nextPrayerKey);

  if (nextPrayerKey === 'none' || !nextPrayerTime) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = new PrayerTimes(coordinates, tomorrow, params);
    nextPrayerTime = tomorrowTimes.fajr;
    nextPrayerName = 'fajr';
  }

  return {
    currentPrayer,
    nextPrayer: nextPrayerName.charAt(0).toUpperCase() + nextPrayerName.slice(1),
    nextPrayerTime,
    listRows: rows
  };
}

export function getHijriDate(date: Date): string {
  return new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}