import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AmbientGradient from '../components/AmbientGradient';
import SkyScene from '../components/SkyScene';
import { LocationSheet } from '../components/LocationSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { prayerStatusBarLight } from '../theme/colors';
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SKY_STRIP_HEIGHT = SCREEN_HEIGHT * 0.1;

// Order used by the debug switcher to preview every gradient/sky scene.
const DEBUG_PERIODS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export default function AthanScreen() {
  const { location, cityName, status, refreshLocation, setLocationByQuery } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const { prayerGradients } = useTheme();
  const insets = useSafeAreaInsets();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [debugIdx, setDebugIdx] = useState<number | null>(null);

  useNotificationScheduler(location, settings);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tz = location?.timezone;
  const prayerData = useMemo(() => {
    if (!location) return null;
    // Anchor the calculation to the location's local day so far-away timezones are correct.
    return getPrayerTimes(location, localDayAnchor(currentTime, tz), calcMethod, asrMadhab);
  }, [location, currentTime, tz, calcMethod, asrMadhab]);

  const openLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocationSheetOpen(true);
  };

  const cycleDebug = () => {
    Haptics.selectionAsync();
    setDebugIdx((prev) => (prev == null ? 0 : prev < DEBUG_PERIODS.length - 1 ? prev + 1 : null));
  };

  const locationSheet = (
    <LocationSheet
      visible={locationSheetOpen}
      onClose={() => setLocationSheetOpen(false)}
      cityName={cityName}
      isManual={location?.isManual ?? false}
      loading={status === 'loading'}
      onRefresh={refreshLocation}
      onSearch={setLocationByQuery}
    />
  );

  if (!prayerData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AmbientGradient colors={prayerGradients.isha} />
        <StatusBar style="light" />
        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Syncing prayer times</Text>
        <TouchableOpacity style={styles.retryPill} onPress={openLocation} activeOpacity={0.8}>
          <Text style={styles.retryText}>Set location</Text>
        </TouchableOpacity>
        {locationSheet}
      </View>
    );
  }

  const { currentPrayer, nextPrayer, nextPrayerTime, listRows } = prayerData;
  // Debug override changes only the visuals (gradient + sky + hero label), not the times.
  const displayPrayer = debugIdx != null ? DEBUG_PERIODS[debugIdx] : currentPrayer;
  const celestial = getCelestialConfig(displayPrayer);

  return (
    <View style={styles.container}>
      <AmbientGradient colors={prayerGradients[displayPrayer] || prayerGradients.isha} />
      <SkyScene prayer={displayPrayer as any} skyAreaY={insets.top + 44} />
      <StatusBar style={prayerStatusBarLight[displayPrayer] ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safeArea}>
        {/* --- LOCATION PILL --- */}
        <View style={styles.locationPillContainer}>
          <TouchableOpacity style={styles.locationPill} activeOpacity={0.8} onPress={openLocation}>
            <SymbolView name="location.fill" size={12} tintColor="rgba(255,255,255,0.85)" />
            <Text style={styles.locationText}>{cityName}</Text>
            <SymbolView name="chevron.down" size={10} tintColor="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* --- SKY STRIP (reserves space; celestial drawn by SkyScene) --- */}
        <View style={{ height: SKY_STRIP_HEIGHT }} />

        {/* --- HERO SECTION --- */}
        <View style={styles.heroContainer}>
          <View style={styles.heroRow}>
            <Text style={styles.heroPrayerName}>{displayPrayer.toUpperCase()}</Text>
            <Text style={styles.heroArabicAccent}>{celestial.arabicName}</Text>
          </View>
          <Text style={styles.countdownText}>{formatCountdown(currentTime, nextPrayerTime)}</Text>
          <Text style={styles.sublineText}>
            until · {nextPrayer} {formatClock(nextPrayerTime, use24Hour, tz)}
          </Text>
        </View>

        {/* --- PRAYER LIST --- */}
        <View style={styles.listContainer}>
          {listRows.map((row) => {
            const isCurrent = row.id === currentPrayer;
            const isPast = row.time < currentTime && !isCurrent;
            const isSunrise = row.id === 'sunrise';

            let rowStyle: StyleProp<TextStyle> = styles.futureRowText;
            if (isCurrent) rowStyle = styles.currentRowText;
            if (isPast) rowStyle = isSunrise ? styles.pastSunriseRowText : styles.pastRowText;

            return (
              <View key={row.id} style={styles.row}>
                <Text style={[styles.rowLabel, rowStyle]}>{row.label}</Text>
                <Text style={[styles.rowTime, rowStyle]}>{formatClock(row.time, use24Hour, tz)}</Text>
              </View>
            );
          })}
        </View>

        {/* --- DATES + DEBUG --- */}
        <View style={styles.dateContainer}>
          <Text style={styles.gregorianText}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.hijriText}>{getHijriDate(currentTime)}</Text>
          <TouchableOpacity onPress={cycleDebug} style={styles.debugPill} activeOpacity={0.6}>
            <Text style={styles.debugText}>{debugIdx != null ? `● ${DEBUG_PERIODS[debugIdx]}` : '○ preview'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {locationSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070d18' },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  retryPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  safeArea: { flex: 1, justifyContent: 'space-between' },
  locationPillContainer: { alignItems: 'center', zIndex: 10, marginTop: 8 },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  locationText: { color: '#FFF', fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
  skyStrip: { width: '100%', position: 'relative', overflow: 'hidden' },
  celestialBody: { position: 'absolute', width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  heroContainer: { alignItems: 'center', marginTop: -10 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  heroPrayerName: { color: '#FFF', fontSize: 20, fontWeight: '500', letterSpacing: 0.5 },
  heroArabicAccent: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', fontWeight: '400' },
  countdownText: { color: '#FFF', fontSize: 44, fontWeight: '700', letterSpacing: -0.5, marginVertical: 4 },
  sublineText: { color: 'rgba(255, 255, 255, 0.55)', fontSize: 12 },
  listContainer: { paddingHorizontal: 32, maxHeight: SCREEN_HEIGHT * 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { fontSize: 15, letterSpacing: 0.2 },
  rowTime: { fontSize: 15, fontVariant: ['tabular-nums'] },
  currentRowText: { color: '#FFF', fontWeight: '700' },
  futureRowText: { color: '#FFF', fontWeight: '400' },
  pastRowText: { color: '#FFF', opacity: 0.32 },
  pastSunriseRowText: { color: '#FFF', opacity: 0.32, fontStyle: 'italic' },
  dateContainer: { alignItems: 'center', marginBottom: 16, gap: 3 },
  gregorianText: { color: 'rgba(255, 255, 255, 0.65)', fontSize: 13, marginBottom: 2 },
  hijriText: { color: 'rgba(255, 255, 255, 0.38)', fontSize: 12 },
  debugPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  debugText: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '500' },
});
