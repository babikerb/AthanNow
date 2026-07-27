import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { HEADLINE_FONT_FAMILY, type } from '../../../theme/typography';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  progressTotal: number;
  onContinue: () => void;
  onClose?: () => void;
}

/**
 * Screen 1 — Welcome / value prop (plan §4.2). Replaces the entire previous
 * single-screen `OnboardingScreen.tsx`. No permission requests fire here —
 * those moved to their own primed screens (2 and 4).
 */
export function WelcomeScreen({ progressTotal, onContinue, onClose }: Props) {
  // Time-of-day bucket only (plan §4.4) — real location/calc-method aren't
  // resolved yet, so this is deliberately approximate, just not hardcoded
  // Isha regardless of the actual time.
  const gradient = useMemo(() => onboardingGradient(), []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContinue();
  };

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={0}
      progressTotal={progressTotal}
      onClose={onClose}
      centered
      footer={
        <StaggerReveal index={3} count={4}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [st.btn, pressed && st.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={st.btnText}>Continue</Text>
          </Pressable>
        </StaggerReveal>
      }
    >
      <StaggerReveal index={0} count={4}>
        <Image source={require('../../../../assets/icon.png')} style={st.logo} resizeMode="contain" />
      </StaggerReveal>
      <StaggerReveal index={1} count={4}>
        <Text style={st.wordmark}>AthanNow</Text>
      </StaggerReveal>
      <StaggerReveal index={2} count={4}>
        <Text style={st.tagline}>Prayer times, Quran, and Qibla — built around where you actually are.</Text>
      </StaggerReveal>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  logo: { width: 110, height: 110, borderRadius: radii.lg, marginBottom: spacing.xs },
  // One of the three reserved Fraunces-SemiBold moments app-wide (plan §1.1).
  wordmark: { ...type.hero, fontFamily: HEADLINE_FONT_FAMILY, color: '#FFFFFF', textAlign: 'center' } as any,
  tagline: {
    ...type.body,
    color: skyTextSecondary,
    textAlign: 'center',
    maxWidth: 320,
  } as any,
  btn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnText: { ...type.headline, color: '#FFFFFF' } as any,
});
