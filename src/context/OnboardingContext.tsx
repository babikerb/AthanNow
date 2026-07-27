import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';

import { ONBOARDING_STEPS, OnboardingMode } from '../components/onboarding/steps';
import { useSettings } from './SettingsContext';

export interface OBRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OnboardingValue {
  active: boolean;
  /** 'initial' is the real first-run flow; 'replay' is the non-destructive
   *  re-entry from Settings — it must not reset `onboardingComplete`, must
   *  not silently overwrite a calc method the user already chose, and must
   *  offer a Close affordance to back out early. */
  mode: OnboardingMode;
  step: number;
  activeId: string | null;
  targets: Record<string, OBRect>;
  /** Activates the merged flow. Auto-invoked with 'initial' the first time
   *  (and again after "Reset all data"); Settings' replay row calls this
   *  with 'replay'. */
  start: (mode?: OnboardingMode) => void;
  next: () => void;
  /** Jumps straight to the closing step — used by the real-UI highlight
   *  steps' "Skip", mirroring the old coach-mark tour's "abandon the tour,
   *  land on a normal ending" behavior instead of dropping the user mid-flow. */
  skip: () => void;
  /** Deactivates the overlay without touching `onboardingComplete` — used by
   *  the replay Close button. Completing the flow for real happens via the
   *  closing step's own action, which sets `onboardingComplete` itself. */
  finish: () => void;
  setActiveId: (id: string | null) => void;
  setTarget: (id: string, rect: OBRect) => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<OnboardingMode>('initial');
  const [step, setStep] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, OBRect>>({});

  const activate = useCallback((m: OnboardingMode) => {
    setMode(m);
    setStep(0);
    setActiveId(null);
    setTargets({});
    setActive(true);
  }, []);

  // Auto-start the merged flow whenever `onboardingComplete` is false and
  // nothing is currently running — covers both real first-run and "Reset all
  // data" flipping the flag back to false. The short delay lets the first
  // real tab (always mounted now, since the flow overlays real screens
  // instead of preceding them) settle before anything tries to measure a
  // target.
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
    setActiveId(null);
    setTargets({});
  }, []);

  const setTarget = useCallback((id: string, rect: OBRect) => {
    setTargets((prev) => {
      const p = prev[id];
      if (p && p.x === rect.x && p.y === rect.y && p.width === rect.width && p.height === rect.height) {
        return prev;
      }
      return { ...prev, [id]: rect };
    });
  }, []);

  const value = useMemo(
    () => ({ active, mode, step, activeId, targets, start, next, skip, finish, setActiveId, setTarget }),
    [active, mode, step, activeId, targets, start, next, skip, finish, setTarget],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

/**
 * Registers a UI element as a spotlight target. Spread `ref` onto a
 * non-collapsable View wrapping the element you want highlighted. When this
 * target is the active step, it measures itself (retrying until laid out, which
 * is what makes spotlighting reliable right after a tab switch).
 */
export function useOnboardingTarget(id: string) {
  const { active, activeId, setTarget } = useOnboarding();
  const ref = useRef<View | null>(null);

  const measure = useCallback(
    (attempt = 0) => {
      if (!active) return;
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) {
          if (attempt < 20) setTimeout(() => measure(attempt + 1), 90);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          if (width > 0 && y >= 0 && y < Dimensions.get('window').height) {
            setTarget(id, { x, y, width, height });
          } else if (attempt < 20) {
            setTimeout(() => measure(attempt + 1), 90);
          }
        });
      });
    },
    [active, id, setTarget],
  );

  useEffect(() => {
    if (active && activeId === id) measure();
  }, [active, activeId, id, measure]);

  const onLayout = useCallback(() => {
    if (activeId === id) measure();
  }, [activeId, id, measure]);

  return { ref, onLayout };
}
