import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import tzlookup from 'tz-lookup';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'athannow.location.v1';

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
}

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

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

export function useLocation() {
  const [location, setLocation] = useState<AppLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  // Restore the last known location immediately so the UI isn't blank on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setLocation(JSON.parse(raw));
          setStatus('ready');
        }
      } catch {
        // ignore
      }
      // If the stored location was manual, respect it; otherwise refresh from GPS.
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      const stored: AppLocation | null = raw ? JSON.parse(raw) : null;
      if (!stored?.isManual) refreshLocation();
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
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
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
      });
    } catch {
      setStatus('error');
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
        persist({ latitude, longitude, city, timezone: timeZoneFor(latitude, longitude), isManual: true });
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
      });
    },
    [persist],
  );

  const cityName =
    location?.city ??
    (status === 'denied' ? 'Location off' : status === 'loading' ? 'Locating' : 'Loading');

  return { location, cityName, status, refreshLocation, setLocationByQuery, setLocationByPlace };
}
