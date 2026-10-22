import { colorTokens } from '../../../design/tokens.generated';
import { haptic } from '../../../design/haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { skyTextSecondary } from '../../../theme/colors';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';
import { WidgetPreview } from '../WidgetPreview';

interface Props {
  index: number;
  total: number;
  onNext: () => void;
  onClose?: () => void;
}

const STEPS = ['Long-press your Home Screen.', 'Tap the + in the corner.', 'Search for AthanNow.'];

/**
 * Widget-introduction step. There's no programmatic "add widget" API to
 * trigger from inside an app, so this is educational (real, accurate
 * instructions) rather than a fake automated button — same reasoning the
 * original standalone `WidgetScreen` used.
 */
export function WidgetStep({ index, total, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);

  const handleContinue = () => {
    haptic.medium();
    onNext();
  };

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      onClose={onClose}
      content={
        <>
          <StaggerReveal index={0} count={2}>
            <Text style={st.title}>Add AthanNow to your Home Screen</Text>
          </StaggerReveal>
          <StaggerReveal index={1} count={2}>
            <View>
              <View style={st.previewWrap}>
                <WidgetPreview />
              </View>
              {STEPS.map((s, i) => (
                <View key={i} style={st.stepRow}>
                  <View style={st.stepBadge}>
                    <Text style={st.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={st.stepText}>{s}</Text>
                </View>
              ))}
            </View>
          </StaggerReveal>
        </>
      }
      primaryLabel="Continue"
      onPrimary={handleContinue}
    />
  );
}

const st = StyleSheet.create({
  title: { ...textStyle('title3'), color: colorTokens.dark.skyText } as any,
  previewWrap: { marginTop: space.lg, marginBottom: space.lg, alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colorTokens.dark.skyHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { ...textStyle('caption2'), color: colorTokens.dark.skyText } as any,
  stepText: { ...textStyle('body'), color: skyTextSecondary, flex: 1 } as any,
});
