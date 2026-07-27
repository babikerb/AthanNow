import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';
import { WidgetPreview } from '../WidgetPreview';

interface Props {
  progressTotal: number;
  onNext: () => void;
  onClose?: () => void;
}

const STEPS = ['Long-press your Home Screen.', 'Tap the + in the corner.', 'Search for AthanNow.'];

/**
 * Screen 5 — Widget introduction (plan §4.2 Screen 5). Didn't exist anywhere
 * in the app before this. There's no programmatic "add widget" API to
 * trigger from inside an app, so this is educational (real, accurate
 * instructions) rather than a fake automated button.
 */
export function WidgetScreen({ progressTotal, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={4}
      progressTotal={progressTotal}
      onClose={onClose}
      footer={
        <StaggerReveal index={2} count={3}>
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
      <StaggerReveal index={0} count={3}>
        <Text style={st.headline}>Add AthanNow to your Home Screen</Text>
      </StaggerReveal>
      <StaggerReveal index={1} count={3}>
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
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  headline: { ...type.title1, color: '#FFFFFF' } as any,
  previewWrap: { marginTop: spacing.xl, marginBottom: spacing.xl, alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { ...type.caption2, color: '#FFFFFF' } as any,
  stepText: { ...type.body, color: skyTextSecondary, flex: 1 } as any,
  btn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnText: { ...type.headline, color: '#FFFFFF' } as any,
});
