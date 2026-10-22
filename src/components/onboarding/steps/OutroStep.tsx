import { colorTokens } from '../../../design/tokens.generated';
import { haptic } from '../../../design/haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { skyTextSecondary } from '../../../theme/colors';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingMode } from '../steps';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  index: number;
  total: number;
  cityName: string;
  methodLabel: string;
  mode: OnboardingMode;
  onFinish: () => void;
  onClose?: () => void;
}

/**
 * Closing step — confirms what was just configured with real values (city +
 * calc method) rather than generic closing copy. Sets `onboardingComplete`
 * (idempotent on replay) via `onFinish`.
 */
export function OutroStep({ index, total, cityName, methodLabel, mode, onFinish, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const label = mode === 'initial' ? 'Open AthanNow' : 'Done';

  const handleFinish = () => {
    haptic.success();
    onFinish();
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
            <Text style={st.headline}>Your prayer times are ready</Text>
          </StaggerReveal>
          <StaggerReveal index={1} count={3}>
            <Text style={st.body}>
              Prayer times for {cityName}, calculated with {methodLabel}.
            </Text>
          </StaggerReveal>
        </>
      }
      footerIndex={2}
      footerCount={3}
      primaryLabel={label}
      onPrimary={handleFinish}
    />
  );
}

const st = StyleSheet.create({
  headline: { ...textStyle('title1'), color: colorTokens.dark.skyText, textAlign: 'center' } as any,
  body: { ...textStyle('body'), color: skyTextSecondary, textAlign: 'center', marginTop: space.md, maxWidth: 320, alignSelf: 'center' } as any,
});
