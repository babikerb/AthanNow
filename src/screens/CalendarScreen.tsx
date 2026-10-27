import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../design/Button';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { importantDateFor } from '../utils/islamicDates';
import { getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, formatClockShort, formatDayHeading, localDayAnchor, ordinal } from '../utils/time';

const COLUMNS: { id: string; label: string }[] = [
  { id: 'fajr', label: 'Fajr' },
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'dhuhr', label: 'Dhuhr' },
  { id: 'asr', label: 'Asr' },
  { id: 'maghrib', label: 'Maghrib' },
  { id: 'isha', label: 'Isha' },
];
const ROW_H = 46;
const DATE_COL = 78;

const hijriFmt = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
function hijriParts(d: Date) {
  const parts = hijriFmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: Number(get('day')), month: get('month'), year: get('year') };
}

interface DayRow {
  date: Date;
  isToday: boolean;
  weekday: string;
  hijriDay: number;
  hijriMonth: string;
  occasion: string | null;
  times: Record<string, Date | undefined>;
  nextId?: string;
}

/**
 * A monthly prayer timetable, like the printed ones in a masjid: one row per day with the date and
 * Hijri day, then the six times in columns under a header that stays put. Today is highlighted and
 * its next prayer is in gold; Islamic occasions are marked and listed under the table.
 */
