import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { getLocationPermissionState, requestLocationPermission } from '../../../hooks/useLocation';
import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { classifyPermission, PermissionUIState } from '../../../utils/permissionState';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  progressTotal: number;
  /** Kicks off the real GPS fetch in the background — not awaited here (same
   *  reasoning as the previous single-screen flow): the permission dialog
   *  result is all this screen needs to move on; a stalled GPS read (Location
   *  Services off device-wide) must never freeze onboarding on a spinner. */
  refreshLocation: () => Promise<void>;
  onNext: () => void;
  onClose?: () => void;
}

/**
 * Screen 2 — Location priming (plan §4.2 Screen 2 / §4.2a). Three-state
 * permission handling: not-yet-asked / already-granted / permanently-denied.
 * Re-checks the real OS permission on every mount, so this behaves correctly
 * both on first run and when replayed from Settings (plan §4.3) — a
 * returning user who denied the first time must see "Open Settings" here,
 * never a silent re-ask that will never surface a dialog.
 */
export function LocationScreen({ progressTotal, refreshLocation, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const [permState, setPermState] = useState<PermissionUIState>('checking');
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let mounted = true;
    getLocationPermissionState().then(({ status, canAskAgain }) => {
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
    const { status, canAskAgain } = await requestLocationPermission();
    const next = classifyPermission(status, canAskAgain);
    setPermState(next);
    if (next === 'granted') {
      refreshLocation().catch(() => {});
      onNext();
    } else {
      setDeclined(true);
    }
  };

  let body: string;
  let primaryLabel: string;
  if (declined) {
    body = "No problem — we'll start you off with Mecca's prayer times. Search any city anytime from the location pill.";
    primaryLabel = 'Continue';
  } else if (permState === 'granted') {
    body = 'Location is already enabled.';
    primaryLabel = 'Continue';
  } else if (permState === 'denied-permanent') {
    body =
      "Location is turned off for AthanNow. Enable it in Settings to get prayer times for your exact location — or continue and we'll use Mecca's times for now.";
    primaryLabel = 'Open Settings';
  } else {
    body =
      "AthanNow uses your location to calculate accurate prayer times for exactly where you are. It's used on-device only — nothing is sent anywhere.";
    primaryLabel = 'Allow Location';
  }

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={1}
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
        <Text style={st.headline}>Find your prayer times</Text>
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
