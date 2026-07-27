import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useSettings } from '../../context/SettingsContext';
import { useLocation } from '../../hooks/useLocation';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { NIGHT_BG } from '../../theme/colors';
import { duration, easing } from '../../theme/motion';
import { CALC_METHODS } from '../../utils/calcMethodDefaults';
import { CalcMethodScreen } from './screens/CalcMethodScreen';
import { LocationScreen } from './screens/LocationScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ReadyScreen } from './screens/ReadyScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { WidgetScreen } from './screens/WidgetScreen';

const PROGRESS_TOTAL = 6;

interface Props {
  /** 'initial' is the real first-run flow (App.tsx mounts this in place of
   *  the old single-screen `OnboardingScreen`). 'replay' is the non-
   *  destructive re-entry from Settings (plan §4.3) — it must not reset
   *  `onboardingComplete` or re-fire OS permission prompts that are already
   *  granted, and must show the permanently-denied state correctly for a
   *  returning user who declined the first time. */
  mode: 'initial' | 'replay';
  /** Required for 'replay' — lets the user back out of the modal at any
   *  point without finishing all six screens. */
  onRequestClose?: () => void;
}

/**
 * Orchestrates the six-screen onboarding flow (plan §4.2). Not a pager
 * library (none is installed) — a simple index + a single Animated.View
 * doing the horizontal slide transition (`duration.slow`, `easing.emphasized`,
 * plan §4.5), gated by `useReducedMotion()`.
 */
export function OnboardingFlow({ mode, onRequestClose }: Props) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const directionRef = useRef<'forward' | 'back'>('forward');
  const slide = useRef(new Animated.Value(0)).current;

  const { location, cityName, refreshLocation } = useLocation();
  const settings = useSettings();

  const goTo = useCallback((next: number, direction: 'forward' | 'back' = 'forward') => {
    directionRef.current = direction;
    setIndex(next);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      slide.setValue(0);
      return;
    }
    slide.setValue(directionRef.current === 'forward' ? width : -width);
    const anim = Animated.timing(slide, {
      toValue: 0,
      duration: duration.slow,
      easing: easing.emphasized,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reducedMotion, width]);

  const onClose = mode === 'replay' ? onRequestClose : undefined;

  const methodLabel = useMemo(
    () => CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod,
    [settings.calcMethod],
  );

  const handleFinish = useCallback(() => {
    // Idempotent when already true (replay) — harmless either way, so no
    // mode branch is needed here at all.
    settings.update({ onboardingComplete: true });
    if (mode === 'replay') onRequestClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onRequestClose]);

  let screen: React.ReactNode;
  switch (index) {
    case 0:
      screen = <WelcomeScreen progressTotal={PROGRESS_TOTAL} onContinue={() => goTo(1)} onClose={onClose} />;
      break;
    case 1:
      screen = (
        <LocationScreen
          progressTotal={PROGRESS_TOTAL}
          refreshLocation={refreshLocation}
          onNext={() => goTo(2)}
          onClose={onClose}
        />
      );
      break;
    case 2:
      screen = (
        <CalcMethodScreen
          progressTotal={PROGRESS_TOTAL}
          location={location}
          applyDefault={mode === 'initial'}
          onNext={() => goTo(3)}
          onClose={onClose}
        />
      );
      break;
    case 3:
      screen = <NotificationsScreen progressTotal={PROGRESS_TOTAL} onNext={() => goTo(4)} onClose={onClose} />;
      break;
    case 4:
      screen = <WidgetScreen progressTotal={PROGRESS_TOTAL} onNext={() => goTo(5)} onClose={onClose} />;
      break;
    case 5:
    default:
      screen = (
        <ReadyScreen
          progressTotal={PROGRESS_TOTAL}
          cityName={cityName}
          methodLabel={methodLabel}
          mode={mode}
          onFinish={handleFinish}
          onClose={onClose}
        />
      );
      break;
  }

  return (
    <View style={st.screen}>
      <Animated.View style={[st.slide, { transform: [{ translateX: slide }] }]}>{screen}</Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT_BG, overflow: 'hidden' },
  slide: { flex: 1 },
});
