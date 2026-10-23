import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import SkyScene from './SkyScene';
import { useHomeSky } from './sky/homeSky';
import { INK } from './sky/palettes';

// Must match the native launch screen (app.json: expo-splash-screen backgroundColor, no image).
export const SPLASH_BG = INK;
/** If Home hasn't drawn its sky by then (first run, slow restore), just open the app. */
const MAX_WAIT_MS = 1200;

/**
 * The launch: the native launch screen is plain ink. This overlay picks up on the same ink, then the
 * sky for the current time of day fades in and settles, drawn exactly as Home draws it (same period,
 * sun or moon on its arc, same layout). The overlay then fades away, so the hand-off only reveals
 * Home's text. Native-driver animations; with Reduce Motion it is a plain fade.
 */
export function LaunchSplash() {
  const { width, height } = useWindowDimensions();
  const sky = useHomeSky();
  const [done, setDone] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  // The overlay is already on screen and identical to the native launch screen: drop the native one.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const run = async (withSky: boolean) => {
      if (started.current) return;
      started.current = true;
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      const out = Animated.timing(fade, { toValue: 0, duration: reduce ? 300 : 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
      const anim =
        !withSky || reduce
          ? out
          : Animated.sequence([
              Animated.timing(reveal, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.delay(250),
              out,
            ]);
      anim.start(() => setDone(true));
    };
    if (sky) run(true);
    const t = setTimeout(() => run(false), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [sky, reveal, fade]);

  if (done) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      {sky && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: reveal,
              transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
            },
          ]}
        >
          <SkyScene
            period={sky.period}
            width={width}
            height={height}
            layout="full"
            clearTop={sky.clearTop}
            zone={sky.zone}
            arc={sky.arc}
            groundLift={sky.groundLift}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, backgroundColor: SPLASH_BG },
});
