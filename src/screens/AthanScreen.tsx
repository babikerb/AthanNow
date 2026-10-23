import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationSheet } from '../components/LocationSheet';
import SkyScene, { ScenePeriod } from '../components/SkyScene';
import { SCENES } from '../components/sky/palettes';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';
import { refreshWidgetData } from '../utils/widgetData';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function AthanScreen() {
  const { location, cityName, status, hasRestored, travelMismatch, refreshLocation, dismissTravel } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const t = useTheme();
  const { fontScale, width: winW, height: winH } = useWindowDimensions();

  const [now, setNow] = useState(new Date());
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // When the app follows the user to a new city on its own (GPS mode), say so once.
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const lastGpsCity = useRef<string | null>(null);
  useEffect(() => {
    if (!hasRestored || location.isManual || status !== 'ready') return;
    if (lastGpsCity.current && lastGpsCity.current !== location.city && location.city !== 'Current location') setMovedTo(location.city);
    lastGpsCity.current = location.city;
  }, [hasRestored, location.isManual, location.city, status]);

  // Gate on `hasRestored`: `location` is seeded with Mecca, and scheduling off that seed before the
  // saved city is read back would book a week of Mecca athans.
  useNotificationScheduler(hasRestored ? location : null, settings);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tz = location?.timezone;
  const prayerData = useMemo(
    () => (location ? getPrayerTimes(location, localDayAnchor(now, tz), calcMethod, asrMadhab) : null),
    [location, now, tz, calcMethod, asrMadhab],
  );

  // Write a week of times to the widget only when the city or the day's times change, and never
  // from the Mecca seed before the saved city is restored.
  const widgetKey = prayerData && location ? `${cityName}|${prayerData.listRows[0]?.time.getTime()}|${use24Hour}|${calcMethod}|${asrMadhab}` : '';
  useEffect(() => {
    if (!prayerData || !location || !hasRestored) return;
    refreshWidgetData(location, cityName, calcMethod, asrMadhab, use24Hour, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, hasRestored]);

  const currentStart = prayerData?.listRows.find((r) => r.id === prayerData.currentPrayer)?.time;
  // Between midnight and Fajr the stage is still Isha but today's Isha row is ahead: that's night.
  const overnight = !!currentStart && currentStart > now;
  const period: ScenePeriod = !prayerData ? 'night' : overnight ? 'night' : (prayerData.currentPrayer as ScenePeriod);
  useFocusedStatusBar(SCENES[period].statusBar);

  const minutesToNext = prayerData ? Math.max(0, Math.round((prayerData.nextPrayerTime.getTime() - now.getTime()) / 60000)) : 0;
  const countdownLabel = useMemo(() => {
    if (!prayerData) return '';
    const h = Math.floor(minutesToNext / 60);
    const m = minutesToNext % 60;
    return `${h > 0 ? `${h} hour${h === 1 ? '' : 's'} ` : ''}${m} minute${m === 1 ? '' : 's'} until ${prayerData.nextPrayer}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutesToNext, prayerData?.nextPrayer]);

  // How far through the current prayer's window we are. Hidden when the window has no start in today's list.
  const progress = useMemo(() => {
    if (!prayerData || !currentStart || overnight) return null;
    const total = prayerData.nextPrayerTime.getTime() - currentStart.getTime();
    if (!(total > 0)) return null;
    return clamp((now.getTime() - currentStart.getTime()) / total, 0, 1);
  }, [prayerData, currentStart, overnight, now]);

  const openLocation = () => {
    haptic.light();
    setLocationSheetOpen(true);
  };

  const locationSheet = <LocationSheet visible={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />;

  // Layout. The scene owns the top band; nothing but the location and date chrome crosses it.
  // Short screens shrink the band to its floor first, then drop Arabic names, then the progress rule.
  // At large text sizes the whole page scrolls so Dynamic Type applies in full.
  const scrolls = fontScale >= 1.3;
  const sceneH = scrolls ? 280 : clamp(Math.round(winH * 0.4), 240, 360);
  const dropArabic = winH < 700 || fontScale > 1.15;
  const dropProgress = !scrolls && winH < 640;
  const rowMin = scrolls ? 44 : winH < 700 ? 40 : 44;
  const gutter = winW <= 375 ? t.spacing.lg : t.spacing.xl;

  if (!prayerData) {
    return (
      <View style={[styles.container, { backgroundColor: t.c.bg }]}>
        <SkyScene period="night" width={winW} height={sceneH} />
        {locationSheet}
      </View>
    );
  }

  const { nextPrayer, nextPrayerTime, listRows, currentPrayer } = prayerData;
  const nextIdx = listRows.findIndex((r) => r.id === nextPrayer.toLowerCase() && r.time > now);
  const nextClock = formatClock(nextPrayerTime, use24Hour, tz);
  const nextIsTomorrow = nextIdx === -1;

  // Unresolved states never pass Mecca off as the user's city.
  const unresolved = !!location && !location.isManual && hasRestored;
  type Notice = { text: string; actions: { label: string; onPress: () => void }[] };
  const stateNotice: Notice | null = !unresolved
    ? travelMismatch
      ? {
          text: `Your phone is on ${travelMismatch} time, but times are for ${cityName}.`,
          actions: [
            { label: 'Use my location', onPress: () => refreshLocation() },
            { label: `Keep ${cityName}`, onPress: dismissTravel },
          ],
        }
      : null
    : status === 'denied'
      ? {
          text: `Location is off, so times are for ${cityName}.`,
          actions: [
            { label: 'Choose city', onPress: openLocation },
            { label: 'Turn on location', onPress: () => Linking.openSettings().catch(() => {}) },
          ],
        }
      : status === 'error'
        ? {
            text: `Couldn't find you, so times are for ${cityName}.`,
            actions: [
              { label: 'Try again', onPress: () => refreshLocation() },
              { label: 'Choose city', onPress: openLocation },
            ],
          }
        : status === 'idle'
          ? {
              text: `Times are for ${cityName} until you choose.`,
              actions: [
                { label: 'Use my location', onPress: () => refreshLocation() },
                { label: 'Choose city', onPress: openLocation },
              ],
            }
          : null;
  const notice: Notice | null = movedTo
    ? { text: `Times are now for ${movedTo}.`, actions: [{ label: 'OK', onPress: () => setMovedTo(null) }] }
    : stateNotice;

  const Body: React.ComponentType<any> = scrolls ? ScrollView : View;
  const bodyProps = scrolls
    ? { style: styles.flex, contentContainerStyle: { paddingBottom: tabBarHeight + t.spacing.lg } }
    : { style: [styles.flex, { paddingBottom: tabBarHeight + t.spacing.sm }] };

  return (
    <View style={[styles.container, { backgroundColor: t.c.bg }]}>
      <Body {...bodyProps}>
        {/* Scene band with its chrome strip: city on the left, today's dates on the right. */}
        <View style={{ height: sceneH }}>
          <View style={StyleSheet.absoluteFill}>
            <SkyScene period={period} width={winW} height={sceneH} />
          </View>
          <View style={[styles.chrome, { paddingTop: insets.top + t.spacing.sm, paddingHorizontal: gutter }]}>
            <Pressable
              onPress={openLocation}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Location, ${cityName}`}
              accessibilityHint="Changes the city"
              style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.6 : 1 }]}
            >
              {!location?.isManual && status === 'ready' && <SymbolView name="location.fill" size={12} tintColor={t.c.skyText} />}
              <Text variant="subhead" color="skyText" numberOfLines={1} style={styles.pillText}>
                {!hasRestored ? 'Locating…' : cityName}
              </Text>
              <SymbolView name="chevron.down" size={11} tintColor={t.c.skyTextSecondary} />
            </Pressable>
            <View style={styles.dates} accessible accessibilityLabel={`${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${getHijriDate(now)}`}>
              <Text variant="footnote" color="skyText">
                {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              <Text variant="caption" color="skyTextSecondary" numberOfLines={1}>
                {getHijriDate(now)}
              </Text>
            </View>
          </View>
        </View>

        {/* Hero: which prayer is next and how long until it. */}
        <View style={{ paddingHorizontal: gutter, paddingTop: t.spacing.lg }}>
          <View style={styles.heroLine}>
            <Text variant="title3">{nextPrayer}</Text>
            <Text variant="subhead" color="textSecondary">
              {nextIsTomorrow ? `at ${nextClock} tomorrow` : `at ${nextClock}`}
            </Text>
          </View>
          <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityRole="timer" accessibilityLabel={countdownLabel}>
            {formatCountdown(now, nextPrayerTime)}
          </Text>
          {progress != null && !dropProgress && (
            <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.rule, { backgroundColor: t.c.hairline, marginTop: t.spacing.sm }]}>
              <View style={[styles.ruleFill, { width: `${progress * 100}%`, backgroundColor: t.c.accent }]} />
            </View>
          )}
        </View>

        {!scrolls && <View style={styles.flex} />}

        {/* Today's prayers. The next one's time is the only warm text; passed ones fade back. */}
        <View style={{ paddingHorizontal: gutter, paddingTop: scrolls ? t.spacing.xxl : t.spacing.md }}>
          {listRows.map((row, i) => {
            const isNext = i === nextIdx;
            const isPast = row.time <= now;
            const time = formatClock(row.time, use24Hour, tz);
            const isCurrent = row.id === currentPrayer && !overnight;
            return (
              <View
                key={row.id}
                accessible
                accessibilityLabel={`${row.label}, ${time}${isNext ? ', next prayer' : ''}${isCurrent ? ', current prayer' : ''}${isPast ? ', passed' : ''}`}
                style={[styles.row, { minHeight: rowMin }, i < listRows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.hairline }]}
              >
                <View style={styles.rowLabel}>
                  <Text variant={isNext ? 'bodyEmph' : 'body'} color={isPast ? 'textTertiary' : 'text'}>
                    {row.label}
                  </Text>
                  {!dropArabic && (
                    <Text variant="footnote" color="textTertiary">
                      {getCelestialConfig(row.id).arabicName}
                    </Text>
                  )}
                </View>
                <Text variant={isNext ? 'bodyEmph' : 'body'} color={isNext ? 'accentText' : isPast ? 'textTertiary' : 'text'}>
                  {time}
                </Text>
              </View>
            );
          })}
        </View>

        {notice && (
          <View style={{ paddingHorizontal: gutter, paddingTop: t.spacing.md }}>
            <Text variant="footnote" color="textSecondary">
              {notice.text}
            </Text>
            <View style={styles.noticeActions}>
              {notice.actions.map((a) => (
                <Pressable key={a.label} onPress={a.onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.noticeAction, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text variant="subhead" color="accentText">
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Body>

      {locationSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  chrome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, flexShrink: 1 },
  pillText: { flexShrink: 1 },
  dates: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '50%' },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rule: { height: 2, borderRadius: 1, overflow: 'hidden' },
  ruleFill: { height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  noticeActions: { flexDirection: 'row', gap: 20, marginTop: 4 },
  noticeAction: { minHeight: 44, justifyContent: 'center' },
});
