import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ONBOARDING_STEPS, OnboardingMode } from '../components/onboarding/steps';
import { useSettings } from './SettingsContext';

interface OnboardingValue {
  active: boolean;
  /** 'initial' is the real first-run flow; 'replay' is the non-destructive
   *  re-entry from Settings, it must not reset `onboardingComplete`, must
   *  not silently overwrite a calc method the user already chose, and must
   *  offer a Close affordance to back out early. */
  mode: OnboardingMode;
  step: number;
  /** Activates the merged flow. Auto-invoked with 'initial' the first time
   *  (and again after "Reset all data"); Settings' replay row calls this
   *  with 'replay'. */
  start: (mode?: OnboardingMode) => void;
  next: () => void;
  /** Jumps straight to the closing step, used by "Skip" on the descriptive
   *  info steps, mirroring the old coach-mark tour's "abandon the tour,
   *  land on a normal ending" behavior instead of dropping the user mid-flow. */
  skip: () => void;
  /** Deactivates the overlay without touching `onboardingComplete`, used by
   *  the replay Close button. Completing the flow for real happens via the
   *  closing step's own action, which sets `onboardingComplete` itself. */
  finish: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<OnboardingMode>('initial');
  const [step, setStep] = useState(0);

  const activate = useCallback((m: OnboardingMode) => {
    setMode(m);
    setStep(0);
    setActive(true);
  }, []);

  // Auto-start the merged flow whenever `onboardingComplete` is false and
  // nothing is currently running, covers both real first-run and "Reset all
  // data" flipping the flag back to false. The short delay lets the first
  // real tab settle before the overlay renders on top of it.
  const { onboardingComplete } = useSettings();
  useEffect(() => {
    if (onboardingComplete || active) return;
    const t = setTimeout(() => activate('initial'), 600);
    return () => clearTimeout(t);
  }, [onboardingComplete, active, activate]);

  const start = useCallback((m: OnboardingMode = 'replay') => activate(m), [activate]);

  const next = useCallback(() => setStep((s) => s + 1), []);

  const skip = useCallback(() => setStep(ONBOARDING_STEPS.length - 1), []);

  const finish = useCallback(() => {
    setActive(false);
    setStep(0);
  }, []);

  const value = useMemo(() => ({ active, mode, step, start, next, skip, finish }), [active, mode, step, start, next, skip, finish]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