export default function CalendarScreen() {
  const t = useTheme();
  const c = t.c;
  const { location } = useLocation();
  const { calcMethod, asrMadhab, use24Hour } = useSettings();
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? t.spacing.lg : t.spacing.xl;
  useFocusedStatusBar(t.scheme === 'dark' ? 'light' : 'dark');

  const tz = location.timezone;
  const today = localDayAnchor(new Date(), tz);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const [monthOffset, setMonthOffset] = useState(0);
  const first = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12), [todayKey, monthOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<DayRow[]>(() => {
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const now = Date.now();
    return Array.from({ length: days }, (_, i) => {
      // Midday local components for the location's calendar day; adhan reads the components.
      const date = new Date(first.getFullYear(), first.getMonth(), i + 1, 12);
      const pt = getPrayerTimes(location, date, calcMethod, asrMadhab);
      const times = Object.fromEntries(pt.listRows.map((r) => [r.id, r.time as Date]));
      const isToday = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
      const h = hijriParts(date);
      const next = isToday ? COLUMNS.find((col) => (times[col.id]?.getTime() ?? 0) > now)?.id : undefined;
      return {
        date,
        isToday,
        weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hijriDay: h.day,
        hijriMonth: h.month,
        occasion: importantDateFor(date),
        times,
        nextId: next,
      };
    });
  }, [first, location, calcMethod, asrMadhab, todayKey]);

  const monthTitle = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const hijriRange = useMemo(() => {
    const a = hijriParts(rows[0].date);
    const b = hijriParts(rows[rows.length - 1].date);
    return a.month === b.month ? `${a.month} ${a.year}` : a.year === b.year ? `${a.month} to ${b.month} ${b.year}` : `${a.month} ${a.year} to ${b.month} ${b.year}`;
  }, [rows]);
  const occasions = rows.filter((r) => r.occasion);

  // Open on today, a couple of rows down from the top so the days before it show too.
  const scrollRef = useRef<ScrollView>(null);
  const todayY = useRef<number | null>(null);
  const scrollToToday = useCallback((animated: boolean) => {
    if (todayY.current != null) scrollRef.current?.scrollTo({ y: Math.max(0, todayY.current - ROW_H * 2), animated });
  }, []);
  useEffect(() => {
    if (monthOffset !== 0) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [monthOffset]);

  const goMonth = (d: number) => {
    haptic.select();
    todayY.current = null;
    setMonthOffset((m) => m + d);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Title and the one action. */}
      <View style={[styles.titleBar, { paddingTop: insets.top + t.spacing.sm, paddingHorizontal: gutter }]}>
        <Text variant="title1" header maxFontSizeMultiplier={1.3} style={styles.flexShrink}>
          Calendar
        </Text>
        <Button
          label="Today"
          variant="secondary"
          accessibilityHint="Shows this month and scrolls to today"
          onPress={() => {
            haptic.select();
            if (monthOffset !== 0) setMonthOffset(0);
            else scrollToToday(true);
          }}
        />
      </View>

      {/* Month switcher. */}
      <View style={[styles.monthBar, { paddingHorizontal: gutter - 10 }]}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.chevron}>
          <SymbolView name="chevron.left" size={17} tintColor={c.text} />
        </Pressable>
        <View style={styles.monthTitle} accessible accessibilityRole="header" accessibilityLabel={`${monthTitle}, ${hijriRange}`}>
          <Text variant="headline">{monthTitle}</Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {hijriRange}
          </Text>
        </View>
        <Pressable onPress={() => goMonth(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month" style={styles.chevron}>
          <SymbolView name="chevron.right" size={17} tintColor={c.text} />
        </Pressable>
      </View>

      {/* Column header, fixed above the scrolling days. */}
      <View style={[styles.row, styles.headerRow, { paddingHorizontal: gutter, borderBottomColor: c.hairline }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text variant="caption2" color="textSecondary" style={styles.dateCol}>
          Date
        </Text>
        {COLUMNS.map((col) => (
          <Text key={col.id} variant="caption2" color="textSecondary" numberOfLines={1} adjustsFontSizeToFit style={styles.timeCol}>
            {col.label}
          </Text>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: tabBarHeight + t.spacing.xl }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => monthOffset === 0 && scrollToToday(false)}
      >
        {rows.map((r) => {
          const label = `${formatDayHeading(r.date)}, ${r.hijriDay} ${r.hijriMonth}${r.occasion ? `, ${r.occasion}` : ''}. ${COLUMNS.map(
            (col) => `${col.label} ${r.times[col.id] ? formatClock(r.times[col.id]!, use24Hour, tz) : 'unavailable'}`,
          ).join(', ')}`;
          return (
            <View
              key={r.date.getDate()}
              accessible
              accessibilityLabel={r.isToday ? `Today, ${label}` : label}
              onLayout={r.isToday ? (e) => (todayY.current = e.nativeEvent.layout.y) : undefined}
              style={[styles.row, { minHeight: ROW_H, paddingHorizontal: gutter, borderBottomColor: c.hairline }, r.isToday && { backgroundColor: c.surface2 }]}
            >
              <View style={styles.dateCol}>
                <View style={styles.dateLine}>
                  <Text variant={r.isToday ? 'bodyEmph' : 'body'} color={r.isToday ? 'accentText' : 'text'} style={styles.tabular}>
                    {r.date.getDate()}
                  </Text>
                  <Text variant="footnote" color={r.isToday ? 'accentText' : 'textSecondary'}>
                    {r.weekday}
                  </Text>
                  {r.occasion && <View style={[styles.occasionDot, { backgroundColor: c.accent }]} />}
                </View>
                <Text variant="caption2" color="textTertiary" numberOfLines={1}>
                  {r.hijriDay === 1 || r.date.getDate() === 1 ? `${r.hijriDay} ${r.hijriMonth}` : r.hijriDay}
                </Text>
              </View>
              {COLUMNS.map((col) => {
                const time = r.times[col.id];
                const next = col.id === r.nextId;
                return (
                  <Text
                    key={col.id}
                    variant={next ? 'bodyEmph' : 'footnote'}
                    color={next ? 'accentText' : col.id === 'sunrise' ? 'textSecondary' : 'text'}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.timeCol, styles.tabular, next && styles.nextTime]}
                  >
                    {time ? formatClockShort(time, use24Hour, tz) : '--'}
                  </Text>
                );
              })}
            </View>
          );
        })}

        {occasions.length > 0 && (
          <View style={{ paddingHorizontal: gutter, paddingTop: t.spacing.xxl, gap: t.spacing.sm }}>
            <Text variant="footnote" color="textSecondary" header>
              This month
            </Text>
            {occasions.map((r) => (
              <View key={r.date.getDate()} style={styles.occasionRow}>
                <View style={[styles.occasionDot, { backgroundColor: c.accent }]} />
                <Text variant="subhead" style={styles.flexShrink}>
                  {r.occasion}
                </Text>
                <Text variant="subhead" color="textSecondary">
                  {r.date.toLocaleDateString('en-US', { month: 'long' })} {ordinal(r.date.getDate())}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  monthBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { paddingVertical: 8 },
  dateCol: { width: DATE_COL },
  dateLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  timeCol: { flex: 1, textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  nextTime: { fontSize: 13 },
  occasionDot: { width: 6, height: 6, borderRadius: 3, alignSelf: 'center' },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
