import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { ACCENT, darkPalette, skyTextSecondary } from '../../theme/colors';
import { hitSlopFor } from '../../theme/icons';
import { duration, easing, PRESSED_OPACITY } from '../../theme/motion';
import { radii } from '../../theme/radii';
import { shadow } from '../../theme/shadow';
import { spacing } from '../../theme/spacing';
import { type } from '../../theme/typography';
import AmbientGradient from '../AmbientGradient';
import { ProgressBar } from './ProgressBar';

export interface BeaconTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  index: number;
  total: number;
  /** Time-of-day gradient (see `timeOfDayGradient.ts`) — used as a full-bleed
   *  background in `hero` mode, and as a faint atmospheric tint behind the
   *  target glow otherwise, so every step still reads as the same sky-themed
   *  experience even while it's dimming real app UI. */
  gradient: string[];
  /** Full-bleed takeover (intro/outro): the real tab underneath is fully
   *  hidden behind the gradient, matching the original opening/closing beat
   *  treatment. When false, the real current tab stays dimly visible behind
   *  a scrim (optionally cut out around `target`) — the "walk through the
   *  real screens" treatment. */
  hero?: boolean;
  /** True when this step is tied to a registered `useOnboardingTarget` id —
   *  tells the beacon to wait for a non-zero measurement before showing
   *  anything, rather than flashing a centered card first. */
  hasTarget?: boolean;
  target?: BeaconTarget | null;
  /** Target is circular/pill-shaped -> draw a matching rounded glow. */
  round?: boolean;
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

const DIM = 'rgba(5, 9, 18, 0.86)';
const CARD = darkPalette.surfaceElevated;
const PAD = 12;
const HALO_PAD = 14;
const NEXT_BTN_HEIGHT = 44;
// Fixed approximation of the persistent top bar's rendered height (safe-area
// top inset is added separately) — same "fine for a non-measured overlay"
// spirit as `WidgetPreview`'s `SKY_AREA_Y` constant.
const TOP_CLEARANCE = 56;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The merged onboarding flow's single visual shell — a genuinely new design
 * replacing both the old full-screen `OnboardingLayout` (six abstract
 * explainer screens) and the old `Spotlight` coach-mark card (a separate
 * dark-dimmed-rectangle-cutout tour). Every one of the nine steps renders
 * through this same component now, so the whole flow reads as one continuous
 * design instead of two grafted-together UIs:
 *
 *  - A persistent progress bar (+ replay-only Close) pinned at the top across
 *    every step, not just within each sub-flow.
 *  - `hero` steps (opening/closing) take over the full screen with the real
 *    time-of-day sky gradient, like the previous welcome flow did.
 *  - Every other step dims the real, already-mounted tab screen underneath
 *    instead of replacing it with an abstract card — when tied to a
 *    registered UI target, it cuts a soft "beacon" glow around that real
 *    element (a two-layer halo: a blurred accent wash + a crisp pulsing
 *    ring) rather than the old plain thin ring, and drops the old caret
 *    pointer in favor of a simple floating glass card near the target.
 */
export function OnboardingBeacon({
  index,
  total,
  gradient,
  hero = false,
  hasTarget = false,
  target = null,
  round = false,
  content,
  footerIndex = 2,
  footerCount = 3,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  onClose,
}: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const t = target && target.width > 0 ? target : null;
  const ready = hero || !hasTarget || !!t;

  useEffect(() => {
    if (reducedMotion || !t) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion, t]);

  useEffect(() => {
    if (ready) {
      Animated.timing(fade, { toValue: 1, duration: duration.fast, easing: easing.standard, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [ready, fade]);

  if (!ready) return null;

  const sx = t ? t.x - PAD : 0;
  const sy = t ? t.y - PAD : 0;
  const sw = t ? t.width + PAD * 2 : 0;
  const sh = t ? t.height + PAD * 2 : 0;
  const glowRadius = round ? Math.min(sw, sh) / 2 : radii.lg;
  const placeBelow = t ? sy + sh + 260 < SH : true;
  const glowColor = gradient[0] ?? ACCENT;

  const ringScale = reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const haloOpacity = reducedMotion ? 0.5 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });

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
        {primaryLoading ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryText}>{primaryLabel}</Text>}
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
      {hero ? (
        <AmbientGradient colors={gradient} scrimBottomOpacity={0.2} />
      ) : t ? (
        <>
          <View style={[st.dim, { top: 0, left: 0, right: 0, height: sy }]} />
          <View style={[st.dim, { top: sy, left: 0, width: sx, height: sh }]} />
          <View style={[st.dim, { top: sy, left: sx + sw, right: 0, height: sh }]} />
          <View style={[st.dim, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
          <Animated.View
            pointerEvents="none"
            style={[
              st.halo,
              {
                top: sy - HALO_PAD,
                left: sx - HALO_PAD,
                width: sw + HALO_PAD * 2,
                height: sh + HALO_PAD * 2,
                borderRadius: glowRadius + HALO_PAD,
                backgroundColor: hexToRgba(glowColor, 0.18),
                shadowColor: glowColor,
                opacity: haloOpacity,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              st.ring,
              { top: sy, left: sx, width: sw, height: sh, borderRadius: glowRadius, opacity: fade, transform: [{ scale: ringScale }] },
            ]}
          />
        </>
      ) : (
        <View style={[st.dim, StyleSheet.absoluteFill]} />
      )}

      <View style={[st.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <ProgressBar index={index} total={total} style={st.progress} />
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={hitSlopFor(20)} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={st.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      {hero ? (
        <Animated.View style={[st.heroWrap, { opacity: fade }]} pointerEvents="box-none">
          <View style={[st.heroContent, { paddingTop: insets.top + TOP_CLEARANCE }]}>{content}</View>
          <View style={[st.heroFooter, { paddingBottom: insets.bottom + spacing.xl }]}>{footer}</View>
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            st.cardWrap,
            t
              ? placeBelow
                ? { top: sy + sh + spacing.md }
                : { bottom: SH - sy + spacing.md }
              : { top: insets.top + TOP_CLEARANCE, bottom: insets.bottom + spacing.xl, justifyContent: 'center' },
            { opacity: fade },
          ]}
        >
          <View style={st.card}>
            {content}
            {footer}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dim: { position: 'absolute', backgroundColor: DIM },
  halo: { position: 'absolute', shadowOpacity: 0.9, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  ring: { position: 'absolute', borderWidth: 2.5, borderColor: ACCENT },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  progress: { flex: 1 },
  closeText: { ...type.footnote, color: skyTextSecondary } as any,

  heroWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  heroFooter: { paddingHorizontal: spacing.xl },

  cardWrap: { position: 'absolute', left: 20, right: 20 },
  card: {
    backgroundColor: CARD,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.floating,
  },

  footerRow: { gap: spacing.sm, marginTop: spacing.xs },
  primaryBtn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center', minHeight: NEXT_BTN_HEIGHT, justifyContent: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnDisabled: { opacity: 0.6 },
  primaryText: { ...type.headline, color: '#FFFFFF' } as any,
  secondaryBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  secondaryText: { ...type.subhead, color: skyTextSecondary } as any,
});
