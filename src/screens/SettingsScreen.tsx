import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Sheet } from '../components/Sheet';
import {
  AsrMadhab,
  CalcMethod,
  PrayerKey,
  useSettings,
} from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { ACCENT } from '../theme/colors';

const CALC_METHODS: { key: CalcMethod; label: string }[] = [
  { key: 'NorthAmerica', label: 'ISNA (North America)' },
  { key: 'MuslimWorldLeague', label: 'Muslim World League' },
  { key: 'Egyptian', label: 'Egyptian General Authority' },
  { key: 'Karachi', label: 'University of Karachi' },
  { key: 'UmmAlQura', label: 'Umm al-Qura (Makkah)' },
  { key: 'Dubai', label: 'Dubai' },
  { key: 'Qatar', label: 'Qatar' },
  { key: 'Kuwait', label: 'Kuwait' },
  { key: 'Singapore', label: 'Singapore' },
  { key: 'Turkey', label: 'Turkey (Diyanet)' },
  { key: 'Tehran', label: 'Tehran' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
];

const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30];

function minutesLabel(m: number): string {
  return m === 0 ? 'At athan' : `${m} min before`;
}

const PRAYER_LABELS: { key: PrayerKey; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useSettings();
  const [methodSheetOpen, setMethodSheetOpen] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);

  const tap = () => Haptics.selectionAsync();

  const confirmReset = () => {
    Alert.alert(
      'Reset all data',
      'This clears your preferences and onboarding, returning the app to defaults. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            settings.resetAllData();
          },
        },
      ],
    );
  };

  const methodLabel = CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Settings</Text>

        {/* TIME & APPEARANCE */}
        <Section title="Time" colors={colors}>
          <ToggleRow
            icon="clock"
            label="24-hour time"
            value={settings.use24Hour}
            onValueChange={(v) => settings.update({ use24Hour: v })}
            colors={colors}
          />
        </Section>

        {/* PRAYER CALCULATION */}
        <Section title="Prayer calculation" colors={colors}>
          <NavRow
            icon="globe"
            label="Calculation method"
            value={methodLabel}
            onPress={() => {
              tap();
              setMethodSheetOpen(true);
            }}
            colors={colors}
          />
          <SegmentRow
            icon="sun.haze"
            label="Asr method"
            options={[
              { key: 'Standard', label: 'Standard' },
              { key: 'Hanafi', label: 'Hanafi' },
            ]}
            value={settings.asrMadhab}
            onChange={(v) => settings.update({ asrMadhab: v as AsrMadhab })}
            colors={colors}
            last
          />
        </Section>

        {/* NOTIFICATIONS */}
        <Section title="Notifications" footer="Reminders are time sensitive, so they come through even on Focus or silent." colors={colors}>
          {PRAYER_LABELS.map((p, i) => (
            <ToggleRow
              key={p.key}
              icon="bell"
              label={`${p.label} athan`}
              value={settings.notifications.athanEnabled[p.key]}
              onValueChange={(v) =>
                settings.updateNotifications({
                  athanEnabled: { ...settings.notifications.athanEnabled, [p.key]: v },
                })
              }
              colors={colors}
              last={i === PRAYER_LABELS.length - 1}
            />
          ))}
        </Section>

        <Section title="" colors={colors}>
          <NavRow
            icon="timer"
            label="Reminder time"
            value={minutesLabel(settings.notifications.reminderMinutesBefore)}
            onPress={() => {
              tap();
              setReminderSheetOpen(true);
            }}
            colors={colors}
          />
          <ToggleRow
            icon="speaker.wave.2"
            label="Play adhan sound"
            value={settings.notifications.athanSound}
            onValueChange={(v) => settings.updateNotifications({ athanSound: v })}
            colors={colors}
          />
          <ToggleRow
            icon="sunrise"
            label="Morning Quran reminder"
            value={settings.notifications.quranMorningEnabled}
            onValueChange={(v) => settings.updateNotifications({ quranMorningEnabled: v })}
            colors={colors}
            last
          />
        </Section>

        {/* QURAN */}
        <Section title="Quran" colors={colors}>
          <SegmentRow
            icon="arrow.left.arrow.right"
            label="Scroll direction"
            options={[
              { key: 'horizontal', label: 'Pages' },
              { key: 'vertical', label: 'Scroll' },
            ]}
            value={settings.quranScrollDirection}
            onChange={(v) => settings.update({ quranScrollDirection: v as 'horizontal' | 'vertical' })}
            colors={colors}
            last
          />
        </Section>

        {/* DATA */}
        <Section title="Data" colors={colors}>
          <Pressable onPress={confirmReset} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <SymbolView name="trash" size={20} tintColor="#E5484D" />
            <Text style={[styles.rowLabel, { color: '#E5484D' }]}>Reset all data</Text>
          </Pressable>
        </Section>

        <View style={{ height: 40 }} />
      </View>

      {/* Calculation method picker sheet */}
      <Sheet visible={methodSheetOpen} onClose={() => setMethodSheetOpen(false)} title="Calculation method">
        <ScrollView>
          {CALC_METHODS.map((m) => {
            const selected = m.key === settings.calcMethod;
            return (
              <Pressable
                key={m.key}
                onPress={() => {
                  tap();
                  settings.update({ calcMethod: m.key });
                  setMethodSheetOpen(false);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{m.label}</Text>
                {selected && <SymbolView name="checkmark" size={18} tintColor={ACCENT} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>

      {/* Reminder-time picker sheet */}
      <Sheet visible={reminderSheetOpen} onClose={() => setReminderSheetOpen(false)} title="Reminder time">
        <ScrollView>
          {MINUTE_OPTIONS.map((m) => {
            const selected = m === settings.notifications.reminderMinutesBefore;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  tap();
                  settings.updateNotifications({ reminderMinutesBefore: m });
                  setReminderSheetOpen(false);
                }}
                style={({ pressed }) => [styles.optionRow, { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{minutesLabel(m)}</Text>
                {selected && <SymbolView name="checkmark" size={18} tintColor={ACCENT} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </ScrollView>
  );
}

/* ---------- Reusable rows ---------- */

type Colors = ReturnType<typeof useTheme>['colors'];

function Section({
  title,
  footer,
  colors,
  children,
}: {
  title: string;
  footer?: string;
  colors: Colors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text> : null}
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.separator }]}>{children}</View>
      {footer ? <Text style={[styles.sectionFooter, { color: colors.textTertiary }]}>{footer}</Text> : null}
    </View>
  );
}

function RowFrame({ last, colors, children }: { last?: boolean; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}>
      {children}
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  colors,
  last,
}: {
  icon: SFSymbol;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <RowFrame last={last} colors={colors}>
      <SymbolView name={icon} size={20} tintColor={colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: ACCENT }} />
    </RowFrame>
  );
}

function NavRow({
  icon,
  label,
  value,
  onPress,
  colors,
  last,
}: {
  icon: SFSymbol;
  label: string;
  value: string;
  onPress: () => void;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <RowFrame last={last} colors={colors}>
        <SymbolView name={icon} size={20} tintColor={colors.textSecondary} />
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.textTertiary }]} numberOfLines={1}>
          {value}
        </Text>
        <SymbolView name="chevron.right" size={14} tintColor={colors.textTertiary} />
      </RowFrame>
    </Pressable>
  );
}

function SegmentRow({
  icon,
  label,
  options,
  value,
  onChange,
  colors,
  last,
}: {
  icon: SFSymbol;
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <RowFrame last={last} colors={colors}>
      <SymbolView name={icon} size={20} tintColor={colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <View style={[styles.segment, { backgroundColor: colors.background }]}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(o.key);
              }}
              style={[styles.segmentItem, active && { backgroundColor: ACCENT }]}
            >
              <Text style={[styles.segmentText, { color: active ? '#FFF' : colors.textSecondary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </RowFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  screenTitle: { fontSize: 34, fontWeight: '800', marginVertical: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginLeft: 8 },
  sectionFooter: { fontSize: 12, marginTop: 8, marginLeft: 8, lineHeight: 16 },
  group: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 50 },
  rowLabel: { fontSize: 16, flex: 1 },
  rowValue: { fontSize: 15, maxWidth: 150, textAlign: 'right' },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  segmentText: { fontSize: 13, fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { fontSize: 16 },
});
