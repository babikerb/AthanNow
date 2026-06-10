import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Image, StatusBar, StyleSheet, Text, View } from 'react-native';

import { useLocation } from '../hooks/useLocation';
import { useQibla } from '../hooks/useQibla';

const BEZEL = 320;
const ROSE = 292;
const R = ROSE / 2;

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

const DIRS = [
  { deg: 0, label: 'N', color: '#FF3B30', size: 19, weight: '700' as const },
  { deg: 45, label: 'NE', color: 'rgba(255,255,255,0.5)', size: 11, weight: '500' as const },
  { deg: 90, label: 'E', color: '#FFFFFF', size: 17, weight: '600' as const },
  { deg: 135, label: 'SE', color: 'rgba(255,255,255,0.5)', size: 11, weight: '500' as const },
  { deg: 180, label: 'S', color: '#FFFFFF', size: 17, weight: '600' as const },
  { deg: 225, label: 'SW', color: 'rgba(255,255,255,0.5)', size: 11, weight: '500' as const },
  { deg: 270, label: 'W', color: '#FFFFFF', size: 17, weight: '600' as const },
  { deg: 315, label: 'NW', color: 'rgba(255,255,255,0.5)', size: 11, weight: '500' as const },
];

const CARDINAL_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function toCardinal(deg: number): string {
  return CARDINAL_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
function kmToMi(km: number): string {
  return Math.round(km * 0.621371).toLocaleString();
}

function CompassRose({ headingAnim, qiblaBearing, isAligned }: { headingAnim: Animated.Value; qiblaBearing: number; isAligned: boolean }) {
  const counterSpins = useRef(
    DIRS.map(({ deg }) =>
      Animated.add(Animated.multiply(headingAnim, -1), new Animated.Value(-deg)).interpolate({
        inputRange: [-7200, 0, 7200],
        outputRange: ['-7200deg', '0deg', '7200deg'],
        extrapolate: 'extend',
      }),
    ),
  ).current;

  const spin = headingAnim.interpolate({ inputRange: [-7200, 0, 7200], outputRange: ['-7200deg', '0deg', '7200deg'], extrapolate: 'extend' });
  const qColor = isAligned ? '#4CAF50' : '#FFFFFF';

  return (
    <View style={styles.bezel}>
      <View style={styles.cursor} />
      <View style={styles.crossH} />
      <View style={styles.crossV} />
      <Animated.View style={[styles.rose, { transform: [{ rotate: spin }] }]}>
        {TICKS.map((deg) => {
          const isCard = deg % 90 === 0;
          const isInter = deg % 45 === 0 && !isCard;
          const isTen = deg % 10 === 0;
          const h = isCard ? 22 : isInter ? 16 : isTen ? 10 : 6;
          const w = isCard ? 2.5 : isInter ? 1.5 : 1;
          const bg = isCard ? '#FFFFFF' : isInter ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)';
          return <View key={deg} style={{ position: 'absolute', width: w, height: h, backgroundColor: bg, top: R - h / 2, left: R - w / 2, transform: [{ rotate: `${deg}deg` }, { translateY: -(R - h / 2 - 2) }] }} />;
        })}
        {DIRS.map(({ deg, label, color, size, weight }, i) => (
          <View key={label} style={{ position: 'absolute', width: 30, height: 24, top: R - 12, left: R - 15, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${deg}deg` }, { translateY: -(R - 44) }] }}>
            <Animated.Text style={{ color, fontSize: size, fontWeight: weight, transform: [{ rotate: counterSpins[i] }] }}>{label}</Animated.Text>
          </View>
        ))}
        <View style={{ position: 'absolute', top: R - 59, left: R - 5, width: 10, height: 118, alignItems: 'center' }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FF3B30' }} />
          <View style={{ width: 4, height: 40, backgroundColor: '#FF3B30' }} />
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#000', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }} />
          <View style={{ width: 4, height: 40, backgroundColor: '#555' }} />
          <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 14, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#555' }} />
        </View>
        <Image
          source={require('../../assets/kaaba.png')}
          style={{ position: 'absolute', width: 22, height: 22, top: R - 11, left: R - 11, tintColor: qColor, transform: [{ rotate: `${qiblaBearing}deg` }, { translateY: -(R - 26) }] }}
        />
      </Animated.View>
      <View style={styles.centerDot} />
    </View>
  );
}

export default function QiblaScreen() {
  const { location, cityName, status } = useLocation();
  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const qibla = useQibla(latitude, longitude);
  const loading = !location && status === 'loading';
  const error = status === 'denied' || status === 'error';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="large" />
      ) : (
        <>
          {qibla.headingAccuracy < 0 ? (
            <Text style={styles.calibrateText}>Wave your phone in a figure 8 to calibrate</Text>
          ) : (
            <View style={styles.headingRow}>
              <Text style={styles.headingDeg}>{Math.round(qibla.heading)}</Text>
              <Text style={styles.headingCard}>{toCardinal(qibla.heading)}</Text>
            </View>
          )}

          <CompassRose headingAnim={qibla.headingAnim} qiblaBearing={qibla.qiblaBearing} isAligned={qibla.isAligned} />

          <View style={styles.infoBlock}>
            {error ? (
              <Text style={styles.errorText}>Enable location to find Qibla direction</Text>
            ) : (
              <>
                {!!cityName && <Text style={styles.cityText}>{cityName}</Text>}
                {qibla.isAligned && (
                  <View style={styles.alignedBadge}>
                    <Text style={styles.alignedText}>Facing Qibla</Text>
                  </View>
                )}
                {qibla.hasLocation && <Text style={styles.distanceText}>Qibla · {kmToMi(qibla.distanceKm)} mi away</Text>}
              </>
            )}
          </View>
        </>
      )}
      <Text style={styles.methodLabel}>{qibla.usingTrueHeading ? 'True North' : 'Acquiring GPS'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  calibrateText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: 0.3, marginBottom: 32, textAlign: 'center', paddingHorizontal: 40 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 32 },
  headingDeg: { color: '#FFFFFF', fontSize: 36, fontWeight: '200', letterSpacing: -0.5 },
  headingCard: { color: 'rgba(255,255,255,0.4)', fontSize: 20, fontWeight: '300', letterSpacing: 0.5 },
  bezel: { width: BEZEL, height: BEZEL, borderRadius: BEZEL / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  cursor: { position: 'absolute', zIndex: 10, top: (BEZEL - ROSE) / 2 - 2, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FF3B30' },
  crossH: { position: 'absolute', zIndex: 3, height: 1, width: ROSE, backgroundColor: 'rgba(255,255,255,0.1)' },
  crossV: { position: 'absolute', zIndex: 3, width: 1, height: ROSE, backgroundColor: 'rgba(255,255,255,0.1)' },
  rose: { width: ROSE, height: ROSE, borderRadius: R, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)' },
  centerDot: { position: 'absolute', zIndex: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  infoBlock: { alignItems: 'center', marginTop: 32, minHeight: 80 },
  cityText: { color: '#FFFFFF', fontSize: 22, fontWeight: '300', letterSpacing: 0.2, marginBottom: 12 },
  alignedBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: '#4CAF50', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 14 },
  alignedText: { color: '#4CAF50', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  distanceText: { color: 'rgba(255,255,255,0.28)', fontSize: 13, letterSpacing: 0.2 },
  errorText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  methodLabel: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.18)', fontSize: 11, letterSpacing: 0.5 },
});
