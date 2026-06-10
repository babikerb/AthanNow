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
