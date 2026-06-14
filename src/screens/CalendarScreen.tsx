import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React, { useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { GlassCircleButton, GlassPill, HeaderBar, HeaderSpacer, HeaderTitle } from '../components/AppHeader';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { AppLocation, useLocation } from '../hooks/useLocation';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { ACCENT, ACCENT_SOFT, Palette } from '../theme/colors';
import { getHijriDate, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';

// A window of days around today the user can scroll through.
const RANGE = 400;
const TODAY_INDEX = RANGE;
const DAYS = Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE); // offsets from today

const CARD_H = 330;
const GAP = 14;
const ITEM_H = CARD_H + GAP;

const PRAYER_META: { id: string; icon: SFSymbol }[] = [
  { id: 'fajr', icon: 'sunrise.fill' },
  { id: 'dhuhr', icon: 'sun.max.fill' },
  { id: 'asr', icon: 'sun.min.fill' },
  { id: 'maghrib', icon: 'sunset.fill' },
  { id: 'isha', icon: 'moon.stars.fill' },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DayCardProps {
  offset: number;
  location: AppLocation;
  calcMethod: string;
  asrMadhab: string;
  use24Hour: boolean;
  tz?: string;
  colors: Palette;
}

const DayCard = React.memo(function DayCard({ offset, location, calcMethod, asrMadhab, use24Hour, tz, colors }: DayCardProps) {
  const data = useMemo(() => {
    const base = startOfToday();
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0);
    const pt = getPrayerTimes(location, localDayAnchor(date, tz), calcMethod, asrMadhab);
    const byId = Object.fromEntries(pt.listRows.map((r) => [r.id, r]));
    return {
      date,
      isToday: offset === 0,
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      label: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      hijri: getHijriDate(date),
      // Only meaningful for today: which prayer is next right now.
      nextId: offset === 0 ? pt.nextPrayer?.toLowerCase?.() ?? pt.currentPrayer : undefined,
      rows: PRAYER_META.map((m) => ({ ...m, label: byId[m.id]?.label ?? m.id, time: byId[m.id]?.time as Date })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, location.latitude, location.longitude, tz, calcMethod, asrMadhab]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: data.isToday ? ACCENT : colors.separator,
          borderWidth: data.isToday ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weekday, { color: data.isToday ? ACCENT : colors.textSecondary }]}>{data.weekday}</Text>
          <Text style={[styles.dateLabel, { color: colors.textPrimary }]}>{data.label}</Text>
          <Text style={[styles.hijri, { color: colors.textTertiary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {data.hijri}
          </Text>
        </View>
        {data.isToday && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>TODAY</Text>
          </View>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.separator }]} />

      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {data.rows.map((r) => {
          const active = r.id === data.nextId;
          const tint = active ? ACCENT : colors.textSecondary;
          return (
            <View key={r.id} style={[styles.row, active && { backgroundColor: ACCENT_SOFT, borderRadius: 10 }]}>
              <SymbolView name={r.icon} size={17} tintColor={tint} />
              <Text style={[styles.rowName, { color: active ? ACCENT : colors.textPrimary, fontWeight: active ? '700' : '500' }]}>
                {r.label}
              </Text>
              <Text style={[styles.rowTime, { color: active ? ACCENT : colors.textPrimary, fontWeight: active ? '700' : '600' }]}>
                {r.time ? formatClock(r.time, use24Hour, tz) : '—'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default function CalendarScreen() {
  const { colors, scheme } = useTheme();
  const { location } = useLocation();
  const { calcMethod, asrMadhab, use24Hour } = useSettings();
  const tabBarHeight = useTabBarHeight();
  useFocusedStatusBar(scheme === 'dark' ? 'light' : 'dark');
  const tz = location?.timezone;
  const listRef = useRef<FlatList<number>>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar>
        <HeaderSpacer />
        <GlassPill flex scheme={scheme}>
          <HeaderTitle title="Calendar" color={colors.textPrimary} subColor={colors.textSecondary} />
        </GlassPill>
        <GlassCircleButton
          icon="arrow.uturn.backward"
          scheme={scheme}
          tintColor={colors.textPrimary}
          onPress={() => {
            Haptics.selectionAsync();
            listRef.current?.scrollToIndex({ index: TODAY_INDEX, animated: true });
          }}
        />
      </HeaderBar>

      {!location ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Set your location to see the prayer schedule.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={DAYS}
          keyExtractor={(o) => String(o)}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={TODAY_INDEX}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 0);
          }}
          // Snap one day at a time; today opens at the top, scroll up = past, down = future.
          snapToInterval={ITEM_H}
          snapToAlignment="start"
          decelerationRate="fast"
          windowSize={5}
          maxToRenderPerBatch={4}
          initialNumToRender={4}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarHeight + 24 }}
          renderItem={({ item }) => (
            <View style={{ height: ITEM_H, paddingBottom: GAP }}>
              <DayCard
                offset={item}
                location={location}
                calcMethod={calcMethod}
                asrMadhab={asrMadhab}
                use24Hour={use24Hour}
                tz={tz}
                colors={colors}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  card: { flex: 1, borderRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  weekday: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  dateLabel: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  todayBadge: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginTop: 2 },
  todayBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  hijri: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 7 },
  rowName: { flex: 1, fontSize: 16, letterSpacing: 0.2 },
  rowTime: { fontSize: 16, fontVariant: ['tabular-nums'] },
});
