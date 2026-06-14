import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';

import { GlassPill, HeaderBar, HeaderSpacer, HeaderTitle } from '../components/AppHeader';
import { useOnboardingTarget } from '../context/OnboardingContext';
import { useLocation } from '../hooks/useLocation';
import { useQibla } from '../hooks/useQibla';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { ACCENT } from '../theme/colors';

const BG = '#000000';
const ALIGNED = '#34C759';
const NORTH = '#FF453A';

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

function Compass({
  headingAnim,
  heading,
  qiblaBearing,
  isAligned,
  hasLocation,
  calibrating,
}: {
  headingAnim: Animated.Value;
  heading: number;
  qiblaBearing: number;
  isAligned: boolean;
  hasLocation: boolean;
  calibrating: boolean;
}) {
  const dialSpin = toDeg(headingAnim);
  // Keep every labelled mark upright as the dial turns.
  const counters = useRef(MARKS.map(({ deg }) => toDeg(Animated.subtract(new Animated.Value(-deg), headingAnim)))).current;
  const kaabaCounter = useRef(toDeg(Animated.subtract(new Animated.Value(-qiblaBearing), headingAnim))).current;

  const qiblaColor = isAligned ? ALIGNED : ACCENT;

  return (
    <View style={styles.dialWrap}>
      {isAligned && <View style={styles.alignHalo} />}

      {/* Fixed lubber pointer at the top (green when locked onto the Qibla) */}
      <View style={[styles.lubber, { borderTopColor: isAligned ? ALIGNED : NORTH }]} />

      <View style={[styles.dial, isAligned && { borderColor: ALIGNED, borderWidth: 2 }]}>
        {/* Fixed crosshair */}
        <View style={[styles.crossV, isAligned && { backgroundColor: 'rgba(52,199,89,0.25)' }]} />
        <View style={[styles.crossH, isAligned && { backgroundColor: 'rgba(52,199,89,0.25)' }]} />

        {/* Rotating rose */}
        <Animated.View style={[styles.fill, { transform: [{ rotate: dialSpin }] }]}>
          {TICKS.map((deg) => {
            const isCard = deg % 90 === 0;
            const isMajor = deg % 30 === 0;
            const h = isCard ? 14 : isMajor ? 10 : 5;
            const w = isCard ? 2 : 1;
            const bg = isAligned
              ? isCard
                ? 'rgba(52,199,89,0.9)'
                : isMajor
                ? 'rgba(52,199,89,0.5)'
                : 'rgba(52,199,89,0.28)'
              : isCard
              ? 'rgba(255,255,255,0.85)'
              : isMajor
              ? 'rgba(255,255,255,0.4)'
              : 'rgba(255,255,255,0.18)';
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
          })}

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
                style={[
                  m.cardinal ? styles.markLetter : styles.markNumber,
                  m.label === 'N' && styles.markNorth,
                  isAligned && { color: ALIGNED },
                  { transform: [{ rotate: counters[i] }] },
                ]}
              >
                {m.label}
              </Animated.Text>
            </View>
          ))}

          {/* Qibla / Kaaba marker riding the rim at the Qibla bearing */}
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
              <Animated.View style={[styles.kaabaDisc, { borderColor: qiblaColor, transform: [{ rotate: kaabaCounter }] }]}>
                <Image source={require('../../assets/kaaba.png')} style={styles.kaabaImg} />
              </Animated.View>
            </View>
          )}
        </Animated.View>

        {/* Fixed center heading readout */}
        <View style={styles.readout} pointerEvents="none">
          {calibrating ? (
            <SymbolView name="figure.walk.motion" size={26} tintColor="rgba(255,255,255,0.6)" />
          ) : (
            <>
              <Text style={[styles.readoutDeg, isAligned && { color: ALIGNED }]}>{Math.round(heading)}°</Text>
              <Text style={[styles.readoutCard, isAligned && { color: 'rgba(52,199,89,0.7)' }]}>{toCardinal(heading)}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default function QiblaScreen() {
  const { cityName, status, location } = useLocation();
  const compassTarget = useOnboardingTarget('qibla-compass');
  useFocusedStatusBar('light');
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const qibla = useQibla(latitude, longitude);
  const loading = !location && status === 'loading';
  const error = status === 'denied' || status === 'error';
  const calibrating = qibla.headingAccuracy < 0;

  const wasAligned = useRef(false);
  useEffect(() => {
    if (qibla.isAligned && !wasAligned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasAligned.current = qibla.isAligned;
  }, [qibla.isAligned]);

  return (
    <View style={styles.container}>
      <HeaderBar>
        <HeaderSpacer />
        <GlassPill flex scheme="dark">
          <HeaderTitle title="Qibla" color="#FFFFFF" subColor="rgba(255,255,255,0.6)" />
        </GlassPill>
        <HeaderSpacer />
      </HeaderBar>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="large" />
        ) : (
          <>
            <View ref={compassTarget.ref} onLayout={compassTarget.onLayout} collapsable={false}>
              <Compass
                headingAnim={qibla.headingAnim}
                heading={qibla.heading}
                qiblaBearing={qibla.qiblaBearing}
                isAligned={qibla.isAligned}
                hasLocation={qibla.hasLocation}
                calibrating={calibrating}
              />
            </View>

            <View style={styles.infoBlock}>
              {error ? (
                <Text style={styles.errorText}>Enable location to find the Qibla direction</Text>
              ) : calibrating ? (
                <Text style={styles.calibrateText}>Wave your phone in a figure 8 to calibrate</Text>
              ) : qibla.toleranceDeg >= 30 ? (
                <Text style={styles.calibrateText}>Every direction faces the Qibla here</Text>
              ) : (
                !!cityName && <Text style={styles.cityText}>{cityName}</Text>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 44 },

  dialWrap: { width: DIAL + 24, height: DIAL + 24, alignItems: 'center', justifyContent: 'center' },
  // Concentric with the dial border (the rose is a child of `dial`, so no offset).
  fill: { position: 'absolute', top: 0, left: 0, width: DIAL, height: DIAL },
  alignHalo: { position: 'absolute', width: DIAL + 24, height: DIAL + 24, borderRadius: (DIAL + 24) / 2, backgroundColor: ALIGNED, opacity: 0.16 },
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
    borderTopColor: NORTH,
  },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: R,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossV: { position: 'absolute', width: 1, height: DIAL - 8, backgroundColor: 'rgba(255,255,255,0.07)' },
  crossH: { position: 'absolute', height: 1, width: DIAL - 8, backgroundColor: 'rgba(255,255,255,0.07)' },
  markLetter: { color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '700' },
  markNorth: { color: NORTH, fontWeight: '800' },
  markNumber: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  kaabaDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabaImg: { width: 22, height: 22, tintColor: '#FFFFFF' },
  readout: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  readoutDeg: { color: '#FFFFFF', fontSize: 52, fontWeight: '200', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  readoutCard: { color: 'rgba(255,255,255,0.5)', fontSize: 17, fontWeight: '500', letterSpacing: 3, marginTop: -2 },

  infoBlock: { alignItems: 'center', minHeight: 60, gap: 10 },
  cityText: { color: '#FFFFFF', fontSize: 22, fontWeight: '300', letterSpacing: 0.2 },
  calibrateText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: 0.3, textAlign: 'center', paddingHorizontal: 40 },
  errorText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
