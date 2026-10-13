import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AmbientGradient from '../components/AmbientGradient';
import SkyScene from '../components/SkyScene';
import { FloatingPill } from '../components/FloatingControl';
import { LocationSheet } from '../components/LocationSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { NIGHT_BG, prayerStatusBarLight } from '../theme/colors';
import { Text } from '../design/Text';
import { useTheme as useDesignTheme } from '../design/theme';
import { skyStages } from '../design/tokens';
import { iconSize } from '../theme/icons';
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes, PRAYER_LIST_ICONS } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';
import { refreshWidgetData } from '../utils/widgetData';

export default function AthanScreen() {
  const { location, cityName, status, hasRestored, refreshLocation, setLocationByQuery, setLocationByPlace } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const { prayerGradients } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const dt = useDesignTheme();
  const { fontScale, height: winH } = useWindowDimensions();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // Gate on `hasRestored`, not just `location` (which is always non-null, see
  // `useLocation`'s DEFAULT_LOCATION seed): scheduling notifications off the
  // transient Mecca seed before the real saved city has been read back would
  // book a week of Mecca-timed athans that only gets corrected on the *next*
  // location change, which may not come for days.
  useNotificationScheduler(hasRestored ? location : null, settings);

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
    // `hasRestored` matters as much as `location`/`prayerData` here: `location`
    // is never null (it's seeded with the Mecca default — see `useLocation`),
    // so without this the very first render after a cold launch would write
    // Mecca's week to the widget's App Group storage before the real saved city
    // has been read back from AsyncStorage. If the app backgrounds in that
    // narrow window (e.g. opened just long enough to glance at the widget after
    // tapping a notification), that incorrect write is left standing until the
    // next successful refresh — which can be hours away — and reads exactly
    // like "sometimes I get Mecca/Medina times instead of my real location."
    if (!prayerData || !location || !hasRestored) return;
    // Write a week of prayer times, not just today, so the widget always has a real
    // future prayer to count down to even if the app isn't opened for several days.
    // (The same week is also re-rolled by the background-refresh task.)
    refreshWidgetData(location, cityName, calcMethod, asrMadhab, use24Hour, currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, hasRestored]);

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

  // Sky shows the current stage directly — no cross-fade/blend toward the
  // next prayer's gradient as its time approaches (removed per explicit
  // feedback). Declared before any early return so the hook order stays
  // stable while prayerData is null.
  const skyColors = useMemo(() => {
    if (!prayerData) return prayerGradients.isha;
    return prayerGradients[prayerData.currentPrayer] || prayerGradients.isha;
  }, [prayerData, prayerGradients]);

  // Per-stage scrim from design/tokens.json; the token validator checks sky-text AA against exactly this model.
  const scrimBottomOpacity = skyStages[(prayerData?.currentPrayer ?? 'isha') as keyof typeof skyStages]?.scrimBottom ?? 0.15;

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

  // Purely presentational: how far we are through the *current* prayer's window,
  // used only for the thin progress rule under the countdown. Reads exclusively
  // from data `getPrayerTimes` already returns — no change to prayer-time logic
  // itself. Guarded so an edge case (e.g. the post-midnight `isha` fallback,
  // whose "start" isn't in today's row list) simply hides the rule instead of
  // ever rendering a broken/negative bar.
  const heroProgress = useMemo(() => {
    if (!prayerData) return null;
    const start = prayerData.listRows.find((r) => r.id === prayerData.currentPrayer)?.time;
    if (!start) return null;
    const total = prayerData.nextPrayerTime.getTime() - start.getTime();
    if (!(total > 0)) return null;
    const elapsed = currentTime.getTime() - start.getTime();
    return Math.max(0, Math.min(1, elapsed / total));
  }, [prayerData, currentTime]);

  // `location` is seeded and never null in practice; this only narrows the type.
  if (!prayerData) {
    return (
      <View style={styles.container}>
        <AmbientGradient colors={prayerGradients.isha} />
        {locationSheet}
      </View>
    );
  }

  const { currentPrayer, nextPrayer, nextPrayerTime, listRows } = prayerData;
  const displayPrayer = currentPrayer;
  // Index of the marked (next) row, or -1 (after Isha, tomorrow's Fajr is not in today's list).
  const nextIdx = listRows.findIndex((r) => r.id === nextPrayer.toLowerCase() && r.time > currentTime);
  // Between midnight and Fajr the current stage is still 'isha' but today's Isha row is in the future: call it overnight.
  const currentStart = listRows.find((r) => r.id === currentPrayer)?.time;
  const stageLabel = currentStart && currentStart > currentTime ? 'Overnight' : `Now · ${displayPrayer}`;

  // Short screens / large Dynamic Type degrade in the order BRAND.md specifies:
  // Arabic names, then the progress rule, then the Hijri line; rows shrink to a 36pt minimum last.
  // At accessibility-ish text sizes (>= 1.3x) the composition scrolls instead of capping the text, so Dynamic Type applies
  // in full; below that it stays the no-scroll single screen and degrades in the order above.
  const scrolls = fontScale >= 1.3;
  const dropArabic = winH < 700 || fontScale > 1.15;
  const dropProgress = !scrolls && winH < 640;
  const rowMin = scrolls ? 44 : dropProgress ? 36 : winH < 700 ? 40 : 44;

  // Home states (BRAND.md section 9). Presentation only: reads status the hook already exposes.
  // Unresolved states must never pass off Mecca as the user's city: denied, failed, or never resolved (idle after restore).
  const unresolved = !!location && !location.isManual && hasRestored;
  const notice = !unresolved
    ? null
    : status === 'denied'
      ? 'Location is off. Tap to open Settings, or choose a city above.'
      : status === 'error'
        ? `We couldn't find your location, so these are the times for ${cityName}. Choose your city.`
        : status === 'idle'
          ? `Showing times for ${cityName} for now. Tap to choose your city.`
          : null;

  // The notice needs room on a no-scroll screen: it displaces the Hijri line.
  const dropHijri = !scrolls && (winH < 600 || !!notice);

  const contentPad = { paddingTop: insets.top + dt.spacing.md, paddingBottom: tabBarHeight + dt.spacing.xs, paddingHorizontal: dt.spacing.lg };
  const Container: React.ComponentType<any> = scrolls ? ScrollView : View;
  const containerProps = scrolls
    ? { style: styles.content, contentContainerStyle: [{ flexGrow: 1 }, contentPad], showsVerticalScrollIndicator: true }
    : { style: [styles.content, contentPad] };

  return (
    <View style={styles.container}>
      <AmbientGradient colors={skyColors} scrimBottomOpacity={scrimBottomOpacity} />
      {/* `skyAreaY` only controls the celestial body's arc, which stays clear of the location pill. */}
      <SkyScene prayer={displayPrayer as any} skyAreaY={insets.top + 76} />

      <Container {...containerProps}>
        <View style={styles.locationPillWrap}>
          <FloatingPill
            tone="onSky"
            icon="location.fill"
            trailingIcon="chevron.down"
            label={cityName}
            onPress={openLocation}
            accessibilityLabel={`Location, ${cityName}, double tap to change`}
          />
        </View>

        {/* Reserves space; the celestial body is drawn by SkyScene. */}
        <View style={{ height: winH * 0.06 }} />

        {/* Hero: countdown is primary, then the next prayer, then the current-stage label. */}
        <View style={styles.hero}>
          <Text variant="caption2" color="skyTextSecondary" eyebrow>
            {stageLabel}
          </Text>
          <Text
            variant="hero"
            color="skyText"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            accessibilityRole="timer"
            accessibilityLabel={countdownLabel}
            style={{ textAlign: 'center', alignSelf: 'stretch' }}
          >
            {formatCountdown(currentTime, nextPrayerTime)}
          </Text>
          <Text variant="subhead" color="skyTextSecondary" accessibilityLabel={`at ${formatClock(nextPrayerTime, use24Hour, tz)}`}>
            {`until ${nextPrayer} · ${formatClock(nextPrayerTime, use24Hour, tz)}`}
          </Text>
          {heroProgress != null && !dropProgress && (
            <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.progressTrack, { backgroundColor: dt.c.skyHairline, borderRadius: dt.radii.pill, marginTop: dt.spacing.md }]}>
              <View style={{ height: '100%', width: `${heroProgress * 100}%`, borderRadius: dt.radii.pill, backgroundColor: dt.c.accent }} />
            </View>
          )}
        </View>

        <View style={styles.midSpacer} />

        {/* Prayer list: rows flow directly on the sky. The current prayer carries the only warm marker. */}
        <View>
          {listRows.map((row, i) => {
            // One meaning for the apricot marker across Home, Calendar and the widgets: the NEXT prayer. (After Isha the
            // next prayer is tomorrow's Fajr, whose row is not in today's list, so nothing is marked.) The hero eyebrow
            // says which prayer is current; passed rows, including the current one, are dimmed.
            const isNext = i === nextIdx;
            const isPast = row.time <= currentTime;
            const isSunrise = row.id === 'sunrise';
            const isLast = i === listRows.length - 1;
            const rowIcon = PRAYER_LIST_ICONS[row.id];
            const rowArabic = getCelestialConfig(row.id).arabicName;
            const time = formatClock(row.time, use24Hour, tz);
            const color = isPast ? 'skyTextSecondary' : 'skyText';
            const weight = isNext ? ({ fontWeight: '600' } as const) : null;
            return (
              <React.Fragment key={row.id}>
                <View
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${row.label}, ${time}${isNext ? ', next prayer' : ''}${row.id === currentPrayer && !(currentStart && currentStart > currentTime) ? ', current prayer' : ''}${isPast ? ', passed' : ''}`}
                  style={{
                    minHeight: rowMin,
                    paddingVertical: scrolls ? dt.spacing.xs : 0,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: dt.spacing.md,
                    borderRadius: dt.radii.control,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                  }}
                >
                  {isNext && <View style={[StyleSheet.absoluteFill, { backgroundColor: dt.c.skyWash }]} />}
                  {isNext && <View style={[styles.marker, { backgroundColor: dt.c.accent }]} />}
                  <View style={styles.rowLabelWrap}>
                    {rowIcon && <SymbolView name={rowIcon} size={18} type="hierarchical" tintColor={isPast ? dt.c.skyTextSecondary : dt.c.skyText} />}
                    <Text variant="body" color={color} style={[weight, { flexShrink: 1 }]}>
                      {row.label}
                    </Text>
                    {!dropArabic && (
                      <Text variant="footnote" color="skyTextSecondary" style={{ flexShrink: 1 }}>
                        {rowArabic}
                      </Text>
                    )}
                  </View>
                  <Text variant="body" color={color} style={[weight, { flexShrink: 0, textAlign: 'right' }]}>
                    {time}
                  </Text>
                </View>
                {!isLast && !isNext && i + 1 !== nextIdx && (
                  <View accessibilityElementsHidden importantForAccessibility="no" style={{ height: StyleSheet.hairlineWidth, marginHorizontal: dt.spacing.md, backgroundColor: dt.c.skyHairline }} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.flexSpacer} />

        {/* Dates + state notice */}
        <View style={styles.dateContainer}>
          <Text variant="subhead" color="skyText">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          {!dropHijri && (
            <Text variant="caption" color="skyTextSecondary">
              {getHijriDate(currentTime)}
            </Text>
          )}
          {notice && (
            <Pressable
              onPress={status === 'denied' ? () => Linking.openSettings().catch(() => {}) : openLocation}
              onLongPress={openLocation}
              accessibilityRole="button"
              accessibilityLabel={notice}
              accessibilityHint={status === 'denied' ? 'Opens Settings' : 'Opens the city picker'}
              accessibilityActions={[{ name: 'choose', label: 'Choose city' }]}
              onAccessibilityAction={() => openLocation()}
              hitSlop={8}
              style={{ marginTop: dt.spacing.sm, minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: dt.spacing.xs }}
            >
              <Text variant="footnote" color="skyTextSecondary" numberOfLines={2} style={{ textAlign: 'center', flexShrink: 1 }}>
                {notice}
              </Text>
              <SymbolView name="chevron.right" size={11} weight="semibold" tintColor={dt.c.skyTextSecondary} />
            </Pressable>
          )}
        </View>
      </Container>

      {locationSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NIGHT_BG },
  content: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  locationPillWrap: { alignItems: 'center' },
  hero: { alignItems: 'center', marginTop: 4, gap: 4 },
  progressTrack: { width: 96, height: 3, overflow: 'hidden' },
  // Two flexible gaps (hero->list, list->date) share the slack; both compress first on short screens.
  midSpacer: { flex: 1, minHeight: 12 },
  flexSpacer: { flex: 1, minHeight: 4 },
  marker: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dateContainer: { alignItems: 'center', marginTop: 8, marginBottom: 4, gap: 3 },
});
