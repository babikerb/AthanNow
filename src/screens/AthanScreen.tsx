import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationSheet } from '../components/LocationSheet';
import SkyScene, { ScenePeriod } from '../components/SkyScene';
import { accentFor, blendAt, mixStops } from '../components/sky/blend';
import { HILLS_UNITS } from '../components/sky/SkyIllustration';
import { publishHomeSky } from '../components/sky/homeSky';
import { moonPhase } from '../components/sky/moon';
import { SCENES, SKY_TONES, SKY_TONES_STRONG } from '../components/sky/palettes';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { getCelestialConfig, getHijriDate, getPrayerTimes, lastThirdStart, prayerLabel } from '../utils/prayerEngine';
import { formatClock, formatLongDate, localDayAnchor, msToMidnight } from '../utils/time';
import { refreshWidgetData } from '../utils/widgetData';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const DEBUG_PERIODS: ScenePeriod[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'night'];
// Representative arc positions when previewing a scene out of its real time.
const DEBUG_ARC: Record<ScenePeriod, number> = { fajr: 0.92, sunrise: 0.08, dhuhr: 0.5, asr: 0.78, maghrib: 1, isha: 0.18, night: 0.55 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** "7h 32m", "32m", or "45s" in the last minute. Minutes round up, so it never reads 0m before the athan. */
function countdownText(now: Date, at: Date): string {
  const ms = at.getTime() - now.getTime();
  if (ms < 60000) return `${Math.max(1, Math.ceil(ms / 1000))}s`;
  const mins = Math.ceil(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// Home is one fixed screen while text is up to this factor; past it (the accessibility sizes) the page
// scrolls instead, and text grows up to LARGE_MAX_SCALE.
const FIXED_MAX_SCALE = 1.35;
const LARGE_MAX_SCALE = 2;
// In the last minutes the page goes quiet: only the next prayer keeps its full strength.
const QUIET_MS = 5 * 60 * 1000;
// Where dark text gives way to light (or the reverse), it waits for half of the sky's finish.
const TONE_DELAY_MS = 800;

export default function AthanScreen() {
  const { location, cityName, status, hasRestored, travelMismatch, refreshLocation, dismissTravel } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const t = useTheme();
  const { fontScale, width: winW, height: winH } = useWindowDimensions();

  const [realNow, setNow] = useState(new Date());
  // Development only: minutes to move the clock by, to see the sky at any time of day.
  const [devShift, setDevShift] = useState(0);
  const now = useMemo(() => (devShift ? new Date(realNow.getTime() + devShift * 60000) : realNow), [realNow, devShift]);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  // The open sky between the chrome and the hero, where the sun or moon travels (pt, screen coords).
  const [zone, setZone] = useState<{ top: number; bottom: number } | null>(null);
  // Development only: cycle through every sky scene to review them.
  const [debugPeriod, setDebugPeriod] = useState<ScenePeriod | null>(null);
  // True for the one render where the switcher changed the scene, so it swaps instantly.
  const [debugSwitch, setDebugSwitch] = useState(false);
  useEffect(() => {
    if (debugSwitch) setDebugSwitch(false);
  }, [debugSwitch]);

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
    () => (location ? getPrayerTimes(location, localDayAnchor(now, tz), calcMethod, asrMadhab, now) : null),
    [location, now, tz, calcMethod, asrMadhab],
  );
  // After Isha the next prayer is tomorrow's Fajr, so the list moves on to tomorrow's times.
  const dayKey = localDayAnchor(now, tz).toDateString();
  const tomorrowData = useMemo(
    () => (location ? getPrayerTimes(location, localDayAnchor(new Date(now.getTime() + DAY_MS), tz), calcMethod, asrMadhab) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location, dayKey, tz, calcMethod, asrMadhab],
  );
  const yesterdayData = useMemo(
    () => (location ? getPrayerTimes(location, localDayAnchor(new Date(now.getTime() - DAY_MS), tz), calcMethod, asrMadhab) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location, dayKey, tz, calcMethod, asrMadhab],
  );

  // Write a week of times to the widget only when the city or the day's times change, and never
  // from the Mecca seed before the saved city is restored.
  const widgetKey = prayerData && location ? `${cityName}|${prayerData.listRows[0]?.time.getTime()}|${use24Hour}|${calcMethod}|${asrMadhab}` : '';
  useEffect(() => {
    if (!prayerData || !location || !hasRestored) return;
    refreshWidgetData(location, cityName, calcMethod, asrMadhab, use24Hour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetKey, hasRestored]);

  const currentStart = prayerData?.listRows.find((r) => r.id === prayerData.currentPrayer)?.time;
  // Between midnight and Fajr the stage is still Isha but today's Isha row is ahead: that's night.
  const overnight = !!currentStart && currentStart > now;
  const livePeriod: ScenePeriod = !prayerData ? 'night' : overnight ? 'night' : (prayerData.currentPrayer as ScenePeriod);
  const period = debugPeriod ?? livePeriod;

  // The minutes before a prayer: how far the sky has turned into the next one. Isha turns to night at
  // midnight, the one change that isn't a prayer.
  const turning = useMemo(() => {
    if (!prayerData || debugPeriod) return null;
    if (livePeriod === 'isha') return blendAt('isha', 'night', msToMidnight(now, tz));
    return blendAt(livePeriod, prayerData.nextPrayer.toLowerCase() as ScenePeriod, prayerData.nextPrayerTime.getTime() - now.getTime());
  }, [prayerData, debugPeriod, livePeriod, now, tz]);
  // Same object until it moves a step, so the sky only redraws when it does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blend = useMemo(() => turning, [turning?.to, turning?.k]);
  const latitude = location?.latitude ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moon = useMemo(() => moonPhase(now, latitude), [dayKey, latitude]);

  // The text's tone follows the sky, a moment late where it flips so the sky is on its way first.
  const skyTone = SCENES[period].full.tone;
  const [toneName, setToneName] = useState(skyTone);
  useEffect(() => {
    if (skyTone === toneName) return;
    const timer = setTimeout(() => setToneName(skyTone), debugPeriod ? 0 : TONE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [skyTone, toneName, debugPeriod]);
  const tone = useMemo(() => {
    const base = (t.highContrast ? SKY_TONES_STRONG : SKY_TONES)[toneName];
    return blend && !t.highContrast ? { ...base, accent: accentFor(period, blend.to, blend.colorK) } : base;
  }, [toneName, t.highContrast, blend, period]);
  useFocusedStatusBar(toneName === 'dark' ? 'dark' : 'light');

  // VoiceOver hears a prayer arrive.
  const spokenPeriod = useRef(livePeriod);
  useEffect(() => {
    if (spokenPeriod.current === livePeriod || !prayerData) return;
    spokenPeriod.current = livePeriod;
    if (livePeriod === 'night') return;
    const row = prayerData.listRows.find((r) => r.id === livePeriod);
    if (row && Math.abs(now.getTime() - row.time.getTime()) < 60000) {
      const name = prayerLabel(row.id, row.time, tz);
      AccessibilityInfo.announceForAccessibility(row.id === 'sunrise' ? 'Sunrise. Fajr time has ended.' : `It is time for ${name}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePeriod]);

  // Where the sun (sunrise to sunset) or the moon (sunset to sunrise) is along its arc right now.
  // Rounded so the sky redraws about once a minute rather than every second.
  const arc = useMemo(() => {
    if (debugPeriod) return DEBUG_ARC[debugPeriod];
    const rise = prayerData?.listRows.find((r) => r.id === 'sunrise')?.time.getTime();
    const set = prayerData?.listRows.find((r) => r.id === 'maghrib')?.time.getTime();
    if (!rise || !set) return 0.5;
    const t0 = now.getTime();
    const f = t0 < rise ? (t0 - (set - DAY_MS)) / (rise - (set - DAY_MS)) : t0 < set ? (t0 - rise) / (set - rise) : (t0 - set) / (rise + DAY_MS - set);
    return Math.round(clamp(f, 0, 1) * 600) / 600;
  }, [debugPeriod, prayerData, now]);

  const minutesToNext = prayerData ? Math.max(0, Math.round((prayerData.nextPrayerTime.getTime() - now.getTime()) / 60000)) : 0;
  const countdownLabel = useMemo(() => {
    if (!prayerData) return '';
    const h = Math.floor(minutesToNext / 60);
    const m = minutesToNext % 60;
    const when = formatClock(prayerData.nextPrayerTime, use24Hour, tz);
    const tomorrow = !prayerData.listRows.some((r) => r.id === prayerData.nextPrayer.toLowerCase() && r.time > now);
    return `${prayerLabel(prayerData.nextPrayer.toLowerCase(), prayerData.nextPrayerTime, tz)} in ${h > 0 ? `${h} hour${h === 1 ? '' : 's'} ` : ''}${m} minute${m === 1 ? '' : 's'}, at ${when}${tomorrow ? ' tomorrow' : ''}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutesToNext, prayerData?.nextPrayer, use24Hour, tz]);

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

  // Layout. One screen, never scrolling. The sky fills it, with the hills and skyline sitting on
  // solid ink above the tab bar. Text sits on the sky in a tone checked for contrast per period.
  // Between the city/date strip and the hero is open sky for the sun or moon, so text never covers
  // them. When space is short the page compresses in a fixed order (row height, the progress rule,
  // then the open sky down to its floor), worked out from type sizes at the current text size so the
  // list never ends up under the tab bar. The Arabic names always stay.
  const large = fontScale > FIXED_MAX_SCALE;
  const maxScale = large ? LARGE_MAX_SCALE : FIXED_MAX_SCALE;
  const fs = Math.min(fontScale, maxScale);
  const gutter = winW <= 375 ? t.spacing.lg : t.spacing.xl;
  const chromeH = insets.top + 52;
  // The whole illustration sits above the tab bar; under the bar is solid ground in the skyline's ink.
  const groundLift = tabBarHeight;
  const hillsH = Math.round((HILLS_UNITS * winW) / 390) + groundLift;
  const unresolvedNow = !location.isManual && hasRestored;
  const hasNotice = !!movedTo || (unresolvedNow ? status === 'denied' || status === 'error' || status === 'idle' : !!travelMismatch);
  const noticeH = hasNotice ? t.spacing.md + 18 * fs * 2 + 4 + 44 : 0;
  // Hero (name + countdown), plus room for the "Tomorrow" label the list shows after Isha.
  const heroText = 68 * Math.min(fs, 1.3) + 30 * fs + 22 * fs;
  const rowFull = Math.max(44, 24 * fs + 16);
  const rowTight = Math.max(36, 24 * fs + 8);
  const fits = (row: number, rule: boolean, zoneMin: number) =>
    chromeH + zoneMin + heroText + (rule ? t.spacing.sm + 2 : 0) + t.spacing.md + 6 * row + noticeH + hillsH <= winH;
  const level = fits(rowFull, true, 72) ? 0 : fits(rowTight, true, 72) ? 1 : fits(rowTight, false, 72) ? 2 : 3;
  const rowMin = level >= 1 ? rowTight : rowFull;
  const dropProgress = level >= 2;
  const minZone = level >= 3 ? 36 : 72;

  // The launch overlay draws this same sky, so handing over to Home only reveals the text.
  useEffect(() => {
    if (hasRestored && prayerData && zone) publishHomeSky({ period, arc, zone, clearTop: chromeH, groundLift, blend, moon });
  });

  if (!prayerData) {
    return (
      <View style={[styles.container, { backgroundColor: SCENES.night.full.sky[0][0] }]}>
        <SkyScene period="night" width={winW} height={winH} layout="full" clearTop={chromeH} groundLift={groundLift} />
        {locationSheet}
      </View>
    );
  }

  const { nextPrayer, nextPrayerTime, listRows, currentPrayer } = prayerData;
  const nextIdx = listRows.findIndex((r) => r.id === nextPrayer.toLowerCase() && r.time > now);
  const showTomorrow = nextIdx === -1 && !!tomorrowData;
  const rows = showTomorrow ? tomorrowData!.listRows : listRows;
  const nextRowIdx = showTomorrow ? rows.findIndex((r) => r.id === nextPrayer.toLowerCase()) : nextIdx;
  const isNow = nextPrayerTime.getTime() <= now.getTime();
  const heroName = prayerLabel(nextPrayer.toLowerCase(), nextPrayerTime, tz);
  const quiet = !isNow && !t.highContrast && nextPrayerTime.getTime() - now.getTime() <= QUIET_MS;

  // After Isha, and on past midnight until Fajr: when the last third of this night begins.
  const timeOf = (data: typeof prayerData | null, id: string) => data?.listRows.find((r) => r.id === id)?.time;
  const nightMaghrib = showTomorrow ? timeOf(prayerData, 'maghrib') : overnight ? timeOf(yesterdayData, 'maghrib') : undefined;
  const nightFajr = showTomorrow ? timeOf(tomorrowData, 'fajr') : overnight ? timeOf(prayerData, 'fajr') : undefined;
  const lastThird = nightMaghrib && nightFajr ? formatClock(lastThirdStart(nightMaghrib, nightFajr), use24Hour, tz) : null;

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

  const ink = { color: tone.text };
  const ink2 = { color: tone.secondary };
  const ink3 = { color: tone.tertiary };

  // Past the fixed size the page scrolls over the skyline, so the list takes a panel of its own sky.
  const skyNow = blend ? mixStops(SCENES[period].full.sky, SCENES[blend.to].full.sky, blend.colorK) : SCENES[period].full.sky;
  const panel = large ? { backgroundColor: `${skyNow[Math.floor(skyNow.length / 2)][0]}F2`, borderRadius: t.radii.card } : null;

  return (
    <View style={[styles.container, { backgroundColor: SCENES[period].full.sky[0][0] }]}>
      <View style={StyleSheet.absoluteFill}>
        <SkyScene period={period} width={winW} height={winH} layout="full" clearTop={chromeH} zone={zone ?? undefined} arc={arc} groundLift={groundLift} instant={debugSwitch} blend={blend} moon={moon} />
      </View>

      <HomePage scroll={large} minHeight={winH}>
        {/* City on the left, today's dates on the right. */}
        <View style={[styles.chrome, { paddingTop: insets.top + t.spacing.sm, paddingHorizontal: gutter }]}>
          <Pressable
            onPress={openLocation}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${cityName}, location`}
            accessibilityHint="Changes the city"
            style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.6 : 1 }]}
          >
            {!location?.isManual && status === 'ready' && <SymbolView name="location.fill" size={12} tintColor={tone.text} />}
            <Text variant="subhead" numberOfLines={1} style={[styles.pillText, ink]}>
              {!hasRestored ? 'Locating…' : cityName}
            </Text>
            <SymbolView name="chevron.down" size={11} tintColor={tone.secondary} />
          </Pressable>
          <View style={[styles.dates, quiet && styles.quiet]} accessible accessibilityLabel={`${formatLongDate(now)}, ${getHijriDate(now)}`}>
            <Text variant="footnote" style={ink}>
              {formatLongDate(now)}
            </Text>
            <Text variant="caption" numberOfLines={1} style={ink2}>
              {getHijriDate(now)}
            </Text>
          </View>
        </View>

        {/* Open sky for the sun or moon. */}
        <View
          style={{ flex: 1, minHeight: minZone }}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setZone((z) => (z && Math.abs(z.top - y) < 1 && Math.abs(z.bottom - (y + height)) < 1 ? z : { top: y, bottom: y + height }));
          }}
        >
          {__DEV__ && (
            <Pressable
              onPress={() => {
                setDebugSwitch(true);
                setDebugPeriod((p) => (p === null ? DEBUG_PERIODS[0] : DEBUG_PERIODS[DEBUG_PERIODS.indexOf(p) + 1] ?? null));
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cycle sky scenes (development only)"
              style={[styles.debug, { right: gutter }]}
            >
              <Text variant="caption" style={{ color: '#F2EDF6' }}>
                {debugPeriod ? `Sky: ${debugPeriod}` : devShift ? `Clock ${formatClock(now, use24Hour, tz)}` : 'Sky: live'}
              </Text>
            </Pressable>
          )}
          {__DEV__ && !debugPeriod && <DevClock shift={devShift} onShift={setDevShift} gutter={gutter} />}
        </View>

        {/* Hero: which prayer is next and how long until it. */}
        <View style={{ paddingHorizontal: gutter }}>
          {/* Two lines: the prayer, then how long until it. Its clock time is already in the list below, in gold. */}
          <View accessible accessibilityRole="timer" accessibilityLabel={countdownLabel}>
            <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={ink}>
              {heroName}
            </Text>
            <Text maxFontSizeMultiplier={maxScale} variant="title2" style={isNow ? { color: tone.accent } : ink}>
              {isNow ? 'Now' : `in ${countdownText(now, nextPrayerTime)}`}
            </Text>
          </View>
          {progress != null && !dropProgress && (
            <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.rule, { backgroundColor: tone.track, marginTop: t.spacing.sm }]}>
              <View style={[styles.ruleFill, { width: `${progress * 100}%`, backgroundColor: tone.accent }]} />
            </View>
          )}
        </View>

        <View>
          {/* Today's prayers (tomorrow's after Isha). The next one's time is the only warm text; passed ones fade back. */}
          <View style={[{ paddingHorizontal: gutter, paddingTop: t.spacing.md }, panel]}>
            {(showTomorrow || lastThird) && (
              <View style={[styles.listHead, { paddingBottom: t.spacing.xs }]}>
                <Text variant="footnote" maxFontSizeMultiplier={maxScale} style={ink2} accessibilityRole="header">
                  {showTomorrow ? 'Tomorrow' : 'Today'}
                </Text>
                {lastThird && (
                  <Text variant="footnote" maxFontSizeMultiplier={maxScale} style={ink2} accessibilityLabel={`The last third of the night begins at ${lastThird}`}>
                    Last third {lastThird}
                  </Text>
                )}
              </View>
            )}
            {rows.map((row, i) => {
              const isNext = i === nextRowIdx;
              const isPast = !showTomorrow && row.time <= now;
              const time = formatClock(row.time, use24Hour, tz);
              const isCurrent = !showTomorrow && row.id === currentPrayer && !overnight;
              const name = prayerLabel(row.id, row.time, tz);
              const strength = isPast ? ink3 : quiet && !isNext ? ink2 : ink;
              return (
                <View
                  key={row.id}
                  accessible
                  accessibilityLabel={`${name}, ${time}${isNext ? ', next prayer' : ''}${isCurrent ? ', current prayer' : ''}${isPast ? ', passed' : ''}`}
                  style={[styles.row, { minHeight: rowMin }, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tone.hairline }]}
                >
                  <View style={styles.rowLabel}>
                    <Text maxFontSizeMultiplier={maxScale} variant={isNext ? 'bodyEmph' : 'body'} style={strength}>
                      {name}
                    </Text>
                    <Text variant="footnote" maxFontSizeMultiplier={maxScale} numberOfLines={1} style={ink3}>
                      {name === 'Jumu’ah' ? 'الجمعة' : getCelestialConfig(row.id).arabicName}
                    </Text>
                  </View>
                  <Text maxFontSizeMultiplier={maxScale} variant={isNext ? 'bodyEmph' : 'body'} style={isNext ? { color: tone.accent } : strength}>
                    {time}
                  </Text>
                </View>
              );
            })}
          </View>

          {notice && (
            <View style={{ paddingHorizontal: gutter, paddingTop: t.spacing.md }}>
              <Text variant="footnote" style={ink2}>
                {notice.text}
              </Text>
              <View style={styles.noticeActions}>
                {notice.actions.map((a) => (
                  <Pressable key={a.label} onPress={a.onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.noticeAction, { opacity: pressed ? 0.6 : 1 }]}>
                    <Text variant="subhead" style={{ color: tone.accent }}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* The hills and skyline show through here, under the tab bar. */}
        <View style={{ height: large ? groundLift + t.spacing.xxl : hillsH }} />
      </HomePage>

      {locationSheet}
    </View>
  );
}

/** Home's page: one fixed screen, or a scrolling one at the accessibility text sizes. */
function HomePage({ scroll, minHeight, children }: { scroll: boolean; minHeight: number; children: React.ReactNode }) {
  if (!scroll) return <View style={styles.flex}>{children}</View>;
  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ flexGrow: 1, minHeight }} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** Development only: drag across a day and watch the sky. Tap the label to come back to now. */
function DevClock({ shift, onShift, gutter }: { shift: number; onShift: (minutes: number) => void; gutter: number }) {
  const width = useRef(1);
  const pan = useMemo(() => {
    const set = (x: number) => onShift(Math.round(((x / width.current) * 2 - 1) * 12 * 60));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    });
  }, [onShift]);
  return (
    <View style={[styles.devClock, { left: gutter }]} accessibilityElementsHidden>
      <View {...pan.panHandlers} onLayout={(e) => (width.current = e.nativeEvent.layout.width)} style={styles.devTrack}>
        <View pointerEvents="none" style={[styles.devThumb, { left: `${(shift / (12 * 60) + 1) * 50}%` }]} />
      </View>
      <Pressable onPress={() => onShift(0)} hitSlop={8}>
        <Text variant="caption" style={{ color: '#F2EDF6' }}>
          Now
        </Text>
      </Pressable>
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
  quiet: { opacity: 0.72 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12 },
  devClock: { position: 'absolute', bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(23,18,31,0.6)' },
  devTrack: { width: 170, height: 28, justifyContent: 'center' },
  devThumb: { position: 'absolute', width: 4, height: 18, marginLeft: -2, borderRadius: 2, backgroundColor: '#F2C14E' },
  rule: { height: 2, borderRadius: 1, overflow: 'hidden' },
  ruleFill: { height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  noticeActions: { flexDirection: 'row', gap: 20, marginTop: 4 },
  noticeAction: { minHeight: 44, justifyContent: 'center' },
  debug: { position: 'absolute', bottom: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(23,18,31,0.6)' },
});
