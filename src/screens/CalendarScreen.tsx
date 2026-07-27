import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingPill, SafeAreaScrim } from '../components/FloatingControl';
import { LocationSheet } from '../components/LocationSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { AppLocation, useLocation } from '../hooks/useLocation';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { ACCENT, ACCENT_SOFT, Palette } from '../theme/colors';
import { PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';
import { importantDateFor } from '../utils/islamicDates';
import { getCelestialConfig, getHijriDate, getPrayerTimes, PRAYER_LIST_ICONS } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';

// A window of days around today the user can scroll through.
const RANGE = 400;
const DAYS = Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE); // offsets from today
// Today onward only — the initial data set (see `pastCount` below).
const FUTURE_DAYS = DAYS.slice(RANGE);

// The 5 real prayers plus the sunrise boundary marker, matching Athan's list
// order. Arabic name comes from `getCelestialConfig`, the same source Athan
// uses for its own row labels — one shared mapping, not two screens
// independently picking translations.
const PRAYER_META: { id: string; icon: SFSymbol; arabic: string }[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((id) => ({
  id,
  icon: PRAYER_LIST_ICONS[id],
  arabic: getCelestialConfig(id).arabicName,
}));

// Fallback estimate for rows that haven't actually rendered/measured yet —
// see the height-cache comment on `CalendarScreen` below for why this is
// only a *fallback*, not the source of truth on its own. Computed from the
// real styles, not eyeballed, but small per-item drift still compounded
// across many days and showed up as "today" not quite reaching the top of
// the list (part of the previous day still visible above it) — the cache
// fixes that by switching to *measured* heights once available instead of
// trusting this estimate forever.
//
// day (paddingVertical 16*2=32) + dayHeader (dateRow ~29 + hijri
// marginTop2+lineHeight16=18, marginBottom 12 => 59) + 6 rows (fajr, sunrise,
// dhuhr, asr, maghrib, isha; each (4+3)*2 padding + body lineHeight 22 = 36,
// x6 = 216, + 5 gaps x2 = 10 => 226) + hairline border (~1) = 318.
const NORMAL_DAY_H = 318;
// + importantRow ((3*2 padding + caption2 lineHeight 14 = 20) + marginBottom
// 8 = 28).
const IMPORTANT_DAY_H = NORMAL_DAY_H + 28;

// Distinct from ACCENT on purpose — a warm gold reads as "occasion/
// celebration" and keeps a significant-date marker legible as its own
// category even on a day that's also TODAY (which uses the green accent),
// rather than the two signals competing for the same color.
const IMPORTANT_TINT = '#C08A2E';
const IMPORTANT_SOFT = 'rgba(192,138,46,0.14)';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DayRowProps {
  offset: number;
  isLast: boolean;
  location: AppLocation;
  calcMethod: string;
  asrMadhab: string;
  use24Hour: boolean;
  tz?: string;
  colors: Palette;
  /** Reports this row's real rendered height back up once laid out, so
   *  `getItemLayout` can use the true value instead of the fallback
   *  estimate — see `CalendarScreen`'s height-cache comment. */
  onMeasured: (offset: number, height: number) => void;
}

/**
 * Redesigned from scratch (per explicit feedback: the old fixed-height
 * bordered "card" per day was clipping content — `CARD_H` forced every day
 * into the same box regardless of what it actually needed to show, and
 * needed an `adjustsFontSizeToFit` band-aid on the Hijri line even at
 * default text size, a tell the budget was already too tight). This is a
 * natural-height flowing row instead: exactly as tall as its own content,
 * never fixed, never a candidate for clipping. Days are separated by a
 * hairline + whitespace, not a bordered box each — one continuous agenda,
 * matching the flat/hairline elevation language the rest of the app uses.
 */
const DayRow = React.memo(function DayRow({ offset, isLast, location, calcMethod, asrMadhab, use24Hour, tz, colors, onMeasured }: DayRowProps) {
  const data = useMemo(() => {
    const base = startOfToday();
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0);
    const pt = getPrayerTimes(location, localDayAnchor(date, tz), calcMethod, asrMadhab);
    const byId = Object.fromEntries(pt.listRows.map((r) => [r.id, r]));
    return {
      isToday: offset === 0,
      // Weekday next to the date on the same line ("Monday, July 27") per
      // explicit feedback — dropped in an earlier pass, added back here.
      label: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      hijri: getHijriDate(date),
      // Natively integrated into the scrolling calendar itself (per explicit
      // feedback) rather than behind a separate button/sheet.
      important: importantDateFor(date),
      // Only meaningful for today: which prayer is next right now.
      nextId: offset === 0 ? pt.nextPrayer?.toLowerCase?.() ?? pt.currentPrayer : undefined,
      rows: PRAYER_META.map((m) => ({ ...m, label: byId[m.id]?.label ?? m.id, time: byId[m.id]?.time as Date })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, location.latitude, location.longitude, tz, calcMethod, asrMadhab]);

  return (
    <View
      style={[styles.day, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}
      onLayout={(e) => onMeasured(offset, e.nativeEvent.layout.height)}
    >
      {data.important && (
        <View style={styles.importantRow}>
          <SymbolView name="moon.stars.fill" size={13} tintColor={IMPORTANT_TINT} />
          <Text style={styles.importantText} numberOfLines={1}>
            {data.important}
          </Text>
        </View>
      )}

      {/* Hijri stacked as a subtitle below the Gregorian date, not sharing a
          row with it — a side-by-side layout meant longer Hijri month names
          (or a longer Gregorian label) could squeeze each other and truncate
          ("September 29" + a long Hijri string in the same row could ellipsize
          the day number). Stacking removes the horizontal competition
          entirely: neither string can ever push the other into an ellipsis,
          regardless of length or Dynamic Type size. Bug fix: `dayHeader`
          previously kept `flexDirection: 'row'` left over from the old
          two-column layout even after this switched to stacked children,
          which crammed everything onto one line — fixed below (now a plain
          column). TODAY is a real badge next to the date now, not a text
          swap replacing the weekday. */}
      <View style={styles.dayHeader}>
        <View style={styles.dateRow}>
          {/* "Weekday, Month Day" can run long ("Wednesday, September 29")
              at this size — numberOfLines + flexShrink means it degrades to
              an ellipsis in an extreme case (large Dynamic Type) instead of
              overflowing the row or pushing the TODAY badge off-screen,
              rather than risking the exact truncation bug this header was
              already rebuilt once to fix. */}
          <Text style={[styles.dateLabel, { color: colors.textPrimary }]} numberOfLines={1}>
            {data.label}
          </Text>
          {data.isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>
        <Text style={[styles.hijri, { color: colors.textSecondary }]}>{data.hijri}</Text>
      </View>

      <View style={styles.rows}>
        {data.rows.map((r) => {
          const active = r.id === data.nextId;
          const tint = active ? ACCENT : colors.textSecondary;
          return (
            <View key={r.id} style={[styles.row, active && { backgroundColor: ACCENT_SOFT }]}>
              <SymbolView name={r.icon} size={16} tintColor={tint} />
              <View style={styles.rowLabelWrap}>
                <Text style={[styles.rowName, { color: active ? ACCENT : colors.textPrimary, fontWeight: active ? '700' : '500' }]}>
                  {r.label}
                </Text>
                {/* Always secondary-toned regardless of row state, same
                    treatment as Athan's own Arabic row labels — a supporting
                    label, not a second value competing with the English name. */}
                <Text style={[styles.rowArabic, { color: colors.textTertiary }]}>{r.arabic}</Text>
              </View>
              <Text style={[styles.rowTime, { color: active ? ACCENT : colors.textPrimary, fontWeight: active ? '700' : '600' }]}>
                {r.time ? formatClock(r.time, use24Hour, tz) : '--:--'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { location, cityName, status, refreshLocation, setLocationByQuery, setLocationByPlace } = useLocation();
  const { calcMethod, asrMadhab, use24Hour } = useSettings();
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  useFocusedStatusBar('light');
  const tz = location?.timezone;
  const listRef = useRef<FlatList<number>>(null);
  // Calendar doesn't otherwise import LocationSheet; a lightweight local
  // trigger (mirroring AthanScreen's own open/close pattern) is the cleanest
  // way to give the empty state a real CTA without lifting state up.
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const openLocation = () => {
    Haptics.selectionAsync();
    setLocationSheetOpen(true);
  };

  // Fallback estimate per day offset (not index — see `getItemLayout` below,
  // which now reads whichever data array FlatList actually hands it).
  // `importantDateFor` depends only on the calendar date, not
  // location/tz/calcMethod, so this never needs recomputing after mount.
  const estimatedHeights = useMemo(() => {
    const base = startOfToday();
    const m = new Map<number, number>();
    for (const o of DAYS) {
      const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + o, 12, 0, 0);
      m.set(o, importantDateFor(date) ? IMPORTANT_DAY_H : NORMAL_DAY_H);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real measured heights, keyed by day offset — filled in as rows actually
  // render via `DayRow`'s `onLayout`. `getItemLayout` below prefers this
  // over `estimatedHeights` wherever it has a value, so the *estimate* only
  // ever matters for rows that haven't rendered yet. A plain mutable ref,
  // not state: updating it must never trigger a re-render, it only needs to
  // be current the next time FlatList calls `getItemLayout`.
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const handleMeasured = (offset: number, height: number) => {
    // Ignore layout noise (e.g. a transient 0 during unmount) and no-op
    // re-measurements of an already-known-good value.
    if (height > 0 && measuredHeights.current.get(offset) !== height) {
      measuredHeights.current.set(offset, height);
    }
  };

  // The list starts scoped to today-onward only (`FUTURE_DAYS`), so today is
  // simply index 0 on the very first render, no scroll-to-index math needed
  // at all, nothing above it to jank into place. Past days are only loaded
  // in batches as the user actually scrolls up toward the start of the list
  // (`onStartReached` below), the same "load older messages" pattern chat
  // apps use, prepending onto the front of `data` while
  // `maintainVisibleContentPosition` keeps whatever's currently on screen
  // visually pinned in place. This replaced two earlier approaches that both
  // reliably left a sliver of the previous day visible at the top: first a
  // single giant two-directional list scrolled to a deep initialScrollIndex
  // (a race between the initial estimate-based scroll and real heights
  // arriving as backward rows mounted), then a background swap to the full
  // list seconds after mount (the same race, just delayed a second rather
  // than removed). Loading strictly in response to the user's own upward
  // scroll, in small batches, is the well-supported case this RN feature is
  // actually built for.
  const PAST_BATCH = 60;
  const [pastCount, setPastCount] = useState(0);
  const displayDays = useMemo(() => (pastCount > 0 ? DAYS.slice(RANGE - pastCount) : FUTURE_DAYS), [pastCount]);
  const todayDisplayIndex = pastCount;

  // `onStartReached` fires as soon as the list mounts, since today (index 0)
  // already sits at the logical start of the content, there's no "scrolled
  // near the top" to detect yet. Gating on a real drag means the very first
  // (spurious, at-mount) call is ignored, past days only ever load once the
  // user has actually touched the list.
  const hasScrolled = useRef(false);
  const loadMorePast = () => {
    if (!hasScrolled.current) return;
    setPastCount((c) => Math.min(c + PAST_BATCH, RANGE));
  };

  const getItemLayout = (data: ArrayLike<number> | null | undefined, index: number) => {
    const arr = (data ?? displayDays) as ArrayLike<number>;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const o = arr[i];
      offset += measuredHeights.current.get(o) ?? estimatedHeights.get(o) ?? NORMAL_DAY_H;
    }
    const o = arr[index];
    return { length: measuredHeights.current.get(o) ?? estimatedHeights.get(o) ?? NORMAL_DAY_H, offset, index };
  };

  const scrollToToday = (animated = true) => {
    // `viewPosition: 0` pins the target row's top edge to the top of the
    // visible list (right below the safe-area padding) — without it,
    // `scrollToIndex` only guarantees the row is *somewhere* on screen,
    // which read as "today" landing mid-list or partially cut off instead
    // of being the clear first entry.
    listRef.current?.scrollToIndex({ index: todayDisplayIndex, animated, viewPosition: 0 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!location ? (
        <View style={[styles.empty, { paddingTop: insets.top + spacing.xxxl }]}>
          <SymbolView name="location.slash" size={40} tintColor={colors.textQuaternary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Set your location to see the prayer schedule.</Text>
          <Pressable
            onPress={openLocation}
            accessibilityRole="button"
            accessibilityLabel="Set location"
            style={({ pressed }) => [styles.emptyButton, { backgroundColor: ACCENT, opacity: pressed ? PRESSED_OPACITY : 1 }]}
          >
            <Text style={styles.emptyButtonText}>Set Location</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={displayDays}
          keyExtractor={(o) => String(o)}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScrollBeginDrag={() => {
            hasScrolled.current = true;
          }}
          onStartReached={loadMorePast}
          onStartReachedThreshold={2}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 }), 0);
          }}
          windowSize={7}
          maxToRenderPerBatch={6}
          initialNumToRender={6}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: tabBarHeight + spacing.xl,
          }}
          renderItem={({ item, index }) => (
            <DayRow
              offset={item}
              isLast={index === displayDays.length - 1}
              location={location}
              calcMethod={calcMethod}
              asrMadhab={asrMadhab}
              use24Hour={use24Hour}
              tz={tz}
              colors={colors}
              onMeasured={handleMeasured}
            />
          )}
        />
      )}

      {/* Guaranteed opaque backing behind the status bar (time/battery) —
          without a header bar, scrolled content had nothing behind that
          strip and could visually bleed under the system UI. */}
      <SafeAreaScrim color={colors.background} />

      {/* Minimal floating control (not a header bar) — the only thing this
          screen needs beyond the list itself. A labeled pill instead of a
          bare icon circle — "jump to today" isn't a self-evident action from
          a plain calendar glyph alone, so pairing it with the word removes
          the ambiguity. Anchored bottom-right, above the tab bar, rather than
          top-right — up there it sat directly over the TODAY badge and date
          of whichever row had scrolled to the top of the list. */}
      <FloatingPill
        tone="onSurface"
        colors={colors}
        icon="calendar"
        label="Today"
        onPress={() => {
          Haptics.selectionAsync();
          scrollToToday();
        }}
        accessibilityLabel="Jump to today"
        style={{ position: 'absolute', bottom: tabBarHeight + spacing.md, right: spacing.lg }}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, paddingHorizontal: spacing.xxxl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...type.body, textAlign: 'center' } as TextStyle,
  emptyButton: {
    marginTop: spacing.xxs,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: { ...type.subhead, color: '#FFF' } as TextStyle,

  day: { paddingVertical: spacing.md },
  importantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    alignSelf: 'flex-start',
    backgroundColor: IMPORTANT_SOFT,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  importantText: { ...type.caption2, color: IMPORTANT_TINT, letterSpacing: 0.2 } as TextStyle,
  // Plain column (was `flexDirection: 'row'`, left over from an earlier
  // two-column layout) — dateRow/hijri are meant to stack, not sit side by
  // side; that mismatch was the "everything crammed on one line" bug.
  dayHeader: { marginBottom: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateLabel: { ...type.title2, flexShrink: 1 } as TextStyle,
  todayBadge: { backgroundColor: ACCENT, borderRadius: radii.xs, paddingHorizontal: spacing.xs, paddingVertical: 3 },
  todayBadgeText: { ...type.caption2, color: '#FFF' } as TextStyle,
  hijri: { ...type.caption, marginTop: 2 } as TextStyle,

  rows: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs + 3,
    borderRadius: radii.sm,
  },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  rowName: { ...type.body } as TextStyle,
  rowArabic: { ...type.footnote, flexShrink: 1 } as TextStyle,
  rowTime: { ...type.body, fontVariant: ['tabular-nums'] } as TextStyle,
});
