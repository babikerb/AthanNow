import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import tzlookup from 'tz-lookup';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'athannow.location.v1';
/** Same key, exported so the background-refresh task can read the saved location. */
export const LOCATION_STORAGE_KEY = STORAGE_KEY;

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/** Resolve an IANA timezone from coordinates, falling back to the device zone. */
function timeZoneFor(latitude: number, longitude: number): string {
  try {
    return tzlookup(latitude, longitude);
  } catch {
    return deviceTimeZone();
  }
}

export interface AppLocation {
  latitude: number;
  longitude: number;
  city: string;
  /** IANA timezone of this location, so prayer times render in local time. */
  timezone: string;
  /** True when the user picked this location manually rather than via GPS. */
  isManual: boolean;
  /**
   * ISO 3166-1 alpha-2 country code, when known — used by onboarding's
   * calc-method screen (plan §4.2 Screen 3) to pick a smart regional default
   * instead of silently applying `DEFAULT_SETTINGS.calcMethod` to everyone.
   */
  countryCode?: string;
}

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

/** Result of an `expo-location` foreground-permission check or request,
 *  surfaced verbatim (not collapsed to a boolean) so callers can implement
 *  the three-state ask/granted/permanently-denied flow (plan §4.2a). */
export interface LocationPermissionState {
  status: Location.PermissionStatus;
  canAskAgain: boolean;
}

/** Checks the current foreground location permission without prompting. */
export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  return { status, canAskAgain };
}

/** Prompts for foreground location permission (shows the OS dialog only when
 *  the permission hasn't been permanently denied) and returns the result. */
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return { status, canAskAgain };
}

/**
 * Fallback location used when the device has Location Services disabled (or the
 * permission is denied) and the user hasn't picked a city yet. This guarantees
 * the app is fully functional without GPS — it shows Mecca's prayer times until
 * the user searches for their own city. Required by App Store guideline 5.1.5.
 */
const DEFAULT_LOCATION: AppLocation = {
  latitude: 21.4225,
  longitude: 39.8262,
  city: 'Mecca',
  timezone: 'Asia/Riyadh',
  isManual: false,
  countryCode: 'SA',
};

/** Reject after `ms` so a stalled GPS read (e.g. Location Services switched off
 *  device-wide) can never hang the location flow forever. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** A geocoding autocomplete result (Open-Meteo). */
