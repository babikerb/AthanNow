import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { classifyPermission, PermissionUIState } from '../../../utils/permissionState';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { getNotificationPermissionState, requestNotificationPermissionState } from '../../../utils/notifications';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  progressTotal: number;
  onNext: () => void;
  onClose?: () => void;
}

/**
 * Screen 4 — Notifications priming (plan §4.2 Screen 4 / §4.2a). Mirrors
 * `LocationScreen`'s three-state permission handling exactly, on the second
 * of onboarding's two "soft ask before the OS dialog" screens.
 */
export function NotificationsScreen({ progressTotal, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const [permState, setPermState] = useState<PermissionUIState>('checking');
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let mounted = true;
    getNotificationPermissionState().then(({ status, canAskAgain }) => {
      if (mounted) setPermState(classifyPermission(status, canAskAgain));
    });
    return () => {
      mounted = false;
    };
  }, []);

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
    const { status, canAskAgain } = await requestNotificationPermissionState();
    const next = classifyPermission(status, canAskAgain);
    setPermState(next);
    if (next === 'granted') {
      onNext();
    } else {
      setDeclined(true);
    }
  };

  let body: string;
  let primaryLabel: string;
  if (declined) {
    body = 'You can still see every prayer time in the app. Turn on notifications anytime from Settings → Notifications.';
    primaryLabel = 'Continue';
  } else if (permState === 'granted') {
    body = 'Notifications are already enabled.';
    primaryLabel = 'Continue';
  } else if (permState === 'denied-permanent') {
    body = 'Notifications are turned off for AthanNow. Enable them in Settings to get athan alerts — or continue without them for now.';
    primaryLabel = 'Open Settings';
  } else {
    body = 'AthanNow can notify you at each prayer time, with an optional reminder beforehand. You choose which prayers and how far ahead in Settings.';
    primaryLabel = 'Enable Notifications';
  }

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={3}
      progressTotal={progressTotal}
      onSkip={canDecline ? handleDecline : undefined}
      skipLabel="Skip"
      onClose={onClose}
      footer={
        <StaggerReveal index={2} count={3}>
          <Pressable
            onPress={handlePrimary}
            disabled={permState === 'checking'}
            style={({ pressed }) => [st.btn, pressed && st.btnPressed, permState === 'checking' && st.btnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            {permState === 'checking' ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>{primaryLabel}</Text>}
          </Pressable>
          {canDecline && (
            <Pressable
              onPress={handleDecline}
              style={({ pressed }) => [st.secondaryBtn, pressed && st.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={st.secondaryText}>Not now</Text>
            </Pressable>
          )}
        </StaggerReveal>
      }
    >
      <StaggerReveal index={0} count={3}>
        <Text style={st.headline}>Never miss a prayer</Text>
      </StaggerReveal>
      <StaggerReveal index={1} count={3}>
        <Text style={st.body}>{body}</Text>
      </StaggerReveal>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  headline: { ...type.title1, color: '#FFFFFF' } as any,
  body: { ...type.body, color: skyTextSecondary, marginTop: spacing.sm } as any,
  btn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnText: { ...type.headline, color: '#FFFFFF' } as any,
  secondaryBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  secondaryText: { ...type.subhead, color: skyTextSecondary } as any,
});
