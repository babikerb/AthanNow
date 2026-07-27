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
import { FloatingPill } from '../components/FloatingControl';
import { LocationSheet } from '../components/LocationSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { useNotificationScheduler } from '../hooks/useNotificationScheduler';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import {
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
import { formatCountdown, getCelestialConfig, getHijriDate, getPrayerTimes, PRAYER_LIST_ICONS } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';
import { refreshWidgetData } from '../utils/widgetData';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Tightened from 0.1 -> 0.06: on the smallest current iPhone screen heights
// (SE-class, ~667pt), the old fixed composition's total footprint (header +
// sky strip + hero + six-row list + date block + tab bar) added up to more
// than the screen itself, even with the flex spacer at its minHeight floor —
// there's no ScrollView to fall back on, so the overflow pushed the date text
// down under the tab bar instead of reflowing. This, the hero/list/date trims
// below, and a lower flexSpacer floor together claw back enough room to fit
// on the smallest supported screen with margin, not just the one it was
// designed against.
const SKY_STRIP_HEIGHT = SCREEN_HEIGHT * 0.06;

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

export default function AthanScreen() {
  const { location, cityName, status, hasRestored, refreshLocation, setLocationByQuery, setLocationByPlace } = useLocation();
  const settings = useSettings();
  const { calcMethod, asrMadhab, use24Hour } = settings;
  const { prayerGradients } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

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

  return (
    <View style={styles.container}>
      <AmbientGradient colors={skyColors} scrimBottomOpacity={scrimBottomOpacity} />
      {/* No header bar on this screen at all (explicit feedback: it doesn't
          need one, just a way to switch locations). The atmospheric layers
          (gradient, stars) already bleed all the way to the top of the
          screen on their own, `AmbientGradient` is a full-bleed background
          and `SkyScene`'s star field is positioned independent of
          `skyAreaY`, so nothing extra is needed there. `skyAreaY` only
          controls the celestial body (sun/moon)'s arc, which does need to
          stay clear of the location pill, kept generous on purpose. */}
      <SkyScene prayer={displayPrayer as any} skyAreaY={insets.top + 76} />

      <View style={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: tabBarHeight + spacing.xs }]}>
        {/* --- LOCATION (minimal floating pill, not a header) --- */}
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

        {/* --- SKY STRIP (reserves space; celestial drawn by SkyScene) --- */}
        <View style={{ height: SKY_STRIP_HEIGHT }} />

        {/* --- HERO: current prayer eyebrow + countdown to next --- */}
        <View style={styles.heroContainer}>
          <Text style={styles.eyebrowText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{displayPrayer.toUpperCase()}</Text>
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

        {/* Flexible gap, shared with the one below the list (see
            `flexSpacer`): extra room on a given device now splits between
            *both* gaps instead of one fixed-height spacer here and all the
            slack pooling into a single gap below the list — that read as
            leftover empty space rather than intentional breathing room. */}
        <View style={styles.midSpacer} />

        {/* --- PRAYER LIST (no card/box container, per explicit feedback
            straying from the "everything in a bordered card" pattern; rows
            flow directly on the sky, separated by hairlines like Calendar's
            day rows) --- */}
        <View style={styles.listContainer}>
          {listRows.map((row, i) => {
            const isCurrent = row.id === currentPrayer;
            const isPast = row.time < currentTime && !isCurrent;
            const isSunrise = row.id === 'sunrise';
            const isLast = i === listRows.length - 1;

            let rowStyle: StyleProp<TextStyle> = styles.futureRowText;
            if (isCurrent) rowStyle = styles.currentRowText;
            if (isPast) rowStyle = isSunrise ? styles.pastSunriseRowText : styles.pastRowText;

            // Same icon set Calendar's day rows use (`PRAYER_LIST_ICONS`,
            // prayerEngine.ts) — one shared mapping, not two screens
            // independently picking similar glyphs. Arabic name reuses
            // `getCelestialConfig`, already the source for the hero
            // eyebrow's Arabic label above.
            const rowIcon = PRAYER_LIST_ICONS[row.id];
            const rowArabic = getCelestialConfig(row.id).arabicName;

            return (
              <View
                key={row.id}
                style={[styles.row, isCurrent && styles.rowCurrent, !isLast && !isCurrent && styles.rowDivider]}
                // Past state is visual-only (dimmed text) now — no checkmark
                // glyph — but VoiceOver still gets the "already passed"
                // signal via the label, so removing the icon doesn't quietly
                // regress accessibility along with the visual simplification.
                accessibilityLabel={isPast ? `${row.label}, passed` : undefined}
              >
                <View style={styles.rowLabelWrap}>
                  {rowIcon && (
                    <SymbolView
                      name={rowIcon}
                      size={iconSize.sm}
                      tintColor={isPast ? skyTextSecondary : skyTextPrimary}
                    />
                  )}
                  <Text style={[styles.rowLabel, rowStyle]} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{row.label}</Text>
                  {/* Always secondary-toned regardless of row state (current/
                      past/future) — same treatment as the hero eyebrow's
                      Arabic label above, a supporting label, not a second
                      primary value competing with the English name. */}
                  <Text style={styles.rowArabic} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{rowArabic}</Text>
                </View>
                <Text style={[styles.rowTime, rowStyle]} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>{formatClock(row.time, use24Hour, tz)}</Text>
              </View>
            );
          })}
        </View>

        {/* Flexible gap: absorbs whatever room is actually left on a given
            device, so the date block settles near the bottom without ever
            needing the fixed content above to compress to fit. */}
        <View style={styles.flexSpacer} />

        {/* --- DATES --- redesigned per feedback: was two plain footnote-
            weight gray lines, reading as an afterthought against everything
            else on this screen (eyebrow badge, headline-font countdown,
            icon+Arabic prayer rows). Weekday sits next to the date as one
            confident line in the screen's primary text color, Hijri stays a
            clear secondary subtitle below — same "primary line, muted
            subtitle" pattern Calendar's day rows now use, for consistency
            across the app, not just within this screen. */}
        <View style={styles.dateContainer}>
          <Text style={styles.gregorianText} maxFontSizeMultiplier={NO_SCROLL_FONT_CAP}>
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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
  locationPillWrap: { alignItems: 'center' },

  // --- Hero ---
  heroContainer: { alignItems: 'center', marginTop: spacing.xs },
  // No chip/background here on purpose now — it read as a second location-
  // style pill and got lost next to the real one above it, and the Arabic
  // label was redundant with the same name shown on every list row below.
  // A bold, wider-tracked standalone label reads as its own moment instead.
  eyebrowText: { ...type.title3, color: skyTextPrimary, letterSpacing: 1.2 } as TextStyle,
  // Countdown is one of the three reserved Fraunces-SemiBold headline moments
  // app-wide — a numeric hero moment, not a generic large number.
  countdownText: {
    color: skyTextPrimary,
    ...type.hero,
    fontFamily: HEADLINE_FONT_FAMILY,
    marginTop: spacing.xs,
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
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.85)' },

  // Two flexible gaps now (hero->list and list->date) sharing `flex: 1`
  // equally, instead of one fixed gap above and all the slack pooling into
  // one spacer below — both still have a low floor so they're the first
  // things to compress on short screens, never the list or date block.
  midSpacer: { flex: 1, minHeight: spacing.md },
  flexSpacer: { flex: 1, minHeight: spacing.xs },

  // --- Prayer list (no card/box — flows directly on the sky) ---
  // Same side margin the old card had, kept on purpose: rows running edge-
  // to-edge against the screen with no inset read as a layout bug, not as
  // "minimal" — the card is gone, the breathing room around the list isn't.
  listContainer: { marginHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    // Loosened back up now that removing the header (see below) freed real
    // vertical budget — this was tightened to spacing.xs in an earlier pass
    // specifically to fight a clipping bug that's since been fixed a
    // different way (no more header bar eating ~60-70pt off the top).
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  rowCurrent: { backgroundColor: 'rgba(255,255,255,0.10)' },
  // Minimal separator between rows (skipped after the current row and the
  // very last row — a divider directly under/over the highlighted current
  // row would visually cut through its own highlight background).
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  rowLabel: { ...type.body } as TextStyle,
  rowArabic: { ...type.footnote, color: skyTextSecondary, flexShrink: 1 } as TextStyle,
  rowTime: { ...type.body, fontVariant: ['tabular-nums'] } as TextStyle,
  currentRowText: { color: skyTextPrimary, fontWeight: '700' },
  futureRowText: { color: skyTextPrimary, fontWeight: '400' },
  // Past rows are conveyed by color AND the leading checkmark glyph above (never
  // state-by-color/opacity-alone) rather than by a degraded opacity.
  pastRowText: { color: skyTextSecondary },
  pastSunriseRowText: { color: skyTextSecondary, fontStyle: 'italic' },

  dateContainer: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs, gap: 3 },
  // Primary line, screen's main text color (was textSecondary/footnote —
  // the smallest, dimmest text on the page for what's otherwise a full
  // sentence of real information).
  gregorianText: { ...type.subhead, color: skyTextPrimary } as TextStyle,
  // Clear secondary subtitle beneath it, same relationship Calendar's day
  // rows use between the Gregorian date and its Hijri line.
  hijriText: { ...type.caption, color: skyTextSecondary } as TextStyle,
});
