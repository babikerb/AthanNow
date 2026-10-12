import React, { createContext, useContext, useMemo } from 'react';

import { useTheme as useDesignTheme } from '../design/theme';
import { darkPalette, lightPalette, Palette, prayerGradients } from '../theme/colors';

interface ThemeContextValue {
  colors: Palette;
  /** Atmospheric gradients keyed by prayer stage for the Athan sky scene. */
  prayerGradients: Record<string, string[]>;
}

// Legacy bridge: screens not yet migrated to `src/design` still read `useTheme().colors`. It now follows the design
// ThemeProvider's resolved scheme, so Appearance applies to them too. Remove once every consumer is migrated.
const ThemeContext = createContext<ThemeContextValue>({ colors: darkPalette, prayerGradients });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { scheme } = useDesignTheme();
  const value = useMemo<ThemeContextValue>(() => ({ colors: scheme === 'dark' ? darkPalette : lightPalette, prayerGradients }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
