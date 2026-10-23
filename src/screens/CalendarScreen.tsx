import React, { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../context/SettingsContext';
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
import { getCelestialConfig, getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';

// A window of days around today the user can scroll through.
const RANGE = 400;
const DAYS = Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE); // offsets from today
// Today onward only, the initial data set (see `pastCount` below).
const FUTURE_DAYS = DAYS.slice(RANGE);

// The 5 real prayers plus the sunrise boundary marker, matching Athan's list
// order. Arabic name comes from `getCelestialConfig`, the same source Athan
// uses for its own row labels.
const PRAYER_META: { id: string; arabic: string }[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((id) => ({
  id,
  arabic: getCelestialConfig(id).arabicName,
}));

// Fallback height until a day has been measured (measured heights win once rows lay out):
// padding 12*2 + header (headline 22 + footnote 18 + 8) + 6 rows x 44.
const NORMAL_DAY_H = 336;
// + the occasion line.
const IMPORTANT_DAY_H = NORMAL_DAY_H + 18;

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
 * One day: a date header, then the six times in a grouped card. Natural height, so it never clips.
 * The next prayer today shows its time in gold, as on Home.
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
    <View style={styles.day} onLayout={(e) => onMeasured(offset, e.nativeEvent.layout.height)}>
      <View
        style={styles.dayHeader}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${data.isToday ? 'Today, ' : ''}${data.label}, ${data.hijri}${data.important ? `, ${data.important}` : ''}`}
      >
        <Text variant="headline">{data.isToday ? `Today, ${data.label}` : data.label}</Text>
        <Text variant="footnote" color="textSecondary">
          {data.hijri}
        </Text>
        {data.important && (
          <Text variant="footnote" color="accentText">
            {data.important}
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface1 }]}>
        {data.rows.map((r, i) => {
          const active = r.id === data.nextId;
          const time = r.time ? formatClock(r.time, use24Hour, tz) : '--:--';
          return (
            <View
              key={r.id}
              accessible
              accessibilityLabel={`${r.label}, ${time}${active ? ', next prayer' : ''}`}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline }]}
            >
              <View style={styles.rowLabelWrap}>
                <Text variant={active ? 'bodyEmph' : 'body'}>{r.label}</Text>
                {data.isToday && (
                  <Text variant="footnote" color="textTertiary" style={{ flexShrink: 1 }}>
                    {r.arabic}
                  </Text>
                )}
              </View>
              <Text variant={active ? 'bodyEmph' : 'body'} color={active ? 'accentText' : 'text'} style={{ flexShrink: 0 }}>
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
  day: { paddingVertical: 12 },
  dayHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  card: { borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flex: 1 },
});
