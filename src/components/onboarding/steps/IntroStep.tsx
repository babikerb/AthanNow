import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text } from 'react-native';

import { skyTextSecondary } from '../../../theme/colors';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { HEADLINE_FONT_FAMILY, type } from '../../../theme/typography';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  index: number;
  total: number;
  onContinue: () => void;
  onClose?: () => void;
}

/**
 * Step 1 of the merged flow — the minimal opening beat the redesign asked
 * for ("mostly have the beginning say continue"): logo, wordmark, tagline,
 * one button. No permission requests and no real tab content here — those
 * live in their own primed steps further into this same flow.
 */
export function IntroStep({ index, total, onContinue, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContinue();
  };

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      hero
      onClose={onClose}
      content={
        <>
          <StaggerReveal index={0} count={3}>
            <Image source={require('../../../../assets/icon.png')} style={st.logo} resizeMode="contain" />
          </StaggerReveal>
          <StaggerReveal index={1} count={3}>
            <Text style={st.wordmark}>AthanNow</Text>
          </StaggerReveal>
          <StaggerReveal index={2} count={3}>
            <Text style={st.tagline}>Prayer times, Quran, and Qibla — built around where you actually are.</Text>
          </StaggerReveal>
        </>
      }
      footerIndex={3}
      footerCount={4}
      primaryLabel="Continue"
      onPrimary={handleContinue}
    />
  );
}

const st = StyleSheet.create({
  logo: { width: 110, height: 110, borderRadius: radii.lg, marginBottom: spacing.xs, alignSelf: 'center' },
  // One of the three reserved Fraunces-SemiBold moments app-wide.
  wordmark: { ...type.hero, fontFamily: HEADLINE_FONT_FAMILY, color: '#FFFFFF', textAlign: 'center' } as any,
  tagline: { ...type.body, color: skyTextSecondary, textAlign: 'center', maxWidth: 320, alignSelf: 'center' } as any,
});
