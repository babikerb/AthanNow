import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';

import { OBRect } from '../../../context/OnboardingContext';
import { getLocationPermissionState, requestLocationPermission } from '../../../hooks/useLocation';
import { skyTextSecondary } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
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
    headline: 'Find your prayer times',
    ask: "AthanNow uses your location to calculate accurate prayer times for exactly where you are. It's used on-device only — nothing is sent anywhere.",
    granted: 'Location is already enabled.',
    deniedPermanent:
      "Location is turned off for AthanNow. Enable it in Settings to get prayer times for your exact location — or continue and we'll use Mecca's times for now.",
    declined: "No problem — we'll start you off with Mecca's prayer times. Search any city anytime from the location pill.",
    allowLabel: 'Allow Location',
  },
  notifications: {
    headline: 'Never miss a prayer',
    ask: 'AthanNow can notify you at each prayer time, with an optional reminder beforehand. You choose which prayers and how far ahead in Settings.',
    granted: 'Notifications are already enabled.',
    deniedPermanent:
      'Notifications are turned off for AthanNow. Enable them in Settings to get athan alerts — or continue without them for now.',
    declined: 'You can still see every prayer time in the app. Turn on notifications anytime from Settings → Notifications.',
    allowLabel: 'Enable Notifications',
  },
};

interface Props {
  index: number;
  total: number;
  permission: Kind;
  target: OBRect | null;
  hasTarget: boolean;
  round?: boolean;
  /** Location only — kicks off the real GPS fetch in the background once
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
export function PermissionStep({ index, total, permission, target, hasTarget, round, refreshLocation, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const copy = COPY[permission];
  const [permState, setPermState] = useState<PermissionUIState>('checking');
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let mounted = true;
    const getState = permission === 'location' ? getLocationPermissionState : getNotificationPermissionState;
    getState().then(({ status, canAskAgain }) => {
      if (mounted) setPermState(classifyPermission(status, canAskAgain));
    });
    return () => {
      mounted = false;
    };
  }, [permission]);

  const canDecline = !declined && (permState === 'undetermined' || permState === 'denied-permanent');

  const handleDecline = () => {
    Haptics.selectionAsync();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const request = permission === 'location' ? requestLocationPermission : requestNotificationPermissionState;
    const { status, canAskAgain } = await request();
    const next = classifyPermission(status, canAskAgain);
    setPermState(next);
    if (next === 'granted') {
      if (permission === 'location') refreshLocation?.().catch(() => {});
      onNext();
    } else {
      setDeclined(true);
    }
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
      target={target}
      hasTarget={hasTarget}
      round={round}
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
  title: { ...type.title3, color: '#FFFFFF' } as any,
  body: { ...type.body, color: skyTextSecondary, marginTop: spacing.xs } as any,
});
