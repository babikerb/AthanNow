import { colorTokens } from '../../design/tokens.generated';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { darkPalette, skyTextSecondary } from '../../theme/colors';
import { hitSlopFor } from '../../theme/icons';
import { duration, easing, PRESSED_OPACITY } from '../../theme/motion';
import { radii } from '../../theme/radii';
import { spacing as space } from '../../design/tokens';
import { textStyle } from '../../design/tokens';
import AmbientGradient from '../AmbientGradient';
import { ProgressBar } from './ProgressBar';

interface Props {
  index: number;
  total: number;
  /** Time-of-day gradient (see `timeOfDayGradient.ts`) — used as a full-bleed
   *  background in `hero` mode, and as a faint atmospheric tint behind the
   *  card otherwise, so every step still reads as the same sky-themed
   *  experience even while it's dimming real app UI. */
  gradient: string[];
  /** Full-bleed takeover (intro/outro): the real tab underneath is fully
   *  hidden behind the gradient, matching the original opening/closing beat
   *  treatment. When false, the real current tab stays dimly visible behind
   *  a scrim, with a centered card on top. */
  hero?: boolean;
  content: React.ReactNode;
  /** Only meaningful in `hero` mode, where the footer button is staggered in
   *  alongside the rest of the hero content instead of just fading with the
   *  card. Defaults line up with the closing (outro) step's 3-part sequence. */
  footerIndex?: number;
  footerCount?: number;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Present only when replaying onboarding from Settings — lets a returning
   *  user back out of the flow at any step. */
  onClose?: () => void;
}

const DIM = `${colorTokens.dark.bg}DB`; // ink at 86%
const CARD = darkPalette.surfaceElevated;
const NEXT_BTN_HEIGHT = 44;
const TOP_CLEARANCE = 56;

/**
 * The merged onboarding flow's single visual shell. Simplified from an
 * earlier version that also cut a "spotlight" hole around a real, measured
 * UI element (a location pill, a compass, etc.) — that cross-tab
 * measurement was the source of every layout bug this flow kept running
 * into (a progress bar overlapping the very thing it was highlighting,
 * content landing under the Dynamic Island depending on where the target
 * happened to sit). Dropped per explicit feedback: keep the sequence of
 * popup-style steps, drop the element highlighting, which was glitchy.
 *
 * Now there are only two layouts: `hero` steps (opening/closing) take over
 * the full screen with the real time-of-day sky gradient; every other step
 * dims the real, already-mounted tab screen underneath and shows a plain
 * centered card. No target math, no halo, no ring, no "does the card need
 * to flip above or below" logic. The top progress bar has one fixed
 * position now (right under the safe-area inset) since there is nothing
 * left for it to ever collide with.
 */
export function OnboardingBeacon({
  index,
  total,
  gradient,
  hero = false,
  content,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: duration.fast, easing: easing.standard, useNativeDriver: true }).start();
  }, [fade]);

  const footer = (
    <View style={st.footerRow}>
      <Pressable
        onPress={onPrimary}
        disabled={primaryDisabled}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        hitSlop={hitSlopFor(NEXT_BTN_HEIGHT)}
        style={({ pressed }) => [st.primaryBtn, pressed && !primaryDisabled && st.btnPressed, primaryDisabled && st.btnDisabled]}
      >
        {primaryLoading ? <ActivityIndicator color={colorTokens.dark.onAccent} /> : <Text style={st.primaryText}>{primaryLabel}</Text>}
      </Pressable>
      {secondaryLabel ? (
        <Pressable
          onPress={onSecondary}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          style={({ pressed }) => [st.secondaryBtn, pressed && st.btnPressed]}
        >
          <Text style={st.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={st.overlay} accessibilityViewIsModal>
      {hero ? <AmbientGradient colors={gradient} scrimBottomOpacity={0.2} /> : <View style={[st.dim, StyleSheet.absoluteFill]} />}

      <View style={[st.topBar, { top: insets.top + space.md }]} pointerEvents="box-none">
        <View style={[st.topBarPill, hero && st.topBarPillTransparent]}>
          <ProgressBar index={index} total={total} style={st.progress} />
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={hitSlopFor(20)} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={st.closeText}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {hero ? (
        <Animated.View style={[st.heroWrap, { opacity: fade }]} pointerEvents="box-none">
          <View style={[st.heroContent, { paddingTop: insets.top + TOP_CLEARANCE }]}>{content}</View>
          <View style={[st.heroFooter, { paddingBottom: insets.bottom + space.xxl }]}>{footer}</View>
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            st.cardWrap,
            { top: insets.top + TOP_CLEARANCE, bottom: insets.bottom + space.xxl, justifyContent: 'center' },
            { opacity: fade },
          ]}
        >
          <ScrollView style={st.cardScroll} contentContainerStyle={st.cardContent} bounces={false} showsVerticalScrollIndicator={false}>
            <View style={st.card}>
              {content}
              {footer}
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dim: { position: 'absolute', backgroundColor: DIM },

  topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: space.xl },
  topBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: space.md,
    backgroundColor: DIM,
    borderRadius: radii.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  topBarPillTransparent: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  progress: { flex: 1 },
  closeText: { ...textStyle('footnote'), color: skyTextSecondary } as any,

  heroWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xxl,
  },
  heroFooter: { paddingHorizontal: space.xxl },

  cardWrap: { position: 'absolute', left: 20, right: 20 },
  // Grows with content up to the available height, then scrolls (small phones, large Dynamic Type).
  cardScroll: { flexGrow: 0 },
  cardContent: { flexGrow: 0 },
  card: {
    backgroundColor: CARD,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colorTokens.dark.skyHairline,
    padding: space.xl,
    gap: space.md,
  },

  footerRow: { gap: space.md, marginTop: space.sm },
  primaryBtn: { backgroundColor: colorTokens.dark.accent, borderRadius: radii.pill, paddingVertical: space.xl, alignItems: 'center', minHeight: NEXT_BTN_HEIGHT, justifyContent: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnDisabled: { opacity: 0.6 },
  primaryText: { ...textStyle('headline'), color: colorTokens.dark.onAccent } as any,
  secondaryBtn: { paddingVertical: space.md, alignItems: 'center' },
  secondaryText: { ...textStyle('subhead'), color: skyTextSecondary } as any,
});
