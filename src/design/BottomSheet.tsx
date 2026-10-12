import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from './haptics';
import { Text } from './Text';
import { useTheme } from './theme';

const DEFAULT_DETENTS = [0.55, 0.92];

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Detents as fractions of screen height (e.g. [0.5, 0.92]). The smallest is the opening detent. */
  detents?: number[];
  children: React.ReactNode;
}

/**
 * Bottom sheet with detents: drag the grabber to snap between detents or swipe down to dismiss.
 * surface2, sheet radius on top corners, hairline, dimmed backdrop. Reduce Motion swaps springs for a fade.
 * The sheet is laid out at its tallest detent and translated, so content gets bottom padding equal to the
 * hidden part at the current detent (lists can always scroll to their end).
 */
export function BottomSheet({ visible, onClose, title, detents = DEFAULT_DETENTS, children }: BottomSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const H = Dimensions.get('window').height;
  const sorted = useMemo(() => [...detents].sort((a, b) => a - b), [detents]);
  const sheetH = H * sorted[sorted.length - 1]!;
  const offsetFor = (d: number) => sheetH - H * d;

  const [mounted, setMounted] = useState(visible);
  const [detentIndex, setDetentIndex] = useState(0);
  const y = useRef(new Animated.Value(sheetH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const current = useRef(offsetFor(sorted[0]!));
  const start = useRef(0);

  // Latest values for the long-lived PanResponder.
  const live = useRef({ onClose, reduceMotion: t.reduceMotion, sorted, sheetH, H });
  live.current = { onClose, reduceMotion: t.reduceMotion, sorted, sheetH, H };

  const animateTo = (to: number, done?: () => void) => {
    current.current = to;
    const anim = t.reduceMotion
      ? Animated.timing(y, { toValue: to, duration: t.motion.duration.reducedFade, useNativeDriver: true })
      : Animated.spring(y, { toValue: to, useNativeDriver: true, ...t.motion.spring.gentle });
    anim.start(done ? () => done() : undefined);
  };

  const snapToIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(sorted.length - 1, i));
    setDetentIndex(clamped);
    animateTo(offsetFor(sorted[clamped]!));
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setDetentIndex(0);
      if (t.reduceMotion) y.setValue(offsetFor(sorted[0]!));
      else y.setValue(sheetH);
      haptic.light();
      animateTo(offsetFor(sorted[0]!));
      Animated.timing(backdrop, { toValue: 1, duration: t.motion.duration.standard, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(backdrop, { toValue: 0, duration: t.motion.duration.standard, useNativeDriver: true }).start();
      animateTo(sheetH, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = current.current;
        y.stopAnimation((v) => (start.current = v));
      },
      onPanResponderMove: (_, g) => {
        const { sorted: s, sheetH: sh, H: h } = live.current;
        y.setValue(Math.max(sh - h * s[s.length - 1]!, start.current + g.dy));
      },
      onPanResponderRelease: (_, g) => {
        const { sorted: s, sheetH: sh, H: h, reduceMotion } = live.current;
        const projected = start.current + g.dy + g.vy * 120;
        const stops = [...s.map((d) => sh - h * d), sh];
        const nearest = stops.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
        if (nearest === sh) {
          live.current.onClose();
          return;
        }
        if (nearest !== current.current) haptic.select();
        current.current = nearest;
        setDetentIndex(stops.indexOf(nearest));
        const anim = reduceMotion
          ? Animated.timing(y, { toValue: nearest, duration: 300, useNativeDriver: true })
          : Animated.spring(y, { toValue: nearest, useNativeDriver: true, damping: 26, stiffness: 140, mass: 1 });
        anim.start();
      },
    }),
  ).current;

  if (!mounted) return null;
  const dismissLabel = title ? `Dismiss ${title}` : 'Dismiss';
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim, opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={dismissLabel} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: sheetH,
            transform: [{ translateY: y }],
            backgroundColor: t.c.surface2,
            borderTopLeftRadius: t.radii.sheet,
            borderTopRightRadius: t.radii.sheet,
            borderCurve: 'continuous',
            borderWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: 0,
            borderColor: t.c.hairline,
            overflow: 'hidden',
          }}
        >
          <View
            {...pan.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Resize sheet"
            accessibilityValue={{ text: `${Math.round(sorted[detentIndex]! * 100)} percent of screen` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') snapToIndex(detentIndex + 1);
              else snapToIndex(detentIndex - 1);
            }}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.c.glyphQuiet }} />
          </View>
          {title ? (
            <Text variant="title3" header style={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.md }}>
              {title}
            </Text>
          ) : null}
          <View style={{ flex: 1, paddingBottom: offsetFor(sorted[detentIndex]!) + insets.bottom }}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}
