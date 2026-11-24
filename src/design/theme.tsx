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
  /** iOS Bold Text, or the app's own. */
  boldText: boolean;
  /** Mutable copy of a stage's gradient stops (top -> bottom), safe to hand to LinearGradient. */
  skyColors: (stage: SkyStage) => string[];
  /** RN text style for a type variant. */
  type: typeof textStyle;
}

const ThemeCtx = createContext<Theme | null>(null);

/**
 * New token-driven theme (BRAND.md). Dark is the default until the Settings
 * appearance control lands (Phase 6f); pass `preference="system"` to follow iOS.
 * Tracks iOS Increase Contrast, Reduce Motion and Bold Text; Settings can turn each on for this app alone.
 */
export function ThemeProvider({
  preference = 'dark',
  strongContrast = false,
  calm = false,
  bold = false,
  children,
}: {
  preference?: AppearancePreference;
  strongContrast?: boolean;
  calm?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const [systemContrast, setHighContrast] = useState(false);
  const [systemMotion, setReduceMotion] = useState(false);
  const [systemBold, setBold] = useState(false);
  const highContrast = systemContrast || strongContrast;
  const reduceMotion = systemMotion || calm;
  const boldText = systemBold || bold;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isDarkerSystemColorsEnabled?.().then((v) => alive && setHighContrast(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('darkerSystemColorsChanged' as never, ((v: boolean) => setHighContrast(!!v)) as never);
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(!!v)).catch(() => {});
    const sub2 = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    AccessibilityInfo.isBoldTextEnabled().then((v) => alive && setBold(!!v)).catch(() => {});
    const sub3 = AccessibilityInfo.addEventListener('boldTextChanged', (v) => setBold(!!v));
    return () => {
      alive = false;
      sub.remove();
      sub2.remove();
      sub3.remove();
    };
  }, []);

  const scheme: ColorScheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo<Theme>(
    () => ({ scheme, highContrast, c: resolvePalette(scheme, highContrast), spacing, radii, motion, reduceMotion, boldText, skyColors: (stage) => [...skyStages[stage].colors], type: textStyle }),
    [scheme, highContrast, reduceMotion, boldText],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('useTheme must be used inside design/theme ThemeProvider');
  return t;
}
