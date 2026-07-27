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
import {
  blendGradients,
  gradientShiftMinutes,
  prayerStatusBarLight,
  skyTextPrimary,
  skyTextSecondary,
} from '../theme/colors';
import { iconSize } from '../theme/icons';
import { PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { HEADLINE_FONT_FAMILY, type } from '../theme/typography';
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';
import { refreshWidgetData } from '../utils/widgetData';

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
  // writes when the city or the day's times actually change, not every second. We
  // key on Fajr's exact timestamp (not just its date) plus the calc method and
  // madhab, so changing those in Settings rewrites the widget immediately instead
  // of leaving it stale until the next day or a city change.
  const widgetKey =
    prayerData && location
      ? `${cityName}|${prayerData.listRows[0]?.time.getTime()}|${use24Hour}|${calcMethod}|${asrMadhab}`
      : '';
  useEffect(() => {
    if (!prayerData || !location) return;
    // Write a week of prayer times, not just today, so the widget always has a real
    // future prayer to count down to even if the app isn't opened for several days.
    // (The same week is also re-rolled by the background-refresh task.)
    refreshWidgetData(location, cityName, calcMethod, asrMadhab, use24Hour, currentTime);
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

  // Darkening scrim under the hero text (plan §1.5): Dhuhr's gradient (`#8eb2c4`)
  // is far lighter than every other stage's, so it alone needs a strong scrim to
  // keep white hero text at AA contrast; every other stage is already dark enough
  // that a flat, mild scrim suffices.
  const scrimBottomOpacity = prayerData?.currentPrayer === 'dhuhr' ? 0.35 : 0.15;

  // Countdown accessibility label, rounded to the minute (not raw seconds) so
  // VoiceOver doesn't get a per-second announcement storm from the 1s countdown
  // re-render. `minutesToNext` is plain arithmetic re-evaluated every render, but
  // the label string itself is only recomputed when the rounded minute value (or
  // the next-prayer name) actually changes.
  const minutesToNext = prayerData
    ? Math.max(0, Math.round((prayerData.nextPrayerTime.getTime() - currentTime.getTime()) / 60000))
    : 0;
  const countdownLabel = useMemo(() => {
    if (!prayerData) return '';
    const h = Math.floor(minutesToNext / 60);
    const m = minutesToNext % 60;
    const hourPart = h > 0 ? `${h} hour${h === 1 ? '' : 's'} ` : '';
    return `${hourPart}${m} minute${m === 1 ? '' : 's'} until ${prayerData.nextPrayer}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutesToNext, prayerData?.nextPrayer]);

  if (!prayerData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AmbientGradient colors={prayerGradients.isha} />
        <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Syncing prayer times</Text>
        <TouchableOpacity style={styles.retryPill} onPress={openLocation} activeOpacity={PRESSED_OPACITY}>
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
      <AmbientGradient colors={skyColors} scrimBottomOpacity={scrimBottomOpacity} />
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
          <GlassPill
            flex
            onPress={openLocation}
            accessibilityLabel={`Location, ${cityName}, double tap to change`}
          >
            <SymbolView name="location.fill" size={iconSize.xs} tintColor="rgba(255,255,255,0.9)" />
            <Text style={styles.locationText} numberOfLines={1}>{cityName}</Text>
            {/* Bumped from a near-invisible 10px/0.6-opacity chevron (plan §3.3): this is
                the only affordance that the pill is tappable, and wrong city = every time
                on screen is wrong, so it needs to read clearly, not just technically exist. */}
            <SymbolView name="chevron.down" size={iconSize.sm} tintColor="rgba(255,255,255,0.85)" />
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
          <Text style={styles.countdownText} accessibilityLabel={countdownLabel}>
            {formatCountdown(currentTime, nextPrayerTime)}
          </Text>
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
                <View style={styles.rowLabelWrap}>
                  {isPast && (
                    <SymbolView
                      name="checkmark"
                      size={iconSize.xs}
                      tintColor={skyTextSecondary}
                      style={styles.pastCheckmark}
                    />
                  )}
                  <Text style={[styles.rowLabel, rowStyle]}>{row.label}</Text>
                </View>
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
    // paddingHorizontal 18 doesn't land exactly on the spacing grid; kept as
    // token +/- 2 rather than snapping to a token that would visibly tighten
    // or loosen the pill (same precedent as AppHeader.tsx's `bar` style).
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
  },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  locationText: { color: '#FFF', fontSize: 13, fontWeight: '500', letterSpacing: 0.3, flexShrink: 1 },
  // marginTop -10 sits exactly between the xs (8) and sm (12) tokens and
  // doesn't land cleanly on either; kept as token +/- 2 rather than snapping
  // to a value that would visibly shift the hero block (same precedent as
  // AppHeader.tsx's `bar` style).
  heroContainer: { alignItems: 'center', marginTop: -(spacing.sm - 2) },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  heroPrayerName: { color: skyTextPrimary, ...type.title3 } as TextStyle,
  heroArabicAccent: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', fontWeight: '400' },
  // Countdown is one of the three reserved Fraunces-SemiBold headline moments
  // app-wide (plan §1.1) — a numeric hero moment, not a generic large number.
  countdownText: {
    color: skyTextPrimary,
    ...type.hero,
    fontFamily: HEADLINE_FONT_FAMILY,
    marginVertical: spacing.xxs,
  } as TextStyle,
  sublineText: { color: skyTextSecondary, ...type.caption } as TextStyle,
  listContainer: { paddingHorizontal: spacing.xxl, maxHeight: SCREEN_HEIGHT * 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  pastCheckmark: { marginTop: 1 },
  rowLabel: { ...type.body } as TextStyle,
  rowTime: { ...type.body, fontVariant: ['tabular-nums'] } as TextStyle,
  currentRowText: { color: '#FFF', fontWeight: '700' },
  futureRowText: { color: '#FFF', fontWeight: '400' },
  // Past rows are conveyed by color AND the leading checkmark glyph above (§2.5:
  // never state-by-color/opacity-alone) rather than by a degraded opacity.
  pastRowText: { color: skyTextSecondary },
  pastSunriseRowText: { color: skyTextSecondary, fontStyle: 'italic' },
  // gap 3 doesn't land exactly on the spacing grid; kept as token - 1 rather
  // than snapping to xxs (4), which would visibly loosen this tight date
  // stack (same precedent as AppHeader.tsx's `bar` style).
  dateContainer: { alignItems: 'center', marginBottom: spacing.md, gap: spacing.xxs - 1 },
  gregorianText: { color: 'rgba(255, 255, 255, 0.65)', fontSize: 13, marginBottom: 2 },
  hijriText: { color: skyTextSecondary, ...type.caption } as TextStyle,
});
