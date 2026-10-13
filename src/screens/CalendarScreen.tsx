import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../context/SettingsContext';
import { Badge } from '../design/Badge';
import { Button } from '../design/Button';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme as useDesignTheme } from '../design/theme';
import type { Palette } from '../design/tokens';
import { useLocation } from '../context/LocationContext';
import type { AppLocation } from '../hooks/useLocation';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
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
// uses for its own row labels.
const PRAYER_META: { id: string; icon: SFSymbol; arabic: string }[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((id) => ({
  id,
  icon: PRAYER_LIST_ICONS[id],
  arabic: getCelestialConfig(id).arabicName,
}));

// Fallback height estimate for rows that haven't rendered/measured yet (the
// measured-height cache in `CalendarScreen` is the source of truth once rows
// lay out). day padding 16*2 + header (title2 30 + hijri 2+16 + 12) 60 +
// 6 rows x (7*2 padding + body 24) 38 = 228 + 5 gaps x 2 = 10 + hairline ~ 330.
const NORMAL_DAY_H = 331;
// + occasion badge row (badge ~20 + margin 8).
const IMPORTANT_DAY_H = NORMAL_DAY_H + 28;

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
   *  `getItemLayout` can use the true value instead of the fallback estimate. */
  onMeasured: (offset: number, height: number) => void;
}

/**
 * One natural-height day in a continuous agenda: never a fixed-height card, so
 * it can never clip. Days are separated by a hairline and whitespace. Today is
 * marked by a small accent badge; the next prayer on today's row carries the
 * same apricot tick used on Home.
 */
const DayRow = React.memo(function DayRow({ offset, isLast, location, calcMethod, asrMadhab, use24Hour, tz, colors, onMeasured }: DayRowProps) {
  const data = useMemo(() => {
    const base = startOfToday();
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0);
    const pt = getPrayerTimes(location, localDayAnchor(date, tz), calcMethod, asrMadhab);
    const byId = Object.fromEntries(pt.listRows.map((r) => [r.id, r]));
    return {
      isToday: offset === 0,
      label: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      hijri: getHijriDate(date),
      important: importantDateFor(date),
      // Only meaningful for today: which prayer is next right now.
      nextId:
        offset === 0 && pt.nextPrayer && ((byId[pt.nextPrayer.toLowerCase()]?.time as Date | undefined)?.getTime() ?? 0) > Date.now()
          ? pt.nextPrayer.toLowerCase()
          : undefined,
      rows: PRAYER_META.map((m) => ({ ...m, label: byId[m.id]?.label ?? m.id, time: byId[m.id]?.time as Date })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, location.latitude, location.longitude, tz, calcMethod, asrMadhab]);

  return (
    <View
      style={[styles.day, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
      onLayout={(e) => onMeasured(offset, e.nativeEvent.layout.height)}
    >
      {data.important && (
        <View style={styles.importantRow}>
          <Badge label={data.important} tone="info" />
        </View>
      )}

      {/* Hijri stacked as a subtitle below the Gregorian date so neither string can squeeze the other. */}
      <View
        style={styles.dayHeader}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${data.isToday ? 'Today, ' : ''}${data.label}, ${data.hijri}`}
      >
        <View style={styles.dateRow}>
          <Text variant="title2" style={{ flexShrink: 1 }}>
            {data.label}
          </Text>
          {data.isToday && <Badge label="Today" tone="accent" />}
        </View>
        <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
          {data.hijri}
        </Text>
      </View>

      <View style={styles.rows}>
        {data.rows.map((r) => {
          const active = r.id === data.nextId;
          const time = r.time ? formatClock(r.time, use24Hour, tz) : '--:--';
          return (
            <View
              key={r.id}
              accessible
              accessibilityLabel={`${r.label}, ${time}${active ? ', next prayer' : ''}`}
              style={[styles.row, active && { backgroundColor: colors.accentSoft }]}
            >
              {active && <View style={[styles.tick, { backgroundColor: colors.accent }]} />}
              {data.isToday && <SymbolView name={r.icon} size={16} type="hierarchical" tintColor={colors.textSecondary} />}
              <View style={styles.rowLabelWrap}>
                <Text variant="body" color="text" style={{ fontWeight: active ? '600' : '400' }}>
                  {r.label}
                </Text>
                {data.isToday && (
                  <Text variant="footnote" color="textTertiary" style={{ flexShrink: 1 }}>
                    {r.arabic}
                  </Text>
                )}
              </View>
              <Text variant="body" color="text" style={{ fontWeight: active ? '600' : '400', fontVariant: ['tabular-nums'], flexShrink: 0 }}>
                {time}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default function CalendarScreen() {
  const dt = useDesignTheme();
  const colors = dt.c;
  // `location` is always seeded by useLocation (never null), so there is no empty state to design here.
  const { location } = useLocation();
  const { calcMethod, asrMadhab, use24Hour } = useSettings();
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? dt.spacing.lg : dt.spacing.xl;
  useFocusedStatusBar(dt.scheme === 'dark' ? 'light' : 'dark');
  const tz = location?.timezone;
  const listRef = useRef<FlatList<number>>(null);

  // Fallback estimate per day offset. `importantDateFor` depends only on the
  // calendar date, so this never needs recomputing after mount.
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

  // Real measured heights keyed by day offset, filled in as rows render via
  // `DayRow`'s `onLayout`. `getItemLayout` prefers these over the estimates. A
  // plain mutable ref (not state): updating it must never trigger a re-render.
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const handleMeasured = (offset: number, height: number) => {
    if (height > 0 && measuredHeights.current.get(offset) !== height) {
      measuredHeights.current.set(offset, height);
    }
  };

  // The list starts scoped to today-onward (`FUTURE_DAYS`), so today is index 0
  // on first render. Past days load in batches as the user scrolls up
  // (`onStartReached`), prepended with `maintainVisibleContentPosition`.
  const PAST_BATCH = 60;
  const [pastCount, setPastCount] = useState(0);
  const displayDays = useMemo(() => (pastCount > 0 ? DAYS.slice(RANGE - pastCount) : FUTURE_DAYS), [pastCount]);
  const todayDisplayIndex = pastCount;

  // `onStartReached` fires at mount; gating on a real drag ignores that call.
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
    // `viewPosition: 0` pins today's top edge to the top of the list.
    listRef.current?.scrollToIndex({ index: todayDisplayIndex, animated, viewPosition: 0 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header: large title + the one action. Opaque, so scrolled days never slide under the status bar. */}
      <View
        style={{
          paddingTop: insets.top + dt.spacing.sm,
          paddingHorizontal: gutter,
          paddingBottom: dt.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        }}
      >
        <Text variant="title1" header maxFontSizeMultiplier={1.3} style={{ flexShrink: 1 }}>
          Calendar
        </Text>
        <Button
          label="Today"
          icon="calendar"
          variant="secondary"
          style={{ flexShrink: 0, marginLeft: dt.spacing.md }}
          accessibilityHint="Scrolls to today's prayer times"
          onPress={() => {
            haptic.select();
            scrollToToday();
          }}
        />
      </View>

      {location && (
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
            paddingHorizontal: gutter,
            paddingTop: dt.spacing.xs,
            paddingBottom: tabBarHeight + dt.spacing.xl,
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
    </View>
  );
}

const styles = StyleSheet.create({
  day: { paddingVertical: 16 },
  importantRow: { alignSelf: 'flex-start', marginBottom: 8 },
  dayHeader: { marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rows: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tick: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
});
