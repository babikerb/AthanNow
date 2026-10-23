import { CalcMethod } from '../context/SettingsContext';

/**
 * The 12 calculation methods the app supports, with their display labels.
 * Single source of truth, both Settings and onboarding's calc-method screen
 * (plan §4.2 Screen 3) read from this instead of maintaining two lists that
 * can drift apart.
 */
export const CALC_METHODS: { key: CalcMethod; label: string }[] = [
  { key: 'NorthAmerica', label: 'ISNA (North America)' },
  { key: 'MuslimWorldLeague', label: 'Muslim World League' },
  { key: 'Egyptian', label: 'Egyptian General Authority' },
  { key: 'Karachi', label: 'University of Karachi' },
  { key: 'UmmAlQura', label: 'Umm al-Qura (Makkah)' },
  { key: 'Dubai', label: 'Dubai' },
  { key: 'Qatar', label: 'Qatar' },
  { key: 'Kuwait', label: 'Kuwait' },
  { key: 'Singapore', label: 'Singapore' },
  { key: 'Turkey', label: 'Turkey (Diyanet)' },
  { key: 'Tehran', label: 'Tehran' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
];

/**
 * One-line "why" copy shown under the smart-default selection on onboarding's
 * calc-method screen (and reusable anywhere else a method needs a plain-
 * language explanation, e.g. a future Settings annotation per plan §3.7).
 */
export const CALC_METHOD_WHY: Record<CalcMethod, string> = {
  NorthAmerica: 'Common in North America.',
  MuslimWorldLeague: 'A widely used global standard.',
  Egyptian: 'Common in Egypt and parts of Africa.',
  Karachi: 'Common in South Asia.',
  UmmAlQura: 'Used in Saudi Arabia.',
  Dubai: 'Used in the United Arab Emirates.',
  Qatar: 'Used in Qatar.',
  Kuwait: 'Used in Kuwait.',
  Singapore: 'Used in Singapore.',
  Turkey: 'Used in Turkey.',
  Tehran: 'Used in Iran.',
  MoonsightingCommittee: 'Based on local moonsighting committee criteria.',
};

/**
 * Country (ISO 3166-1 alpha-2) -> calculation-method smart default (plan §4.2
 * Screen 3). `DEFAULT_SETTINGS.calcMethod` used to apply 'NorthAmerica'
 * unconditionally regardless of where the user actually is, reasonable only
 * for North American users, silently wrong-by-convention for everyone else.
 * This table is intentionally small (covers the common cases the app's own
 * 12 methods map to); anything not listed falls through to the most
 * globally-neutral method, Muslim World League.
 */
const COUNTRY_TO_METHOD: Record<string, CalcMethod> = {
  // Gulf
  SA: 'UmmAlQura',
  AE: 'Dubai',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'UmmAlQura',
  OM: 'UmmAlQura',
  // North Africa / Middle East
  EG: 'Egyptian',
  // Turkey
  TR: 'Turkey',
  // South Asia
  PK: 'Karachi',
  IN: 'Karachi',
  BD: 'Karachi',
  AF: 'Karachi',
  // Iran
  IR: 'Tehran',
  // North America
  US: 'NorthAmerica',
  CA: 'NorthAmerica',
  // Southeast Asia
  SG: 'Singapore',
};

const DEFAULT_METHOD: CalcMethod = 'MuslimWorldLeague';

export function calcMethodForCountry(countryCode?: string | null): CalcMethod {
  if (!countryCode) return DEFAULT_METHOD;
  return COUNTRY_TO_METHOD[countryCode.toUpperCase()] ?? DEFAULT_METHOD;
}

/**
 * Best-effort country code from the device locale (e.g. "en-US" -> "US"),
 * used as the calc-method screen's fallback when location was declined or
 * hasn't resolved yet by the time the user reaches screen 3, approximate by
 * design, same spirit as the time-of-day gradient bucket (§4.4).
 */
export function localeCountryCode(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split('-').pop();
    return region && region.length === 2 ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}
