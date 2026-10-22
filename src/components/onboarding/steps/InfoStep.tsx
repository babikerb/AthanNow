import { colorTokens } from '../../../design/tokens.generated';
import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { skyTextSecondary } from '../../../theme/colors';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  index: number;
  total: number;
  title: string;
  body: string;
  onNext: () => void;
  onSkip: () => void;
  onClose?: () => void;
}

/**
 * A short descriptive popup introducing part of the app, a dimmed real tab
 * in the background for atmosphere, plain centered card with copy on top.
 * Replaces the former `SpotlightStep`, which also cut a highlight hole
 * around a real, measured UI element, dropped per explicit feedback (the
 * cross-tab measurement it needed kept causing layout bugs and read as
 * glitchy). "Skip" jumps straight to the closing step rather than
 * abandoning the flow, so a skipped tour still ends on a normal summary.
 */
export function InfoStep({ index, total, title, body, onNext, onSkip, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      onClose={onClose}
      content={
        <>
          <StaggerReveal index={0} count={2}>
            <Text style={st.title}>{title}</Text>
          </StaggerReveal>
          <StaggerReveal index={1} count={2}>
            <Text style={st.body}>{body}</Text>
          </StaggerReveal>
        </>
      }
      primaryLabel="Next"
      onPrimary={onNext}
      secondaryLabel="Skip"
      onSecondary={onSkip}
    />
  );
}

const st = StyleSheet.create({
  title: { ...textStyle('title3'), color: colorTokens.dark.skyText } as any,
  body: { ...textStyle('body'), color: skyTextSecondary, marginTop: space.sm } as any,
});
