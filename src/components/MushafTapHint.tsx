import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { Palette } from '../theme/colors';
import { duration, easing } from '../theme/motion';
import { radii } from '../theme/radii';
import { shadow } from '../theme/shadow';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';

// How long the hint stays fully visible before it fades itself out.
const HOLD_MS = 2400;

interface Props {
  visible: boolean;
  colors: Palette;
  /**
   * Called once the fade-out animation finishes. The caller (QuranScreen)
   * also calls this immediately, bypassing the timer, the moment the user
   * actually taps the page — either way it's the caller's job to persist the
   * "seen" flag so this never shows again.
   */
  onHidden: () => void;
}

/**
 * One-time "tap the page to hide controls" hint for the mushaf reader.
 *
 * The immersive-mode tap gesture (QuranScreen.tsx) had no visible affordance
 * at all — nothing on screen suggested tapping the page does anything. This
 * renders a small, non-blocking pill toast that fades in, holds briefly with
 * a slow breathing pulse (skipped under Reduce Motion — see
 * `useReducedMotion`'s doc comment: only *looping* animations need gating,
 * this component's one-shot fade-in/out is not gated), then fades itself out.
 * `pointerEvents="none"` throughout — it never intercepts the tap it's
 * teaching.
 */
export function MushafTapHint({ visible, colors, onHidden }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  // Fade in on mount, hold, then fade out and report done.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Animated.timing(opacity, {
      toValue: 1,
      duration: duration.slow,
      easing: easing.emphasized,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      if (cancelled) return;
      Animated.timing(opacity, {
        toValue: 0,
        duration: duration.base,
        easing: easing.standard,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) onHiddenRef.current();
      });
    }, HOLD_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, opacity]);

  // Slow breathing pulse while held — a gentle "notice me" cue, not an
  // attention-grabbing bounce. Every `Animated.loop` must check reduced
  // motion before starting (theme/motion.ts convention); when it's on we
  // just skip the loop and the pill sits at its settled scale/opacity below.
  useEffect(() => {
    if (!visible || reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: easing.standard, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, easing: easing.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reducedMotion, pulse]);

  if (!visible) return null;

  const scale = reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.pill,
          shadow.floating,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.separator, opacity, transform: [{ scale }] },
        ]}
      >
        <SymbolView name="hand.tap" size={15} tintColor={colors.textPrimary} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>Tap the page to hide controls</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { ...type.subhead } as any,
});