export interface PlaceSuggestion {
  id: number;
  name: string;
  admin1?: string; // state / region
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

/** A short "City, State, Country" label for a suggestion. */
export function placeLabel(p: PlaceSuggestion): string {
  return [p.name, p.admin1, p.country].filter(Boolean).join(', ');
}

/**
 * Free-text city autocomplete via the Open-Meteo geocoding API (no key needed).
 * Returns named places with coordinates + timezone, so we can show suggestions
 * as the user types and select one without a second round-trip.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      admin1: r.admin1,
      country: r.country,
      countryCode: r.country_code,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    }));
  } catch {
    return [];
  }
}

/** The single location state machine. Consumed ONLY by `LocationProvider` (src/context/LocationContext.tsx); screens use `useLocation()` from there. */
export function useLocationState() {
  // Seed with a default city so the app is *always* functional immediately, even
  // with Location Services disabled and no stored city yet (App Store 5.1.5). The
  // restore effect below replaces it with the user's saved city when there is one,
  // and a successful GPS read replaces it with their real location.
  const [location, setLocation] = useState<AppLocation | null>(DEFAULT_LOCATION);
  const [status, setStatus] = useState<LocationStatus>('idle');
  // True once the AsyncStorage restore below has actually run — false for the
  // brief window where `location` is still just the synchronous DEFAULT_LOCATION
  // seed, not a confirmed answer. `location` itself stays seeded with the Mecca
  // default the whole time (by design — see the comment above the state) so the
  // UI always has something to render immediately; but callers with a *persistent*
  // side effect (writing the iOS widget's App Group data, scheduling local
  // notifications) must wait for `hasRestored` before acting, or a real saved
  // city can get silently clobbered by a Mecca-based write if the app backgrounds
  // in the narrow window before this effect resolves — this was a real, hard-to-
  // reproduce bug ("sometimes I get Mecca/Medina times"): the widget-write effect
  // in `AthanScreen` fires on every `location` change including this first
  // Mecca-seeded render, and if the app closes before the *next* effect run
  // (with the real restored location) corrects it, the widget is left showing
  // Mecca's times until the next successful refresh — which, per
  // `backgroundRefresh.ts`'s own doc comment, is best-effort and can be hours
  // away. In-app display rendering off the seed is fine and intentional;
  // persisted side effects reacting to it are not.
  const [hasRestored, setHasRestored] = useState(false);

  // Restore the last known location immediately so the UI isn't blank on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setLocation(JSON.parse(raw));
          setStatus('ready');
        }
        // If the stored location was manual, respect it; otherwise refresh from
        // GPS — but only silently, i.e. only when permission is *already*
        // granted. Since the merged onboarding flow (src/components/onboarding)
        // now renders the real tab screens (and therefore mounts every screen's
        // own `useLocation()` instance) from app launch, this mount effect
        // running unconditionally would call `refreshLocation()` ->
        // `requestForegroundPermissionsAsync()` and pop the OS location dialog
        // immediately, before onboarding's own priming step ever gets a chance
        // to explain why first. Requesting for the first time must only ever
        // happen from an explicit user action (onboarding's priming step, or
        // manually tapping the location pill) — never a passive mount effect on
        // an undetermined permission.
        const stored: AppLocation | null = raw ? JSON.parse(raw) : null;
        if (stored?.isManual) return;
        const { status: permStatus } = await getLocationPermissionState();
        if (permStatus === 'granted') await refreshLocation();
        // Display state only (no prompt, no location change): lets Home explain a denied permission on cold start.
        else if (permStatus === 'denied') setStatus('denied');
      } catch {
        // ignore
      } finally {
        setHasRestored(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((loc: AppLocation) => {
    setLocation(loc);
    setStatus('ready');
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc)).catch(() => {});
  }, []);

  const refreshLocation = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        // Without GPS the app must still work: fall back to a default city so
        // prayer times render. The user can change it from the location pill.
        setLocation((prev) => prev ?? DEFAULT_LOCATION);
        return;
      }
      // Cap the GPS read: when Location Services are off device-wide, iOS can
      // still report the app as authorized but never returns a fix, which would
      // otherwise hang here forever. On timeout we fall through to the catch.
      const loc = await withTimeout(Location.getCurrentPositionAsync({}), 10000);
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const city = geocode[0]?.city || geocode[0]?.region || 'Current Location';
      persist({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        city,
        timezone: timeZoneFor(loc.coords.latitude, loc.coords.longitude),
        isManual: false,
        countryCode: geocode[0]?.isoCountryCode || undefined,
      });
    } catch {
      setStatus('error');
      // Same fallback if GPS lookup itself fails, so we never strand the user.
      setLocation((prev) => prev ?? DEFAULT_LOCATION);
    }
  }, [persist]);

  /** Geocode a free-text query ("Mecca", "Chicago, IL") into a manual location. */
  const setLocationByQuery = useCallback(
    async (query: string): Promise<boolean> => {
      const trimmed = query.trim();
      if (!trimmed) return false;
      setStatus('loading');
      try {
        const results = await Location.geocodeAsync(trimmed);
        if (!results.length) {
          setStatus(location ? 'ready' : 'error');
          return false;
        }
        const { latitude, longitude } = results[0];
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
        const city = reverse[0]?.city || reverse[0]?.region || trimmed;
        persist({
          latitude,
          longitude,
          city,
          timezone: timeZoneFor(latitude, longitude),
          isManual: true,
          countryCode: reverse[0]?.isoCountryCode || undefined,
        });
        return true;
      } catch {
        setStatus(location ? 'ready' : 'error');
        return false;
      }
    },
    [location, persist],
  );

  /** Persist a chosen autocomplete suggestion directly (no extra geocoding). */
  const setLocationByPlace = useCallback(
    (p: PlaceSuggestion) => {
      const city = [p.name, p.admin1].filter(Boolean).join(', ');
      persist({
        latitude: p.latitude,
        longitude: p.longitude,
        city,
        timezone: p.timezone || timeZoneFor(p.latitude, p.longitude),
        isManual: true,
        countryCode: p.countryCode,
      });
    },
    [persist],
  );

  const cityName =
    location?.city ??
    (status === 'denied' ? 'Location off' : status === 'loading' ? 'Locating' : 'Loading');

  return { location, cityName, status, hasRestored, refreshLocation, setLocationByQuery, setLocationByPlace };
}
