import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { OBRect } from '../../../context/OnboardingContext';
import { skyTextSecondary } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  index: number;
  total: number;
  title: string;
  body: string;
  target: OBRect | null;
  round?: boolean;
  onNext: () => void;
  onSkip: () => void;
  onClose?: () => void;
}

/**
 * Pure real-UI highlight step — the direct continuation of the former
 * standalone coach-mark tour (`OnboardingTour`/`Spotlight`), now living
 * inline in the merged flow instead of firing separately after the user was
 * already dropped into the app. "Skip" jumps straight to the closing step
 * rather than abandoning the flow entirely, so a skipped tour still ends on
 * a normal summary instead of leaving the user mid-overlay.
 */
export function SpotlightStep({ index, total, title, body, target, round, onNext, onSkip, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      target={target}
      hasTarget
      round={round}
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
  title: { ...type.title3, color: '#FFFFFF' } as any,
  body: { ...type.body, color: skyTextSecondary, marginTop: spacing.xs } as any,
});
