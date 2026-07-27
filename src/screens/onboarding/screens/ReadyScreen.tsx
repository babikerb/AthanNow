import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  progressTotal: number;
  cityName: string;
  methodLabel: string;
  mode: 'initial' | 'replay';
  onFinish: () => void;
  onClose?: () => void;
}

/**
 * Screen 6 — Ready / transition (plan §4.2 Screen 6). Confirms what was just
 * configured with real values (city + calc method) rather than generic
 * closing copy — including the Mecca-fallback / North-America-default
 * phrasing "for free," since `cityName`/`methodLabel` already reflect
 * whatever was actually resolved (declined location naturally reads as
 * "Mecca", an unresolved calc method naturally reads as its smart default).
 */
export function ReadyScreen({ progressTotal, cityName, methodLabel, mode, onFinish, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const label = mode === 'initial' ? 'Open AthanNow' : 'Done';

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFinish();
  };

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={5}
      progressTotal={progressTotal}
      onClose={onClose}
      centered
      footer={
        <StaggerReveal index={2} count={3}>
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [st.btn, pressed && st.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={st.btnText}>{label}</Text>
          </Pressable>
        </StaggerReveal>
      }
    >
      <StaggerReveal index={0} count={3}>
        <Text style={st.headline}>You're all set</Text>
      </StaggerReveal>
      <StaggerReveal index={1} count={3}>
        <Text style={st.body}>
          Prayer times for {cityName}, calculated with {methodLabel}.
        </Text>
      </StaggerReveal>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  headline: { ...type.title1, color: '#FFFFFF', textAlign: 'center' } as any,
  body: { ...type.body, color: skyTextSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 320 } as any,
  btn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnText: { ...type.headline, color: '#FFFFFF' } as any,
});
