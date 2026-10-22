import { colorTokens } from '../../../design/tokens.generated';
import { haptic } from '../../../design/haptics';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text } from 'react-native';

import { skyTextSecondary } from '../../../theme/colors';
import { radii } from '../../../theme/radii';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
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
    haptic.medium();
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
            <Text style={st.wordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>AthanNow</Text>
          </StaggerReveal>
          <StaggerReveal index={2} count={3}>
            <Text style={st.tagline}>Prayer times, Quran, and Qibla, built around where you actually are.</Text>
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
  logo: { width: 110, height: 110, borderRadius: radii.lg, marginBottom: space.sm, alignSelf: 'center' },
  // One of the three reserved Fraunces-SemiBold moments app-wide.
  wordmark: { ...textStyle('hero'), color: colorTokens.dark.skyText, textAlign: 'center', alignSelf: 'stretch' } as any,
  tagline: { ...textStyle('body'), color: skyTextSecondary, textAlign: 'center', maxWidth: 320, alignSelf: 'center' } as any,
});
