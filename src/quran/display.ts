// How the reader looks: the view (Mushaf, Translation, Word by word), the page and text colours, the
// size of flowing text, and whether the screen stays awake. Kept apart from the app's appearance.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PageColor, ReaderView, TextTone } from 'quran-reader';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const KEY = 'athannow.quran.display.v1';
// The old light or dark switch, read once so the choice carries over.
const OLD_DARK_KEY = 'athannow.quran.reader.dark.v1';

/** Text sizes for the flowing views, small to large (1 is the printed page's own size). */
export const TEXT_SCALES = [1.15, 1.35, 1.6, 1.85, 2.15, 2.5, 2.9];

export interface DisplaySettings {
  view: ReaderView;
  /** Null follows iOS: Night in dark mode, Paper in light. */
  pageColor: PageColor | null;
  textTone: TextTone;
  textScale: number;
  translit: boolean;
  keepAwake: boolean;
}

const DEFAULTS: DisplaySettings = { view: 'mushaf', pageColor: null, textTone: 'standard', textScale: TEXT_SCALES[2], translit: false, keepAwake: true };

export const isDarkColor = (c: PageColor) => c === 'night' || c === 'charcoal';

export function useDisplaySettings() {
  const system = useColorScheme();
  const [s, setS] = useState<DisplaySettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(OLD_DARK_KEY)])
      .then(([raw, oldDark]) => {
        if (raw) setS({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<DisplaySettings>) });
        else if (oldDark != null) setS({ ...DEFAULTS, pageColor: oldDark === '1' ? 'night' : 'paper' });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, [s, ready]);

  const set = useCallback((p: Partial<DisplaySettings>) => setS((x) => ({ ...x, ...p })), []);
  const pageColor: PageColor = s.pageColor ?? (system === 'dark' ? 'night' : 'paper');
  return { ...s, pageColor, dark: isDarkColor(pageColor), set };
}

export type Display = ReturnType<typeof useDisplaySettings>;
