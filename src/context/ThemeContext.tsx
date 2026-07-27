import React, { createContext, useContext } from 'react';

import { darkPalette, Palette, prayerGradients } from '../theme/colors';

interface ThemeContextValue {
  colors: Palette;
  /** Atmospheric gradients keyed by prayer stage for the Athan sky scene. */
  prayerGradients: Record<string, string[]>;
}

// The app is dark-mode only by design, no system-theme following. This
// context still exists so palette/gradient tokens have one shared access
// point (`useTheme()`) instead of every screen importing `darkPalette`
// directly, not because the value itself can ever vary, so it's a plain
// constant rather than state.
const value: ThemeContextValue = { colors: darkPalette, prayerGradients };

const ThemeContext = createContext<ThemeContextValue>(value);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
);

export const useTheme = () => useContext(ThemeContext);
