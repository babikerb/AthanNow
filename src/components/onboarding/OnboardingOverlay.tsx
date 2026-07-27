import React, { useEffect, useMemo } from 'react';

import { useOnboarding } from '../../context/OnboardingContext';
import { useSettings } from '../../context/SettingsContext';
import { useLocation } from '../../hooks/useLocation';
import { navigateToTab } from '../../navigation/navigationRef';
import { CALC_METHODS } from '../../utils/calcMethodDefaults';
import { ONBOARDING_STEPS } from './steps';
import { CalcMethodStep } from './steps/CalcMethodStep';
import { IntroStep } from './steps/IntroStep';
import { OutroStep } from './steps/OutroStep';
import { PermissionStep } from './steps/PermissionStep';
import { SpotlightStep } from './steps/SpotlightStep';
import { WidgetStep } from './steps/WidgetStep';

const TOTAL = ONBOARDING_STEPS.length;

/**
 * Single entry point for the merged onboarding experience — replaces both
 * the previous `OnboardingFlow` (six abstract explainer screens shown before
 * the real app) and `OnboardingTour` (a separate coach-mark pass fired ~600ms
 * after landing in the real app). Mounted once inside `MainTabs`, the exact
 * spot the old coach-mark tour used, so it can drive the real tab navigator
 * via `navigateToTab` and highlight real elements via `useOnboardingTarget`'s
 * cross-tab `measureInWindow` targeting — now for every step, not just the
 * highlight-only ones.
 *
 * Calls its own `useLocation()` instance, independent from `AthanScreen`'s —
 * same as the previous `OnboardingFlow` did (it also had its own instance,
 * just in a separate mounted tree). The two instances read/write the same
 * AsyncStorage key, so this is a documented, low-risk duplication rather
 * than a new one: acceptable here specifically because `useLocation`'s mount
 * effect no longer passively requests permission (see `useLocation.ts`) — it
 * only silently restores/refreshes when permission is already granted.
 */
export function OnboardingOverlay() {
  const { active, mode, step, targets, next, skip, finish, setActiveId } = useOnboarding();
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
    const targetId = cur.kind === 'permission' || cur.kind === 'spotlight' ? cur.targetId : undefined;
    setActiveId(targetId ?? null);
  }, [active, step, cur, finish, setActiveId]);

  const methodLabel = useMemo(
    () => CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod,
    [settings.calcMethod],
  );

  if (!active || !cur) return null;

  // Replay's bail-out — deactivates without touching `onboardingComplete`.
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
          target={cur.targetId ? targets[cur.targetId] ?? null : null}
          hasTarget={!!cur.targetId}
          round={cur.round}
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
    case 'spotlight':
      return (
        <SpotlightStep
          index={step}
          total={TOTAL}
          title={cur.title}
          body={cur.body}
          target={targets[cur.targetId] ?? null}
          round={cur.round}
          onNext={next}
          onSkip={skip}
          onClose={onClose}
        />
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
