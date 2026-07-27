const KM_TO_MI = 0.621371;

// Countries that use miles for everyday distances rather than km.
const IMPERIAL_COUNTRY_CODES = new Set(['US', 'LR', 'MM']);

export function isImperialCountry(countryCode?: string): boolean {
  return !!countryCode && IMPERIAL_COUNTRY_CODES.has(countryCode.toUpperCase());
}

/** Formats a km distance as "123 km" or "76 mi" based on the given country. */
export function formatDistance(km: number, countryCode?: string): string {
  if (isImperialCountry(countryCode)) {
    return `${Math.round(km * KM_TO_MI).toLocaleString()} mi`;
  }
  return `${Math.round(km).toLocaleString()} km`;
}
