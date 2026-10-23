import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useSettings } from './SettingsContext';

export type OnboardingMode = 'initial' | 'replay';

interface OnboardingValue {
  active: boolean;
  mode: OnboardingMode;
  start: (mode?: OnboardingMode) => void;
  finish: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<OnboardingMode>('initial');

  const start = useCallback((m: OnboardingMode = 'replay') => {
    setMode(m);
    setActive(true);
  }, []);

  // First run, and after "Reset all data" flips the flag back. No delay: the setup covers the
  // tabs from its first frame so Home never flashes Mecca's times before it.
  const { onboardingComplete, ready } = useSettings();
  useEffect(() => {
    if (ready && !onboardingComplete && !active) start('initial');
  }, [ready, onboardingComplete, active, start]);

  const finish = useCallback(() => setActive(false), []);

  const value = useMemo(() => ({ active, mode, start, finish }), [active, mode, start, finish]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
