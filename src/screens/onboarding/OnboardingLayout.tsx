import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AmbientGradient from '../../components/AmbientGradient';
import { NIGHT_BG, skyTextSecondary } from '../../theme/colors';
import { hitSlopFor } from '../../theme/icons';
import { spacing } from '../../theme/spacing';
import { type } from '../../theme/typography';
import { ProgressBar } from './ProgressBar';

interface Props {
  /** Sky gradient for this screen (time-of-day bucket, plan §4.4). */
  gradient: string[];
  progressIndex: number;
  progressTotal: number;
  /** Present only on the permission-priming screens (2 & 4) — "skip" there
   *  means "proceed without granting," never a jump past the rest of the
   *  flow (plan §4.2). Omitted on screens 1, 3, 5, 6, which either have
   *  nothing to decline or already say so explicitly in their own copy. */
  onSkip?: () => void;
  skipLabel?: string;
  /** Present only when replaying onboarding from Settings (plan §4.3) — lets
   *  a returning user back out of the non-destructive replay at any point. */
  onClose?: () => void;
  /** Welcome screen only: centers its icon/wordmark/tagline vertically
   *  instead of the headline-at-top layout every other screen uses. */
  centered?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Shared full-screen wrapper for all six onboarding screens (plan §4.2/§4.6):
 * the real sky gradient, the persistent progress indicator, and the
 * optional skip/close affordances — so the six screens read as one
 * structural decision instead of six one-off layouts.
 */
export function OnboardingLayout({
  gradient,
  progressIndex,
  progressTotal,
  onSkip,
  skipLabel = 'Skip',
  onClose,
  centered = false,
  children,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={st.screen}>
      <AmbientGradient colors={gradient} scrimBottomOpacity={0.18} />

      <View style={[st.header, { paddingTop: insets.top + spacing.sm }]}>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={hitSlopFor(20)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={st.headerText}>Close</Text>
          </Pressable>
        ) : (
          <View style={st.headerSpacer} />
        )}

        <ProgressBar index={progressIndex} total={progressTotal} style={st.progress} />

        {onSkip ? (
          <Pressable
            onPress={onSkip}
            hitSlop={hitSlopFor(20)}
            accessibilityRole="button"
            accessibilityLabel={skipLabel}
          >
            <Text style={st.headerText}>{skipLabel}</Text>
          </Pressable>
        ) : (
          <View style={st.headerSpacer} />
        )}
      </View>

      <View
        style={[
          st.content,
          centered ? { justifyContent: 'center', alignItems: 'center' } : { justifyContent: 'flex-start' },
        ]}
      >
        {children}
      </View>

      <View style={[st.footer, { paddingBottom: insets.bottom + spacing.xl }]}>{footer}</View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  headerSpacer: { width: 44 },
  progress: { flex: 1 },
  headerText: { ...type.footnote, color: skyTextSecondary } as any,
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.md },
});
