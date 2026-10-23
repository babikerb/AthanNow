import { colorTokens } from '../../../design/tokens.generated';
import { haptic } from '../../../design/haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text } from 'react-native';

import { getLocationPermissionState, requestLocationPermission } from '../../../hooks/useLocation';
import { skyTextSecondary } from '../../../theme/colors';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
import { getNotificationPermissionState, requestNotificationPermissionState } from '../../../utils/notifications';
import { classifyPermission, PermissionUIState } from '../../../utils/permissionState';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

type Kind = 'location' | 'notifications';

interface Copy {
  headline: string;
  ask: string;
  granted: string;
  deniedPermanent: string;
  declined: string;
  allowLabel: string;
}

const COPY: Record<Kind, Copy> = {
  location: {
    headline: 'Prayer times for where you are',
    ask: "Used on this phone to work out prayer times and the Qibla. We don't collect or store it.",
    granted: 'Location is already enabled.',
    deniedPermanent:
      "Location is turned off for AthanNow. Enable it in Settings to get prayer times for your exact location, or continue and we'll use Mecca's times for now.",
    declined: "Showing Mecca's times for now. Tap the city name at the top of Home to search.",
    allowLabel: 'Allow Location',
  },
  notifications: {
    headline: 'A nudge at each prayer',
    ask: 'AthanNow can notify you at each prayer time, with an optional reminder beforehand. You choose which prayers and how far ahead in Settings.',
    granted: 'Notifications are already enabled.',
    deniedPermanent:
      'Notifications are turned off for AthanNow. Enable them in Settings to get athan alerts, or continue without them for now.',
    declined: 'You can still see every prayer time in the app. Turn on notifications anytime from Settings, then Notifications.',
    allowLabel: 'Enable Notifications',
  },
};

interface Props {
  index: number;
  total: number;
  permission: Kind;
  /** Location only, kicks off the real GPS fetch in the background once
   *  granted; not awaited (a stalled GPS read must never freeze onboarding). */
  refreshLocation?: () => Promise<void>;
  onNext: () => void;
  onClose?: () => void;
}

/**
 * Shared three-state permission-priming step. Location and notifications
 * used to be two nearly-identical standalone screens (`LocationScreen` /
 * `NotificationsScreen`); merging them into one parameterized component
 * removes that duplication now that both live as steps in the same flow.
 * Re-checks the real OS permission on every mount, so this behaves correctly
 * both on first run and when replayed from Settings — a returning user who
 * denied the first time sees "Open Settings" here, never a silent re-ask
 * that will never surface a dialog.
 */
export function PermissionStep({ index, total, permission, refreshLocation, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const copy = COPY[permission];
  const [permState, setPermState] = useState<PermissionUIState>('checking');
  const [declined, setDeclined] = useState(false);

  // Check on mount and again whenever the app comes back (e.g. from "Open Settings").
  useEffect(() => {
    let mounted = true;
    const check = () => {
      const getState = permission === 'location' ? getLocationPermissionState : getNotificationPermissionState;
      getState()
        .then(({ status, canAskAgain }) => mounted && setPermState(classifyPermission(status, canAskAgain)))
        .catch(() => {});
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [permission]);

  // Nothing to ask: move on instead of showing a step with nothing to do.
  const advanced = useRef(false);
  useEffect(() => {
    if (permState === 'granted' && !declined && !advanced.current) {
      advanced.current = true;
      if (permission === 'location') refreshLocation?.().catch(() => {});
      onNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permState]);

  const canDecline = !declined && (permState === 'undetermined' || permState === 'denied-permanent');

  const handleDecline = () => {
    haptic.select();
    setDeclined(true);
  };

  const handlePrimary = async () => {
    if (declined) {
      onNext();
      return;
    }
    if (permState === 'denied-permanent') {
      Linking.openSettings();
      return;
    }
    if (permState === 'granted') {
      onNext();
      return;
    }
    haptic.medium();
    const request = permission === 'location' ? requestLocationPermission : requestNotificationPermissionState;
    const { status, canAskAgain } = await request();
    const next = classifyPermission(status, canAskAgain);
    setPermState(next);
    // Granted is handled by the effect above (it advances once).
    if (next !== 'granted') setDeclined(true);
  };

  let body: string;
  let primaryLabel: string;
  if (declined) {
    body = copy.declined;
    primaryLabel = 'Continue';
  } else if (permState === 'granted') {
    body = copy.granted;
    primaryLabel = 'Continue';
  } else if (permState === 'denied-permanent') {
    body = copy.deniedPermanent;
    primaryLabel = 'Open Settings';
  } else {
    body = copy.ask;
    primaryLabel = copy.allowLabel;
  }

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      onClose={onClose}
      content={
        <>
          <StaggerReveal index={0} count={2}>
            <Text style={st.title}>{copy.headline}</Text>
          </StaggerReveal>
          <StaggerReveal index={1} count={2}>
            <Text style={st.body}>{body}</Text>
          </StaggerReveal>
        </>
      }
      primaryLabel={primaryLabel}
      onPrimary={handlePrimary}
      primaryLoading={permState === 'checking'}
      primaryDisabled={permState === 'checking'}
      secondaryLabel={canDecline ? 'Not now' : undefined}
      onSecondary={canDecline ? handleDecline : undefined}
    />
  );
}

const st = StyleSheet.create({
  title: { ...textStyle('title3'), color: colorTokens.dark.skyText } as any,
  body: { ...textStyle('body'), color: skyTextSecondary, marginTop: space.sm } as any,
});
