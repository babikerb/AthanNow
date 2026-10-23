/**
 * Significant Islamic calendar dates, matched against a Gregorian date via
 * the same `islamic-umalqura` (Umm al-Qura) calendar `getHijriDate` in
 * `prayerEngine.ts` already uses for display, one source of truth for Hijri
 * conversion, not a second Hijri library or hand-rolled astronomical
 * calculation.
 *
 * These are *calculated* civil-calendar dates. Real observance of the
 * Islamic calendar is moon-sighting-based and can shift by a day from the
 * calculated date depending on region and authority, callers should present
 * these as "calculated" / approximate, not as a guaranteed-precise fact.
 */

export interface ImportantDate {
  /** Hijri month, 1-12 (1 = Muharram). */
  month: number;
  /** Hijri day of month. */
  day: number;
  label: string;
}

export const IMPORTANT_DATES: ImportantDate[] = [
  { month: 1, day: 1, label: 'Islamic New Year' },
  { month: 1, day: 10, label: 'Ashura' },
  { month: 3, day: 12, label: "Mawlid al-Nabi" },
  { month: 9, day: 1, label: 'Ramadan begins' },
  { month: 9, day: 27, label: 'Laylat al-Qadr (commonly observed)' },
  { month: 10, day: 1, label: 'Eid al-Fitr' },
  { month: 12, day: 9, label: 'Day of Arafah' },
  { month: 12, day: 10, label: 'Eid al-Adha' },
];

const hijriPartsFormatter = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
});

/** This date's Hijri (month, day), read via `Intl`'s numeric parts (not by
 *  parsing `getHijriDate`'s localized string) so it's unambiguous. */
function hijriMonthDay(date: Date): { month: number; day: number } {
  const parts = hijriPartsFormatter.formatToParts(date);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { month, day };
}

/** The important-date label for this Gregorian date, if it lands on one,
 *  null otherwise. At most one label per day (the table above has no
 *  collisions). */
export function importantDateFor(date: Date): string | null {
  const { month, day } = hijriMonthDay(date);
  return IMPORTANT_DATES.find((d) => d.month === month && d.day === day)?.label ?? null;
}
