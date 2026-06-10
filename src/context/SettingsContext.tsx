import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'athannow.settings.v1';

export type CalcMethod =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Turkey'
  | 'Tehran';

export type AsrMadhab = 'Standard' | 'Hanafi';
export type QuranLineMode = '15' | '13';
export type ScrollDirection = 'horizontal' | 'vertical';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface NotificationSettings {
  /** Per-prayer athan (adhan) notification toggles. */
  athanEnabled: Record<PrayerKey, boolean>;
  /** Plays the full adhan sound instead of the default tone. */
  athanSound: boolean;
  /** Minutes before each prayer to fire the reminder (0 = exactly at athan). */
  reminderMinutesBefore: number;
  /** "Good morning, start your day with Quran" notification around sunrise. */
  quranMorningEnabled: boolean;
}

export interface Settings {
  /** 12-hour clock by default; toggle to 24-hour. */
  use24Hour: boolean;
  calcMethod: CalcMethod;
  asrMadhab: AsrMadhab;
  notifications: NotificationSettings;
  quranLineMode: QuranLineMode;
  quranScrollDirection: ScrollDirection;
  onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  use24Hour: false,
  calcMethod: 'NorthAmerica',
  asrMadhab: 'Standard',
  notifications: {
    athanEnabled: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    athanSound: true,
    reminderMinutesBefore: 10,
    quranMorningEnabled: false,
  },
  quranLineMode: '15',
  quranScrollDirection: 'horizontal',
  onboardingComplete: false,
};

export interface SettingsContextValue extends Settings {
  /** True once persisted settings have loaded from storage. */
  ready: boolean;
  update: (partial: Partial<Settings>) => void;
  updateNotifications: (partial: Partial<NotificationSettings>) => void;
  /** Resets everything to defaults, including onboarding (the "clear all data" action). */
  resetAllData: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULT_SETTINGS,
  ready: false,
  update: () => {},
  updateNotifications: () => {},
  resetAllData: async () => {},
});

function mergeSettings(base: Settings, stored: Partial<Settings> | null): Settings {
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    notifications: {
      ...base.notifications,
      ...(stored.notifications ?? {}),
      athanEnabled: {
        ...base.notifications.athanEnabled,
        ...(stored.notifications?.athanEnabled ?? {}),
      },
    },
  };
}

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSettings(mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw)));
      } catch {
        // Corrupt or missing storage falls back to defaults.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: Settings) => {
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const update = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = mergeSettings(prev, partial);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const updateNotifications = useCallback(
    (partial: Partial<NotificationSettings>) => {
      setSettings((prev) => {
        const next: Settings = {
          ...prev,
          notifications: {
            ...prev.notifications,
            ...partial,
            athanEnabled: { ...prev.notifications.athanEnabled, ...(partial.athanEnabled ?? {}) },
          },
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const resetAllData = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, ready, update, updateNotifications, resetAllData }),
    [settings, ready, update, updateNotifications, resetAllData],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
