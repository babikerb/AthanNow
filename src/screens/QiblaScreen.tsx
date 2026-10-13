import { useIsFocused } from '@react-navigation/native';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../design/Button';
import { haptic } from '../design/haptics';
import { useTheme as useDesignTheme } from '../design/theme';
import { colorTokens, textStyle } from '../design/tokens';
import { useLocation } from '../context/LocationContext';
import { useQibla } from '../hooks/useQibla';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { formatDistance } from '../utils/units';

// The Qibla instrument is always night, in either app appearance (BRAND.md), so it reads the dark tokens directly.
const c = colorTokens.dark;

const DIAL = 300;
const R = DIAL / 2;

// Fine ticks every 5°.
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
// Labelled marks every 30°: letters at the cardinals, degree numbers elsewhere.
const MARKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => ({
  deg,
  label: deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg),
  cardinal: deg % 90 === 0,
}));

const CARDINAL_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const CARDINAL_WORDS: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
function toCardinal(deg: number): string {
  return CARDINAL_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function toDeg(value: Animated.Value | Animated.AnimatedNode): Animated.AnimatedInterpolation<string> {
  return (value as Animated.Value).interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
    extrapolate: 'extend',
  });
}

/**
 * The rotating rose (ticks, marks, Qibla dot). Memoised: it depends only on the heading *animated value* (stable), the
 * Qibla bearing and the lock animation values, so a new heading reading re-renders only the readout, not ~90 views.
 * The aligned state is a native-driver opacity crossfade between two stacked elements (no JS-driven colour or width).
 */
const Rose = React.memo(function Rose({
  headingAnim,
  qiblaBearing,
  hasLocation,
  lock,
  under,
  dotScale,
}: {
  headingAnim: Animated.Value;
  qiblaBearing: number;
  hasLocation: boolean;
  lock: Animated.Value;
  under: Animated.AnimatedInterpolation<number>;
  dotScale: Animated.Value;
}) {
  const dialSpin = useMemo(() => toDeg(headingAnim), [headingAnim]);
  // Keep every labelled mark upright as the dial turns.
  const counters = useMemo(() => MARKS.map(({ deg }) => toDeg(Animated.subtract(new Animated.Value(-deg), headingAnim))), [headingAnim]);
  const ticks = useMemo(
    () =>
      TICKS.map((deg) => {
        const isCard = deg % 90 === 0;
        const isMajor = deg % 30 === 0;
        const h = isCard ? 14 : isMajor ? 10 : 5;
        const w = isCard ? 2 : 1;
        const bg = isCard ? c.skyText : isMajor ? c.textSecondary : c.skyHairline;
        return (
          <View
            key={deg}
            style={{
              position: 'absolute',
              width: w,
              height: h,
              backgroundColor: bg,
              top: R - h / 2,
              left: R - w / 2,
              transform: [{ rotate: `${deg}deg` }, { translateY: -(R - h / 2 - 4) }],
            }}
          />
        );
      }),
    [],
  );

  return (
    <Animated.View style={[styles.fill, { transform: [{ rotate: dialSpin }] }]}>
      {ticks}

      {MARKS.map((m, i) => (
        <View
          key={m.deg}
          style={{
            position: 'absolute',
            width: 34,
            height: 22,
            top: R - 11,
            left: R - 17,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: `${m.deg}deg` }, { translateY: -(R - 32) }],
          }}
        >
          <Animated.Text
            allowFontScaling={false}
            style={[m.cardinal ? styles.markLetter : styles.markNumber, m.label === 'N' && { color: c.danger }, { transform: [{ rotate: counters[i] }] }]}
          >
            {m.label}
          </Animated.Text>
        </View>
      ))}

      {/* Qibla marker riding the rim at the Qibla bearing. A plain dot,
          not an image of the Kaaba, out of respect for the sacred site. */}
      {hasLocation && (
        <View
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            top: R - 20,
            left: R - 20,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: `${qiblaBearing}deg` }, { translateY: -(R - 30) }],
          }}
        >
          <Animated.View style={{ transform: [{ scale: dotScale }] }}>
            <Animated.View style={[styles.qiblaDot, { backgroundColor: c.skyText, opacity: under }]} />
            <Animated.View style={[styles.qiblaDot, styles.stack, { backgroundColor: c.accent, opacity: lock }]} />
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
});

