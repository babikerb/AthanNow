import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Must match the native splash (app.json: expo-splash-screen backgroundColor and imageWidth) and the
// mark drawn by scripts/make-brand.mjs, so the hand-off from the native launch screen is invisible.
export const SPLASH_BG = '#2E2450';
const MARK_W = 200;
const GOLD = '#F2C14E';
const INK = '#0E0B16';

// Geometry on the 1024 canvas (scripts/make-brand.mjs).
const GROUND = 806;
const ARC = { cx: 512, cy: GROUND, r: 340, w: 22 };
const SUN_R = 66;
const START_DEG = 70;
const END_DEG = 24;
const DOME = { cx: 512, cy: GROUND - 28, r: 156 };
const MINARETS = [318, 678];
const TOP = GROUND - 196;
const TIP = TOP - 44;
// The dome is a circle whose centre sits just above the ground; this is where it meets the ground.
const DOME_HALF = Math.sqrt(DOME.r ** 2 - (GROUND - DOME.cy) ** 2);

const sunAt = (deg: number) => [ARC.cx + ARC.r * Math.cos((deg * Math.PI) / 180), ARC.cy - ARC.r * Math.sin((deg * Math.PI) / 180)];

/** The mosque, arc and base, without the sun (the sun is animated separately). */
function MarkArt() {
  const minaret = (mx: number) =>
    `M${mx} ${GROUND} V${TOP} H${mx + 28} V${GROUND} Z M${mx - 7} ${TOP + 46} H${mx + 35} V${TOP + 57} H${mx - 7} Z M${mx} ${TOP} L${mx + 14} ${TIP} L${mx + 28} ${TOP} Z`;
  return (
    <Svg width={MARK_W} height={MARK_W} viewBox="0 0 1024 1024">
      <Path
        d={`M${ARC.cx - ARC.r} ${ARC.cy} A${ARC.r} ${ARC.r} 0 0 1 ${ARC.cx + ARC.r} ${ARC.cy}`}
        stroke={GOLD}
        strokeWidth={ARC.w}
        fill="none"
        opacity={0.9}
      />
      <Path
        d={`M${DOME.cx - DOME_HALF} ${GROUND} A${DOME.r} ${DOME.r} 0 1 1 ${DOME.cx + DOME_HALF} ${GROUND} Z`}
        fill={INK}
      />
      <Rect x={508.5} y={DOME.cy - DOME.r - 40} width={7} height={44} fill={INK} />
      <Circle cx={512} cy={DOME.cy - DOME.r - 46} r={9} fill={INK} />
      {MINARETS.map((mx) => (
        <Path key={mx} d={minaret(mx)} fill={INK} />
      ))}
      <Rect x={262} y={GROUND} width={500} height={18} fill={INK} />
    </Svg>
  );
}

/**
 * Picks up exactly where the native launch screen leaves off (same colour, same mark), hides it, then
 * plays a short animation: the sun travels along its arc and the mark opens onto the app. With Reduce
 * Motion it simply fades.
 */
export function LaunchSplash() {
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    await SplashScreen.hideAsync().catch(() => {});
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    const fade = Animated.timing(exit, { toValue: 1, duration: reduce ? 250 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const anim = reduce
      ? fade
      : Animated.sequence([Animated.timing(progress, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }), fade]);
    anim.start(() => setDone(true));
  }, [exit, progress]);

  // Safety net: never leave the overlay up if layout never reports.
  useEffect(() => {
    const t = setTimeout(start, 600);
    return () => clearTimeout(t);
  }, [start]);

  if (done) return null;

  // The sun's path in screen points, sampled along the arc for a native-driver interpolation.
  const k = MARK_W / 1024;
  const steps = 8;
  const input = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  const pts = input.map((p) => sunAt(START_DEG + (END_DEG - START_DEG) * p));
  const tx = progress.interpolate({ inputRange: input, outputRange: pts.map(([x]) => (x - 512) * k) });
  const ty = progress.interpolate({ inputRange: input, outputRange: pts.map(([, y]) => (y - 512) * k) });
  const sunD = SUN_R * 2 * k;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={start}
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        {
          backgroundColor: SPLASH_BG,
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        },
      ]}
    >
      <Animated.View style={{ width: MARK_W, height: MARK_W, transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <MarkArt />
        <Animated.View
          style={{
            position: 'absolute',
            left: MARK_W / 2 - sunD / 2,
            top: MARK_W / 2 - sunD / 2,
            width: sunD,
            height: sunD,
            borderRadius: sunD / 2,
            backgroundColor: GOLD,
            transform: [{ translateX: tx }, { translateY: ty }],
          }}
        />
      </Animated.View>
      {/* Keeps the full-screen layer measured even before the mark lays out. */}
      <View style={{ position: 'absolute', width, height }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
});
