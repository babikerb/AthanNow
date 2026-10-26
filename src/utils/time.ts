/**
 * Centralized time formatting so the 12h / 24h preference is honored everywhere.
 * `use24Hour` comes from SettingsContext; default app behavior is 12-hour.
 */

export function formatClock(date: Date, use24Hour: boolean, timeZone?: string): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour,
    timeZone,
  });
}

/**
 * Returns a Date whose LOCAL calendar components (year/month/day) match the
 * current day at `timeZone`. adhan reads these components to pick the solar day,
 * so this keeps prayer times correct when viewing a location in another timezone.
 */
export function localDayAnchor(now: Date, timeZone?: string): Date {
  if (!timeZone) return now;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return new Date(get('year'), get('month') - 1, get('day'), 12, 0, 0);
  } catch {
    return now;
  }
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st, 22nd, 23rd ... */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** "October 26th 2026" */
export function formatLongDate(d: Date): string {
  return `${d.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(d.getDate())} ${d.getFullYear()}`;
}

/** "Monday, October 26th" */
export function formatDayHeading(d: Date): string {
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(d.getDate())}`;
}
