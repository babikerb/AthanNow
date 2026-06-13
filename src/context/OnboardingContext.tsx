import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';

import { useSettings } from './SettingsContext';

const TOUR_DONE_KEY = 'athan_tour_done_v1';

export interface OBRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OnboardingValue {
  active: boolean;
  step: number;
  activeId: string | null;
  targets: Record<string, OBRect>;
  start: () => void;
  next: () => void;
  finish: () => void;
  setStep: (n: number) => void;
  setActiveId: (id: string | null) => void;
  setTarget: (id: string, rect: OBRect) => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, OBRect>>({});

  // Start the tour once the welcome screen is done (onboardingComplete just became
  // true) and the tour hasn't been seen. Keying off onboardingComplete means a
  // "Reset all data" (which clears the flag) correctly replays the tour afterwards.
  const { onboardingComplete } = useSettings();
  useEffect(() => {
    if (!onboardingComplete) return;
    let cancelled = false;
    AsyncStorage.getItem(TOUR_DONE_KEY)
      .then((done) => {
        if (!cancelled && !done) {
          // Let the first tab lay out before measuring its targets.
          setTimeout(() => !cancelled && setActive(true), 600);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onboardingComplete]);

  const start = useCallback(() => {
    setStep(0);
    setActiveId(null);
    setTargets({});
    setActive(true);
  }, []);

  const next = useCallback(() => setStep((s) => s + 1), []);

  const finish = useCallback(() => {
    AsyncStorage.setItem(TOUR_DONE_KEY, '1').catch(() => {});
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
    () => ({ active, step, activeId, targets, start, next, finish, setStep, setActiveId, setTarget }),
    [active, step, activeId, targets, start, next, finish, setTarget],
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