/** The centre readout: the only part that re-renders on every heading reading. */
function Readout({ heading, qiblaBearing, unavailable, calibrating, lock, under }: { heading: number; qiblaBearing: number; unavailable: boolean; calibrating: boolean; lock: Animated.Value; under: Animated.AnimatedInterpolation<number> }) {
  if (unavailable) {
    // No compass: the dial stays north-up, so the Kaaba marker already sits at the true bearing. Show it statically.
    return (
      <>
        <Text style={styles.readoutDeg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.2}>
          {Math.round(qiblaBearing)}°
        </Text>
        <Text style={styles.readoutCard} maxFontSizeMultiplier={1.2}>{toCardinal(qiblaBearing)}</Text>
      </>
    );
  }
  if (calibrating) return <SymbolView name="figure.walk.motion" size={26} tintColor={c.textSecondary} />;
  const deg = `${Math.round(heading)}°`;
  return (
    <>
      <View>
        <Animated.Text style={[styles.readoutDeg, { opacity: under }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.2}>
          {deg}
        </Animated.Text>
        <Animated.Text style={[styles.readoutDeg, styles.stack, { color: c.accent, opacity: lock }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.2}>
          {deg}
        </Animated.Text>
      </View>
      <Text style={styles.readoutCard} maxFontSizeMultiplier={1.2}>{toCardinal(heading)}</Text>
    </>
  );
}

function Compass({
  headingAnim,
  heading,
  qiblaBearing,
  isAligned,
  hasLocation,
  calibrating,
  unavailable,
}: {
  headingAnim: Animated.Value;
  heading: number;
  qiblaBearing: number;
  isAligned: boolean;
  hasLocation: boolean;
  calibrating: boolean;
  unavailable: boolean;
}) {
  // One warm moment: the apricot accent appears only when the phone is facing the Qibla, earned with a short native-driver
  // crossfade (ring, lubber, crosshair, dot, readout) and a spring on the dot instead of an instant swap.
  const { reduceMotion, motion } = useDesignTheme();
  const lock = useRef(new Animated.Value(isAligned ? 1 : 0)).current;
  const dotScale = useRef(new Animated.Value(isAligned ? 1.25 : 1)).current;
  useEffect(() => {
    Animated.timing(lock, {
      toValue: isAligned ? 1 : 0,
      duration: reduceMotion ? motion.duration.reducedFade : motion.duration.standard,
      useNativeDriver: true,
    }).start();
    const to = isAligned ? 1.25 : 1;
    if (reduceMotion) dotScale.setValue(to);
    else Animated.spring(dotScale, { toValue: to, useNativeDriver: true, ...motion.spring.snappy }).start();
  }, [isAligned, reduceMotion, lock, dotScale, motion]);

  // Underlays vanish at the very end of the crossfade so anti-aliased edges never fringe through the accent copy.
  const under = lock.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  const a11yLabel = unavailable
    ? `Qibla is ${Math.round(qiblaBearing)} degrees from north, ${CARDINAL_WORDS[toCardinal(qiblaBearing)]}.`
    : calibrating
      ? 'Compass is calibrating.'
      : isAligned
        ? `Facing the Qibla. Heading ${Math.round(heading)} degrees, ${CARDINAL_WORDS[toCardinal(heading)]}.`
        : `Heading ${Math.round(heading)} degrees, ${CARDINAL_WORDS[toCardinal(heading)]}.${hasLocation ? ` Qibla is at ${Math.round(qiblaBearing)} degrees.` : ''}`;

  return (
    <View style={styles.dialWrap} accessible accessibilityRole="image" accessibilityLabel="Qibla compass" accessibilityValue={{ text: a11yLabel }}>
      {/* Fixed lubber pointer at the top: north-red until the Qibla is locked, then the accent (stacked, opacity crossfade) */}
      <Animated.View style={[styles.lubber, { borderTopColor: c.danger, opacity: under }]} />
      <Animated.View style={[styles.lubber, { borderTopColor: c.accent, opacity: lock }]} />

      <View style={styles.dial}>
        {/* Fixed crosshair */}
        <Animated.View style={[styles.crossV, { backgroundColor: c.hairline, opacity: under }]} />
        <Animated.View style={[styles.crossH, { backgroundColor: c.hairline, opacity: under }]} />
        <Animated.View style={[styles.crossV, { backgroundColor: c.accentSoft, opacity: lock }]} />
        <Animated.View style={[styles.crossH, { backgroundColor: c.accentSoft, opacity: lock }]} />

        <Rose headingAnim={headingAnim} qiblaBearing={qiblaBearing} hasLocation={hasLocation} lock={lock} under={under} dotScale={dotScale} />

        {/* Aligned ring: constant width, fades in over the hairline ring */}
        <Animated.View pointerEvents="none" style={[styles.ring, { opacity: lock }]} />

        {/* Fixed center heading readout */}
        <View style={styles.readout} pointerEvents="none">
          <Readout heading={heading} qiblaBearing={qiblaBearing} unavailable={unavailable} calibrating={calibrating} lock={lock} under={under} />
        </View>
      </View>
    </View>
  );
}

export default function QiblaScreen() {
  const { cityName, status, location, hasRestored } = useLocation();
  useFocusedStatusBar('light');
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const qibla = useQibla(latitude, longitude);
  const loading = !location && status === 'loading';
  // Unresolved location (denied, failed, or never resolved) must not present Mecca's bearing as the user's.
  const error = status === 'denied' || status === 'error' || (status === 'idle' && hasRestored && !location?.isManual);
  const compassUnavailable = qibla.compassAvailable === false;
  const calibrating = qibla.headingAccuracy < 0;

  // Only count a lock when the compass is real, calibrated, and this tab is on screen (no buzzing from another tab,
  // no false lock from the static 0 heading when there is no compass).
  const focused = useIsFocused();
  const aligned = qibla.isAligned && !calibrating && !compassUnavailable && focused;

  const wasAligned = useRef(false);
  const lastLockAt = useRef(0);
  useEffect(() => {
    if (aligned && !wasAligned.current && Date.now() - lastLockAt.current > 1500) {
      lastLockAt.current = Date.now();
      haptic.medium();
      AccessibilityInfo.announceForAccessibility('Facing the Qibla');
    }
    wasAligned.current = aligned;
  }, [aligned]);

  const warned = useRef(false);
  useEffect(() => {
    if (error && !warned.current) haptic.warning();
    warned.current = error;
  }, [error]);

  // Scale the 324pt dial down on narrow phones instead of letting it overflow.
  const { width } = useWindowDimensions();
  const dialScale = Math.min(1, (width - 16) / (DIAL + 24));

  // No header on this screen: the compass is the entire point, so it gets the space.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
        {loading ? (
          <ActivityIndicator color={c.skyText} size="large" accessibilityLabel="Finding your location" />
        ) : (
          <>
            <View style={{ transform: [{ scale: dialScale }] }}>
            <Compass
              headingAnim={qibla.headingAnim}
              heading={qibla.heading}
              qiblaBearing={qibla.qiblaBearing}
              isAligned={aligned}
              hasLocation={qibla.hasLocation}
              calibrating={calibrating}
              unavailable={compassUnavailable}
            />
            </View>

            <View style={styles.infoBlock}>
              {error ? (
                <View style={styles.errorState}>
                  <Text style={styles.infoText}>Qibla needs to know where you are. Turn on location, or choose a city from the Athan tab.</Text>
                  <Button label="Open Settings" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
                </View>
              ) : compassUnavailable ? (
                <Text style={styles.infoText}>
                  This device has no compass. Hold it with the top pointing north; the Qibla is{' '}
                  {qibla.toleranceDeg >= 30 ? 'in every direction from here' : `${toCardinal(qibla.qiblaBearing)}, ${Math.round(qibla.qiblaBearing)}° from north`}.
                </Text>
              ) : calibrating ? (
                <Text style={styles.infoText}>Wave your phone in a figure 8 to calibrate the compass.</Text>
              ) : qibla.toleranceDeg >= 30 ? (
                <Text style={styles.infoText}>Every direction faces the Qibla here.</Text>
              ) : (
                !!cityName && (
                  <>
                    <Text style={styles.cityText}>{cityName}</Text>
                    {qibla.hasLocation && (
                      <Text style={styles.distanceText}>{formatDistance(qibla.distanceKm, location?.countryCode)} to the Kaaba</Text>
                    )}
                  </>
                )
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 44 },

  dialWrap: { width: DIAL + 24, height: DIAL + 24, alignItems: 'center', justifyContent: 'center' },
  // Concentric with the dial border (the rose is a child of `dial`, so no offset).
  fill: { position: 'absolute', top: 0, left: 0, width: DIAL, height: DIAL },
  lubber: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: R,
    borderWidth: 1,
    borderColor: c.skyHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossV: { position: 'absolute', width: 1, height: DIAL - 8, backgroundColor: c.hairline },
  crossH: { position: 'absolute', height: 1, width: DIAL - 8, backgroundColor: c.hairline },
  markLetter: { color: c.skyText, fontSize: 18, fontWeight: '700' },
  markNumber: { color: c.skyTextSecondary, fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  qiblaDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  // Aligned ring overlay: same circle as the dial, accent, fades in (the base hairline ring never changes width).
  ring: { position: 'absolute', top: -1, left: -1, width: DIAL, height: DIAL, borderRadius: R, borderWidth: 2, borderColor: c.accent },
  // Second copy of an element stacked exactly on the first (crossfaded with opacity).
  stack: { position: 'absolute', top: 0, left: 0, right: 0 },
  readout: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  readoutDeg: { ...textStyle('hero'), color: c.skyText, width: 190, textAlign: 'center' },
  readoutCard: { ...textStyle('subhead'), color: c.textSecondary, letterSpacing: 3, marginTop: -2 },

  infoBlock: { alignItems: 'center', minHeight: 60, gap: 10, paddingHorizontal: 32 },
  errorState: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  cityText: { ...textStyle('title3'), color: c.skyText },
  distanceText: { ...textStyle('footnote'), color: c.textSecondary },
  infoText: { ...textStyle('subhead'), color: c.textSecondary, textAlign: 'center' },
});
