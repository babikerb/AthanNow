// How the reader is laid out (the page, ayah by ayah, word by word), the size of flowing text, and
// whether the screen stays awake. The colours are the app's own.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReaderView } from 'quran-reader';
import { useCallback, useEffect, useState } from 'react';
import { palette } from '../theme/theme';

const KEY = 'athannow.quran.display.v1';

export interface DisplaySettings {
  view: ReaderView;
  /** The flowing text's size (1 is the printed page's own); set by pinching. */
  textScale: number;
  translit: boolean;
  keepAwake: boolean;
  /** The page's colour, for the mushaf alone: the app's own (system), or a page of its own. */
  pageColor: PageColour;
}

export type PageColour = 'system' | 'white' | 'cream' | 'charcoal' | 'midnight';

export interface PagePalette {
  bg: string;
  text: string;
  /** The highlight on the word being recited. */
  accent: string;
  /** The colour recited words turn. */
  recited: string;
  dark: boolean;
}

/** Each page colour with text and accents chosen to read well on it. */
export const PAGE_PALETTES: Record<Exclude<PageColour, 'system'>, PagePalette> = palette.page;

const DEFAULTS: DisplaySettings = { view: 'mushaf', textScale: 1.6, translit: false, keepAwake: true, pageColor: 'system' };

export function useDisplaySettings() {
  const [s, setS] = useState<DisplaySettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<DisplaySettings>;
        setS({ ...DEFAULTS, ...saved });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, [s, ready]);

  const set = useCallback((p: Partial<DisplaySettings>) => setS((x) => ({ ...x, ...p })), []);
  return { ...s, set };
}

export type Display = ReturnType<typeof useDisplaySettings>;
