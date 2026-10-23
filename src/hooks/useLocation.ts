import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import tzlookup from 'tz-lookup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const STORAGE_KEY = 'athannow.location.v1';
const RECENTS_KEY = 'athannow.location.recents.v1';
const TRAVEL_DISMISS_KEY = 'athannow.location.travelDismissed.v1';
/** Same key, exported so the background-refresh task can read the saved location. */
export const LOCATION_STORAGE_KEY = STORAGE_KEY;

const MAX_RECENTS = 5;
/** A GPS fix older than this is refreshed when the app comes back to the foreground. */
const STALE_FIX_MS = 30 * 60 * 1000;

export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

const deviceLanguage = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0] || 'en';
  } catch {
    return 'en';
  }
};

/** Resolve an IANA timezone from coordinates offline, falling back to the device zone. */
function timeZoneFor(latitude: number, longitude: number): string {
  try {
    return tzlookup(latitude, longitude);
  } catch {
    return deviceTimeZone();
  }
}

/** "America/New_York" -> "New York". */
export function zoneCity(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

export interface AppLocation {
  latitude: number;
  longitude: number;
  /** Place name only ("London"). Read by the widget and background refresh. */
  city: string;
  /** State/region and country, for lists. Older saves lack it. */
  region?: string;
  /** IANA timezone of this location, so prayer times render in local time. */
  timezone: string;
  /** True when the user picked this place rather than using GPS. */
  isManual: boolean;
  /** ISO 3166-1 alpha-2, used for the regional calculation-method default. */
  countryCode?: string;
  /** When this location was set (ms). Used to refresh a stale GPS fix. */
  updatedAt?: number;
}

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';
export type PermissionKind = 'granted' | 'undetermined' | 'denied';

export interface LocationPermissionState {
  status: Location.PermissionStatus;
  canAskAgain: boolean;
  /** iOS "Precise Location" switched off: fixes are a few km off. Fine for prayer times. */
  approximate?: boolean;
}

/** Checks the current foreground location permission without prompting. */
export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const r = await Location.getForegroundPermissionsAsync();
  return { status: r.status, canAskAgain: r.canAskAgain, approximate: r.ios?.accuracy === 'reduced' };
}

/** Prompts for foreground location permission (only shows the OS dialog when it still can). */
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  const r = await Location.requestForegroundPermissionsAsync();
  return { status: r.status, canAskAgain: r.canAskAgain, approximate: r.ios?.accuracy === 'reduced' };
}

/** Great-circle distance in km. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Prayer times shift by about a minute per ~15 km east-west; past this we treat the user as somewhere new. */
export const MOVED_KM = 10;

/**
 * Builds a GPS location for a fix. Naming needs the network; offline, a fix near the previous one keeps
 * its name, and a far one is called "Current location" until the next refresh names it.
 */
export async function locationFromFix(latitude: number, longitude: number, prev?: AppLocation | null): Promise<AppLocation> {
  const geocode = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  const g = geocode[0];
  const near = !!prev && !prev.isManual && distanceKm(prev, { latitude, longitude }) < MOVED_KM;
  return {
    latitude,
    longitude,
    city: g?.city || g?.district || g?.subregion || g?.region || (near ? prev!.city : 'Current location'),
    region: [g?.region, g?.country].filter(Boolean).join(', ') || (near ? prev!.region : undefined),
    timezone: timeZoneFor(latitude, longitude),
    isManual: false,
    countryCode: g?.isoCountryCode || (near ? prev!.countryCode : undefined),
    updatedAt: Date.now(),
  };
}

/**
 * Cheap travel check for the background task and app resume: the OS's cached position, no new fix.
 * Returns the new location if the user is now somewhere else, otherwise null.
 */
export async function detectMove(prev: AppLocation): Promise<AppLocation | null> {
  if (prev.isManual) return null;
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (perm?.status !== 'granted') return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 }).catch(() => null);
  if (!last) return null;
  const { latitude, longitude } = last.coords;
  if (distanceKm(prev, { latitude, longitude }) < MOVED_KM) return null;
  return locationFromFix(latitude, longitude, prev);
}

// 'denied' means iOS will no longer show the prompt: only Settings can change it.
const toKind = (p: LocationPermissionState): PermissionKind =>
  p.status === 'granted' ? 'granted' : p.status === 'denied' && !p.canAskAgain ? 'denied' : 'undetermined';

/**
 * Used until the user has a real location, so the app always works without GPS (App Store 5.1.5).
 * Home says plainly that these are Mecca's times.
 */
const DEFAULT_LOCATION: AppLocation = {
  latitude: 21.4225,
  longitude: 39.8262,
  city: 'Mecca',
  region: 'Saudi Arabia',
  timezone: 'Asia/Riyadh',
  isManual: false,
  countryCode: 'SA',
};

/** Reject after `ms` so a stalled GPS read (Location Services off device-wide) can't hang the flow. */
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
  admin1?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export type SearchResult = { ok: true; places: PlaceSuggestion[] } | { ok: false };

/**
 * City autocomplete via the Open-Meteo geocoding API (no key; population-ranked; returns the
 * timezone, so a pick needs no second request). Distinguishes "no matches" from "couldn't search".
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, places: [] };
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${deviceLanguage()}&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return { ok: false };
    const json = await res.json();
    return {
      ok: true,
      places: (json.results ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        admin1: r.admin1,
        country: r.country,
        countryCode: r.country_code,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
      })),
    };
  } catch {
    return { ok: false };
  }
}

/** Whether two zones currently show the same wall-clock time (London and Lisbon do). */
function sameClock(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const now = new Date();
    const fmt = (tz: string) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    return fmt(a) === fmt(b);
  } catch {
    return true;
  }
}

const sameLocation = (a: AppLocation, b: AppLocation) => Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

