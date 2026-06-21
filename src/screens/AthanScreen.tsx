import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
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
import { GlassPill, HeaderBar } from '../components/AppHeader';
import { LocationSheet } from '../components/LocationSheet';
import { useOnboardingTarget } from '../context/OnboardingContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { blendGradients, gradientShiftMinutes, prayerStatusBarLight } from '../theme/colors';
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';
import { updateWidgetData } from '../utils/widget';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SKY_STRIP_HEIGHT = SCREEN_HEIGHT * 0.1;

export default function AthanScreen() {
  const { location, cityName, status, refreshLocation, setLocationByQuery, setLocationByPlace } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const { prayerGradients } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // Onboarding spotlight targets.
  const locTarget = useOnboardingTarget('athan-location');
  const countTarget = useOnboardingTarget('athan-countdown');
  const listTarget = useOnboardingTarget('athan-list');

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

  // Status bar contrast: dark icons only over the light (dhuhr) sky, white otherwise.
  useFocusedStatusBar(prayerData && prayerStatusBarLight[prayerData.currentPrayer] === false ? 'dark' : 'light');

  // Push the day's prayer times to the iOS widget (App Group). Keyed so it only
  // writes when the city or the day's times actually change, not every second.
  const widgetKey =
    prayerData && location ? `${cityName}|${prayerData.listRows[0]?.time.toDateString()}|${use24Hour}` : '';
  useEffect(() => {
    if (!prayerData || !location) return;
    // Include Sunrise so the widgets can show it (the morning lock-screen widget
    // and the home lists). Widget code skips it where it isn't a prayer (gradient).
    const toRows = (rows: typeof prayerData.listRows) =>
      rows.map((r) => ({ name: r.label, time: Math.floor(r.time.getTime() / 1000) }));
    // Write a week of prayer times, not just today, so the widget always has a real
    // future prayer to count down to even if the app isn't opened for several days.
    // Without this the widget runs out of future entries and shows a stale, wrong
    // countdown (e.g. "Fajr in 56:00:00" — counting up from an old, passed time).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const times = [toRows(prayerData.listRows)];
    for (let d = 1; d <= 6; d += 1) {
      const anchor = localDayAnchor(new Date(currentTime.getTime() + d * DAY_MS), tz);
      times.push(toRows(getPrayerTimes(location, anchor, calcMethod, asrMadhab).listRows));
    }
    updateWidgetData(cityName, times.flat(), use24Hour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey]);

  const openLocation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocationSheetOpen(true);
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
      onSelectPlace={setLocationByPlace}
    />
  );

  // How far we are into the shift toward the next prayer (0..1), shared by both the
  // gradient blend and the celestial cross-fade so the sky and sun/moon move together.
  const skyProgress = useMemo(() => {
    if (!prayerData) return 0;
    const windowMin = gradientShiftMinutes[prayerData.currentPrayer] ?? 45;
    const minsToNext = (prayerData.nextPrayerTime.getTime() - currentTime.getTime()) / 60000;
    if (minsToNext < 0 || minsToNext > windowMin) return 0;
    return 1 - minsToNext / windowMin;
  }, [prayerData, currentTime]);

  // Shift the sky toward the next prayer's gradient as its time approaches. Declared
  // before any early return so the hook order stays stable while prayerData is null.
  const skyColors = useMemo(() => {
    if (!prayerData) return prayerGradients.isha;
    const cur = prayerGradients[prayerData.currentPrayer] || prayerGradients.isha;
    const nextCols = prayerGradients[(prayerData.nextPrayer || '').toLowerCase()];
    if (!nextCols || skyProgress <= 0) return cur;
    return blendGradients(cur, nextCols, skyProgress);
  }, [prayerData, prayerGradients, skyProgress]);

  if (!prayerData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AmbientGradient colors={prayerGradients.isha} />
        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Syncing prayer times</Text>
        <TouchableOpacity style={styles.retryPill} onPress={openLocation} activeOpacity={0.8}>
          <Text style={styles.retryText}>Set location</Text>
        </TouchableOpacity>
        {locationSheet}
      </View>
    );
  }

  const { currentPrayer, nextPrayer, nextPrayerTime, listRows } = prayerData;
  const displayPrayer = currentPrayer;
  const celestial = getCelestialConfig(displayPrayer);

  return (
    <View style={styles.container}>
      <AmbientGradient colors={skyColors} />
      {/* Start the celestial arc below the glass header pill so the sun/moon
          never renders behind it (header ≈ inset + 58pt tall). */}
      <SkyScene
        prayer={displayPrayer as any}
        nextPrayer={(nextPrayer || '').toLowerCase() as any}
        progress={skyProgress}
        skyAreaY={insets.top + 72}
      />

      {/* --- HEADER (location pill) — clears the Dynamic Island --- */}
      <View ref={locTarget.ref} onLayout={locTarget.onLayout} collapsable={false}>
        <HeaderBar>
          <GlassPill flex onPress={openLocation}>
            <SymbolView name="location.fill" size={12} tintColor="rgba(255,255,255,0.9)" />
            <Text style={styles.locationText} numberOfLines={1}>{cityName}</Text>
            <SymbolView name="chevron.down" size={10} tintColor="rgba(255,255,255,0.6)" />
          </GlassPill>
        </HeaderBar>
      </View>

      <View style={[styles.content, { paddingBottom: tabBarHeight + 8 }]}>
        {/* --- SKY STRIP (reserves space; celestial drawn by SkyScene) --- */}
        <View style={{ height: SKY_STRIP_HEIGHT }} />

        {/* --- HERO SECTION --- */}
        <View ref={countTarget.ref} onLayout={countTarget.onLayout} collapsable={false} style={styles.heroContainer}>
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
        <View ref={listTarget.ref} onLayout={listTarget.onLayout} collapsable={false} style={styles.listContainer}>
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
        </View>
      </View>

      {locationSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070d18' },
  content: { flex: 1, justifyContent: 'space-between' },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  retryPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  locationText: { color: '#FFF', fontSize: 13, fontWeight: '500', letterSpacing: 0.3, flexShrink: 1 },
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
