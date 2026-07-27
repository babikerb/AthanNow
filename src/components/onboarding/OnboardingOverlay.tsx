import React, { useEffect, useMemo } from 'react';

import { useOnboarding } from '../../context/OnboardingContext';
import { useSettings } from '../../context/SettingsContext';
import { useLocation } from '../../hooks/useLocation';
import { navigateToTab } from '../../navigation/navigationRef';
import { CALC_METHODS } from '../../utils/calcMethodDefaults';
import { ONBOARDING_STEPS } from './steps';
import { CalcMethodStep } from './steps/CalcMethodStep';
import { InfoStep } from './steps/InfoStep';
import { IntroStep } from './steps/IntroStep';
import { OutroStep } from './steps/OutroStep';
import { PermissionStep } from './steps/PermissionStep';
import { WidgetStep } from './steps/WidgetStep';

const TOTAL = ONBOARDING_STEPS.length;

/**
 * Single entry point for the merged onboarding experience. Mounted once
 * inside `MainTabs`, driving the real tab navigator via `navigateToTab` so
 * each step's dimmed backdrop shows the relevant real tab. Every step is a
 * standalone popup now: no cross-tab element measurement, no highlight
 * targets, dropped per explicit feedback (that mechanism kept causing
 * layout bugs and read as glitchy).
 *
 * Calls its own `useLocation()` instance, independent from `AthanScreen`'s,
 * same as before. The two instances read/write the same AsyncStorage key,
 * so this is a documented, low-risk duplication rather than a new one.
 */
export function OnboardingOverlay() {
  const { active, mode, step, next, skip, finish } = useOnboarding();
  const { location, cityName, refreshLocation } = useLocation();
  const settings = useSettings();
  const cur = ONBOARDING_STEPS[step];

  useEffect(() => {
    if (!active) return;
    if (!cur) {
      finish();
      return;
    }
    if (cur.kind !== 'intro') navigateToTab(cur.tab);
  }, [active, step, cur, finish]);

  const methodLabel = useMemo(
    () => CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod,
    [settings.calcMethod],
  );

  if (!active || !cur) return null;

  // Replay's bail-out, deactivates without touching `onboardingComplete`.
  // Completing the flow for real only happens via the outro step's own
  // action below, which is idempotent when already true.
  const onClose = mode === 'replay' ? finish : undefined;

  const handleFinish = () => {
    settings.update({ onboardingComplete: true });
    finish();
  };

  switch (cur.kind) {
    case 'intro':
      return <IntroStep index={step} total={TOTAL} onContinue={next} onClose={onClose} />;
    case 'permission':
      return (
        <PermissionStep
          index={step}
          total={TOTAL}
          permission={cur.permission}
          refreshLocation={cur.permission === 'location' ? refreshLocation : undefined}
          onNext={next}
          onClose={onClose}
        />
      );
    case 'calcMethod':
      return (
        <CalcMethodStep
          index={step}
          total={TOTAL}
          location={location}
          applyDefault={mode === 'initial'}
          onNext={next}
          onClose={onClose}
        />
      );
    case 'info':
      return (
        <InfoStep index={step} total={TOTAL} title={cur.title} body={cur.body} onNext={next} onSkip={skip} onClose={onClose} />
      );
    case 'widget':
      return <WidgetStep index={step} total={TOTAL} onNext={next} onClose={onClose} />;
    case 'outro':
    default:
      return (
        <OutroStep
          index={step}
          total={TOTAL}
          cityName={cityName}
          methodLabel={methodLabel}
          mode={mode}
          onFinish={handleFinish}
          onClose={onClose}
        />
      );
  }
}
