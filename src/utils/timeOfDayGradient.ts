import { prayerGradients } from '../theme/colors';

/**
 * A coarse, device-clock-only gradient bucket for onboarding (plan §4.4).
 *
 * Onboarding runs before the user's real location/calc-method are resolved,
 * so it can't compute an accurate prayer-stage gradient the way the Athan
 * screen does. Locking onboarding to a single hardcoded stage (the app
 * previously always showed Isha) produced a jarring cut the moment the real
 * Athan screen took over with the correct stage for the actual time of day.
 *
 * This bucket is deliberately approximate (not solar-accurate) — it only
 * needs to avoid showing "night" at noon or "midday" at 2am for the ~six
 * screens of onboarding, not replace the real `prayerEngine` calculation.
 */
export type GradientBucket = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export function timeOfDayBucket(date: Date = new Date()): GradientBucket {
  const h = date.getHours();
  if (h >= 0 && h < 5) return 'fajr';
  if (h >= 5 && h < 7) return 'sunrise';
  if (h >= 7 && h < 15) return 'dhuhr';
  if (h >= 15 && h < 18) return 'asr';
  if (h >= 18 && h < 20) return 'maghrib';
  return 'isha';
}

/** The gradient stop array for the current device-clock hour. */
export function onboardingGradient(date: Date = new Date()): string[] {
  return prayerGradients[timeOfDayBucket(date)];
}