/** The single location state machine. Consumed ONLY by `LocationProvider`; screens use `useLocation()`. */
export function useLocationState() {
  // Seeded so the UI always renders. Anything that persists (widget, notifications) must wait for
  // `hasRestored`, or a Mecca write can clobber the real saved city.
  const [location, setLocation] = useState<AppLocation>(DEFAULT_LOCATION);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [hasRestored, setHasRestored] = useState(false);
  const [permission, setPermission] = useState<PermissionKind>('undetermined');
  const [approximate, setApproximate] = useState(false);
  const [recents, setRecents] = useState<AppLocation[]>([]);
  const [travelDismissedFor, setTravelDismissedFor] = useState<string | null>(null);
  const [deviceTz, setDeviceTz] = useState(deviceTimeZone);
  const locationRef = useRef(location);
  locationRef.current = location;

  const persist = useCallback((loc: AppLocation) => {
    const stamped = { ...loc, updatedAt: Date.now() };
    setLocation(stamped);
    setStatus('ready');
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stamped)).catch(() => {});
    if (stamped.isManual) {
      setRecents((prev) => {
        const next = [stamped, ...prev.filter((r) => !sameLocation(r, stamped))].slice(0, MAX_RECENTS);
        AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, []);

  const checkPermission = useCallback(async () => {
    const p = await getLocationPermissionState().catch(() => null);
    if (p) {
      setPermission(toKind(p));
      setApproximate(!!p.approximate);
    }
    return p;
  }, []);

  /**
   * Switch to GPS. Asks for permission only if iOS still can (never prompts after a permanent denial).
   * A fix is kept even when naming it fails offline; the name fills in on the next refresh.
   */
  const refreshLocation = useCallback(async () => {
    setStatus('loading');
    try {
      const p = await requestLocationPermission();
      setPermission(toKind(p));
      setApproximate(!!p.approximate);
      if (p.status !== 'granted') {
        setStatus('denied');
        return;
      }
      // A recent cached fix is instant and plenty for prayer times; only ask the GPS when there isn't one.
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 1000 }).catch(() => null);
      const fix = cached ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000));
      persist(await locationFromFix(fix.coords.latitude, fix.coords.longitude, locationRef.current));
    } catch {
      setStatus('error');
    }
  }, [persist]);

  // Restore the saved location and recents, then refresh GPS silently if already allowed.
  // Never prompt from here: the first ask belongs to onboarding or an explicit tap.
  useEffect(() => {
    (async () => {
      try {
        const [raw, recentsRaw, dismissed] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(RECENTS_KEY),
          AsyncStorage.getItem(TRAVEL_DISMISS_KEY),
        ]);
        if (recentsRaw) setRecents(JSON.parse(recentsRaw));
        setTravelDismissedFor(dismissed);
        const stored: AppLocation | null = raw ? JSON.parse(raw) : null;
        if (stored) {
          setLocation(stored);
          setStatus('ready');
        }
        const p = await checkPermission();
        if (stored?.isManual) return;
        if (p?.status === 'granted') await refreshLocation();
        else if (p?.status === 'denied') setStatus('denied');
      } catch {
        // keep the seed
      } finally {
        setHasRestored(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back to the app: re-read the permission (the user may have just changed it in Settings),
  // pick up a new device timezone, and refresh a stale GPS fix so travellers get their new city.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      setDeviceTz(deviceTimeZone());
      const savedRaw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (savedRaw) {
        const saved: AppLocation = JSON.parse(savedRaw);
        if ((saved.updatedAt ?? 0) > (locationRef.current.updatedAt ?? 0)) {
          locationRef.current = saved;
          setLocation(saved);
        }
      }
      const p = await checkPermission();
      const loc = locationRef.current;
      if (loc.isManual || p?.status !== 'granted') return;
      const moved = await detectMove(loc);
      if (moved) persist(moved);
      else if (!loc.updatedAt || Date.now() - loc.updatedAt > STALE_FIX_MS) refreshLocation();
    });
    return () => sub.remove();
  }, [checkPermission, refreshLocation, persist]);

  const setLocationByPlace = useCallback(
    (p: PlaceSuggestion) => {
      persist({
        latitude: p.latitude,
        longitude: p.longitude,
        city: p.name,
        region: [p.admin1, p.country].filter(Boolean).join(', ') || undefined,
        timezone: p.timezone || timeZoneFor(p.latitude, p.longitude),
        isManual: true,
        countryCode: p.countryCode,
      });
    },
    [persist],
  );

  const selectRecent = useCallback((loc: AppLocation) => persist({ ...loc, isManual: true }), [persist]);

  const removeRecent = useCallback((loc: AppLocation) => {
    setRecents((prev) => {
      const next = prev.filter((r) => !sameLocation(r, loc));
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Travel hint without asking for location: the phone's clock zone no longer matches a manually
  // chosen city's zone (e.g. landed in Istanbul with London selected).
  const travelKey = `${location.timezone}>${deviceTz}`;
  // A string (the phone's zone city) rather than an object, so the context value stays stable.
  const travelMismatch =
    hasRestored && location.isManual && !sameClock(location.timezone, deviceTz) && travelDismissedFor !== travelKey ? zoneCity(deviceTz) : null;
  const dismissTravel = useCallback(() => {
    setTravelDismissedFor(travelKey);
    AsyncStorage.setItem(TRAVEL_DISMISS_KEY, travelKey).catch(() => {});
  }, [travelKey]);

  const cityName = location.city;

  return {
    location,
    cityName,
    status,
    hasRestored,
    permission,
    approximate,
    recents,
    travelMismatch,
    refreshLocation,
    setLocationByPlace,
    selectRecent,
    removeRecent,
    dismissTravel,
  };
}
