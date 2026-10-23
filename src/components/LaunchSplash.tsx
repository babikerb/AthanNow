import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INK, SCENES } from './sky/palettes';
import { SkyIllustration } from './sky/SkyIllustration';

// Must match the native launch screen (app.json: expo-splash-screen backgroundColor and imageWidth)
// and the tile drawn by scripts/make-brand.mjs (CROP, TILE_RADIUS), so the hand-off is invisible.
export const SPLASH_BG = INK;
const ICON = 128;
const TILE_RADIUS = 0.2237;
const CROP = { x: 190, y: 160, size: 200 };
const HORIZON = 318;
// The icon's faint early stars (scene units).
const STARS = [
  [214, 176, 1.1],
  [256, 168, 0.8],
  [372, 182, 1],
];
// Home's tab bar height when the navigator hasn't measured it (same fallback as useTabBarHeight).
const TAB_BAR = 49;

/**
 * The launch: starts as the app icon (the native launch screen shows the same tile), then the tile
 * opens out and the view pulls back from the icon's close crop to the full Maghrib scene, with the
 * skyline landing exactly where Home draws it. The scene then fades, leaving Home in its place.
 * Native-driver transforms throughout; with Reduce Motion the tile simply fades.
 */
export function LaunchSplash() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(false);
  const open = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  // The scene laid out exactly as Home lays it out (full layout, hills on the tab bar).
  const groundLift = insets.bottom + TAB_BAR;
  const s = W / 390;
  const shift = H / s - 340 - groundLift / s;
  const side = CROP.size * s;
  const dx = (CROP.x + CROP.size / 2) * s - W / 2;
  const dy = (CROP.y + CROP.size / 2 + shift) * s - H / 2;
  const Q = Math.max(W, H);
  const c0 = ICON / Q; // tile scale
  const S0 = Q / side; // zoom on the crop

  // Sky stops that reproduce the icon's gradient: Maghrib's sky from the crop's top edge to the horizon.
  const skyStops = useMemo<[string, number][]>(() => {
    const t0 = ((CROP.y + shift) * s) / H;
    const t1 = ((HORIZON + shift) * s) / H;
    const cols = SCENES.maghrib.sky;
    const stops: [string, number][] = cols.map((c, i) => [c, t0 + ((t1 - t0) * i) / (cols.length - 1)]);
    return [[cols[0], 0], ...stops.filter(([, o]) => o > 0 && o < 1), [cols[cols.length - 1], 1]];
  }, [shift, s, H]);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    await SplashScreen.hideAsync().catch(() => {});
    const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    const out = Animated.timing(fade, { toValue: 0, duration: reduce ? 300 : 520, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const anim = reduce
      ? out
      : Animated.sequence([
          Animated.delay(120),
          Animated.timing(open, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.delay(160),
          out,
        ]);
    anim.start(() => setDone(true));
  }, [fade, open]);

  // Safety net: never leave the overlay up if layout never reports.
  useEffect(() => {
    const t = setTimeout(start, 700);
    return () => clearTimeout(t);
  }, [start]);

  if (done) return null;

  return (
    <Animated.View pointerEvents="none" onLayout={start} style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      {/* The tile: a square window that grows from icon size until it covers the screen. */}
      <Animated.View
        style={{
          width: Q,
          height: Q,
          borderRadius: TILE_RADIUS * Q,
          overflow: 'hidden',
          transform: [{ scale: open.interpolate({ inputRange: [0, 1], outputRange: [c0, 1] }) }],
        }}
      >
        {/* The scene, zoomed onto the icon's crop and easing back to Home's framing. */}
        <Animated.View
          style={{
            position: 'absolute',
            left: (Q - W) / 2,
            top: (Q - H) / 2,
            width: W,
            height: H,
            transform: [
              { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [-S0 * dx, 0] }) },
              { translateY: open.interpolate({ inputRange: [0, 1], outputRange: [-S0 * dy, 0] }) },
              { scale: open.interpolate({ inputRange: [0, 1], outputRange: [S0, 1] }) },
            ],
          }}
        >
          <SkyIllustration period="maghrib" width={W} height={H} layout="full" groundLift={groundLift} skyStops={skyStops} />
          {STARS.map(([x, y, r], i) => {
            const d = Math.max(1.2, r * 2 * s);
            return (
              <View
                key={i}
                style={{ position: 'absolute', left: x * s - d / 2, top: (y + shift) * s - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: '#FFFFFF', opacity: 0.5 }}
              />
            );
          })}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, alignItems: 'center', justifyContent: 'center', backgroundColor: SPLASH_BG },
});
