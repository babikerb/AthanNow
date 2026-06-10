import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkPalette, lightPalette, Palette, prayerGradients } from '../theme/colors';

interface ThemeContextValue {
  scheme: 'light' | 'dark';
  colors: Palette;
  /** Atmospheric gradients keyed by prayer stage for the Athan sky scene. */
  prayerGradients: Record<string, string[]>;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'dark',
  colors: darkPalette,
  prayerGradients,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Default Quran/Settings surfaces follow the system theme per spec.
  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' = systemScheme === 'light' ? 'light' : 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'light' ? lightPalette : darkPalette,
      prayerGradients,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
