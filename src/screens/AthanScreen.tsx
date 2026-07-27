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
  NIGHT_BG,
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

// This screen is a deliberate no-scroll composition (a single flex column, no
// ScrollView) so the countdown, full prayer list, and date always sit on one
// screen together — there's no scroll fallback if content runs long. That's
// fine at default text size (the flexSpacer absorbs the slack), but at large
// Dynamic Type sizes the hero countdown + six-row list + date block combined
// can exceed the screen height, and without a ScrollView that means clipping/
// overlap rather than a scroll, not a graceful reflow. Capping the fixed-
// budget chrome here (not the free-flowing text elsewhere in the app) follows
// the same rule Calendar's fixed-height day cards already established.
const NO_SCROLL_FONT_CAP = 1.3;

// Decorative "glass" surface — intentionally matches AppHeader's
// `fallbackStyle('dark')` values so the prayer-list card reads as the same
// material as the header pill above it, not a second, unrelated surface.
const GLASS_FILL = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';

export default function AthanScreen() {
  const { location, cityName, status, hasRestored, refreshLocation, setLocationByQuery, setLocationByPlace } = useLocation();
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

  // Gate on `hasRestored`, not just `location` (which is always non-null — see
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

  if (!prayerData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AmbientGradient colors={prayerGradients.isha} />
        <Text style={styles.syncingText}>Syncing prayer times</Text>
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

      <View style={[styles.content, { paddingBottom: tabBarHeight + spacing.xs }]}>
        {/* --- SKY STRIP (reserves space; celestial drawn by SkyScene) --- */}
        <View style={{ height: SKY_STRIP_HEIGHT }} />

        {/* --- HERO: current prayer eyebrow + countdown to next --- */}
        <View ref={countTarget.ref} onLayout={countTarget.onLayout} collapsable={false} style={styles.heroContainer}>
          <View style={styles.eyebrowPill}>
            <Text style={styles.eyebrowText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{displayPrayer.toUpperCase()}</Text>
            <View style={styles.eyebrowDivider} />
            <Text style={styles.eyebrowArabic} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{celestial.arabicName}</Text>
          </View>
          <Text style={styles.countdownText} accessibilityLabel={countdownLabel} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>
            {formatCountdown(currentTime, nextPrayerTime)}
          </Text>
          <Text style={styles.sublineText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>
            until {nextPrayer} · {formatClock(nextPrayerTime, use24Hour, tz)}
          </Text>
          {heroProgress != null && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${heroProgress * 100}%` }]} />
            </View>
          )}
        </View>

        {/* Flexible gap: hero anchors near the sky, the list + date anchor near
            the bottom, and this single spacer absorbs whatever room is left —
            one deliberate gap instead of four `space-between` slices. */}
        <View style={styles.flexSpacer} />

        {/* --- PRAYER LIST --- */}
        <View ref={listTarget.ref} onLayout={listTarget.onLayout} collapsable={false} style={styles.listCard}>
          {listRows.map((row) => {
            const isCurrent = row.id === currentPrayer;
            const isPast = row.time < currentTime && !isCurrent;
            const isSunrise = row.id === 'sunrise';

            let rowStyle: StyleProp<TextStyle> = styles.futureRowText;
            if (isCurrent) rowStyle = styles.currentRowText;
            if (isPast) rowStyle = isSunrise ? styles.pastSunriseRowText : styles.pastRowText;

            return (
              <View key={row.id} style={[styles.row, isCurrent && styles.rowCurrent]}>
                <View style={styles.rowLabelWrap}>
                  {isPast && (
                    <SymbolView
                      name="checkmark"
                      size={iconSize.xs}
                      tintColor={skyTextSecondary}
                      style={styles.pastCheckmark}
                    />
                  )}
                  <Text style={[styles.rowLabel, rowStyle]} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{row.label}</Text>
                </View>
                <Text style={[styles.rowTime, rowStyle]} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{formatClock(row.time, use24Hour, tz)}</Text>
              </View>
            );
          })}
        </View>

        {/* --- DATES --- */}
        <View style={styles.dateContainer}>
          <Text style={styles.gregorianText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.hijriText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{getHijriDate(currentTime)}</Text>
        </View>
      </View>

      {locationSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NIGHT_BG },
  content: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  syncingText: { color: skyTextSecondary, ...type.body } as TextStyle,
  retryPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    // paddingHorizontal 18 doesn't land exactly on the spacing grid; kept as
    // token +/- 2 rather than snapping to a token that would visibly tighten
    // or loosen the pill (same precedent as AppHeader.tsx's `bar` style).
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
  },
  retryText: { color: skyTextPrimary, ...type.subhead } as TextStyle,
  locationText: { ...type.footnote, color: skyTextPrimary, letterSpacing: 0.3, flexShrink: 1 } as TextStyle,

  // --- Hero ---
  heroContainer: { alignItems: 'center', marginTop: spacing.sm },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  eyebrowText: { ...type.caption2, color: skyTextPrimary } as TextStyle,
  eyebrowDivider: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: skyTextSecondary },
  eyebrowArabic: { ...type.footnote, color: skyTextSecondary } as TextStyle,
  // Countdown is one of the three reserved Fraunces-SemiBold headline moments
  // app-wide — a numeric hero moment, not a generic large number.
  countdownText: {
    color: skyTextPrimary,
    ...type.hero,
    fontFamily: HEADLINE_FONT_FAMILY,
    marginTop: spacing.sm,
  } as TextStyle,
  sublineText: { color: skyTextSecondary, ...type.caption, marginTop: spacing.xxs } as TextStyle,
  // Width is a deliberate multiple of an existing token (xxxl * 3) rather than
  // an invented pixel value — see spacing.ts's own precedent for this pattern.
  progressTrack: {
    width: spacing.xxxl * 3,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.85)' },

  flexSpacer: { flex: 1, minHeight: spacing.xl },

  // --- Prayer list card ---
  listCard: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: GLASS_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  rowCurrent: { backgroundColor: 'rgba(255,255,255,0.10)' },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  pastCheckmark: { marginTop: 1 },
  rowLabel: { ...type.body } as TextStyle,
  rowTime: { ...type.body, fontVariant: ['tabular-nums'] } as TextStyle,
  currentRowText: { color: skyTextPrimary, fontWeight: '700' },
  futureRowText: { color: skyTextPrimary, fontWeight: '400' },
  // Past rows are conveyed by color AND the leading checkmark glyph above (never
  // state-by-color/opacity-alone) rather than by a degraded opacity.
  pastRowText: { color: skyTextSecondary },
  pastSunriseRowText: { color: skyTextSecondary, fontStyle: 'italic' },

  dateContainer: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xs, gap: 2 },
  gregorianText: { ...type.footnote, color: skyTextSecondary } as TextStyle,
  hijriText: { ...type.caption, color: skyTextSecondary } as TextStyle,
});
