import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { motion, radii, resolvePalette, skyStages, spacing, textStyle, type ColorScheme, type Palette, type SkyStage } from './tokens';

export type AppearancePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  highContrast: boolean;
  c: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  motion: typeof motion;
  reduceMotion: boolean;
  /** Mutable copy of a stage's gradient stops (top -> bottom), safe to hand to LinearGradient. */
  skyColors: (stage: SkyStage) => string[];
  /** RN text style for a type variant. */
  type: typeof textStyle;
}

const ThemeCtx = createContext<Theme | null>(null);

/**
 * New token-driven theme (BRAND.md). Dark is the default until the Settings
 * appearance control lands (Phase 6f); pass `preference="system"` to follow iOS.
 * Tracks iOS "Increase Contrast" (Darker System Colors).
 */
export function ThemeProvider({
  preference = 'dark',
  children,
}: {
  preference?: AppearancePreference;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isDarkerSystemColorsEnabled?.().then((v) => alive && setHighContrast(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('darkerSystemColorsChanged' as never, ((v: boolean) => setHighContrast(!!v)) as never);
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(!!v)).catch(() => {});
    const sub2 = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => {
      alive = false;
      sub.remove();
      sub2.remove();
    };
  }, []);

  const scheme: ColorScheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo<Theme>(
    () => ({ scheme, highContrast, c: resolvePalette(scheme, highContrast), spacing, radii, motion, reduceMotion, skyColors: (stage) => [...skyStages[stage].colors], type: textStyle }),
    [scheme, highContrast, reduceMotion],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('useTheme must be used inside design/theme ThemeProvider');
  return t;
}
