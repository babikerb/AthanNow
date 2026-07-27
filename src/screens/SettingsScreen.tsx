import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PRIVACY_URL = 'https://athannow.bbabiker.com/privacy';

import { GlassPill, HeaderBar, HeaderSpacer, HeaderTitle } from '../components/AppHeader';
import { Sheet } from '../components/Sheet';
import { NavRow, RowFrame, SegmentRow, styles as rowStyles, ToggleRow } from '../components/settings/SettingsRows';
import { useOnboarding } from '../context/OnboardingContext';
import {
  AsrMadhab,
  PrayerKey,
  useSettings,
} from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { ACCENT, ERROR } from '../theme/colors';
import { iconSize } from '../theme/icons';
import { PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../utils/calcMethodDefaults';
import { DAYS_AHEAD, MAX_PENDING } from '../utils/notifications';

// Same alpha steps as `ACCENT_SOFT`/`ACCENT_BORDER` (theme/colors.ts), applied
// to the `ERROR` token for the destructive row's icon badge (plan §3.7,
// mirrors LocationSheet's icon-badge pattern in the "this is dangerous"
// register instead of the "this is the current place" register).
const ERROR_SOFT = 'rgba(229, 72, 77, 0.16)';
const ERROR_BORDER = 'rgba(229, 72, 77, 0.35)';

const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30];

function minutesLabel(m: number): string {
  return m === 0 ? 'Off' : `${m} min before`;
}

const PRAYER_LABELS: { key: PrayerKey; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

export default function SettingsScreen() {
  const { colors, scheme } = useTheme();
  const settings = useSettings();
  const onboarding = useOnboarding();
  const tabBarHeight = useTabBarHeight();
  const { location } = useLocation();
  useFocusedStatusBar(scheme === 'dark' ? 'light' : 'dark');
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

  // "Recommended for your region" + "All methods" grouping (plan §3.7) —
  // reuses the same country -> method lookup and "why" copy the onboarding
  // calc-method screen already built (`calcMethodDefaults.ts`), so Settings
  // doesn't invent a second explanation for the same 12 methods.
  const recommendedCountry = location?.countryCode ?? localeCountryCode();
  const recommendedKey = calcMethodForCountry(recommendedCountry);
  const recommendedMethod = CALC_METHODS.find((m) => m.key === recommendedKey) ?? CALC_METHODS[0];
  const otherMethods = useMemo(
    () => CALC_METHODS.filter((m) => m.key !== recommendedMethod.key).sort((a, b) => a.label.localeCompare(b.label)),
    [recommendedMethod.key],
  );

  const renderMethodOption = (m: (typeof CALC_METHODS)[number]) => {
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
          { borderBottomColor: colors.separator, opacity: pressed ? PRESSED_OPACITY : 1 },
        ]}
      >
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{m.label}</Text>
          <Text style={[styles.optionWhy, { color: colors.textSecondary }]}>{CALC_METHOD_WHY[m.key]}</Text>
        </View>
        {selected && <SymbolView name="checkmark" size={18} tintColor={ACCENT} />}
      </Pressable>
    );
  };

  // App version / build number (plan §3.7) — `Constants.expoConfig` mirrors
  // app.json's `version`; native version/build fields were removed from
  // expo-constants in favor of expo-application, so this stays undefined
  // gracefully (no crash, row just omits the missing piece) rather than
  // requiring a new dependency.
  const appVersion = Constants.expoConfig?.version;
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode;
  const versionLabel = appVersion ? (buildNumber ? `${appVersion} (${buildNumber})` : String(appVersion)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar>
        <HeaderSpacer />
        <GlassPill flex scheme={scheme}>
          <HeaderTitle title="Settings" color={colors.textPrimary} subColor={colors.textSecondary} />
        </GlassPill>
        <HeaderSpacer />
      </HeaderBar>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: tabBarHeight + 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
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
              icon={p.key === 'sunrise' ? 'sunrise' : 'bell'}
              label={p.key === 'sunrise' ? 'Sunrise' : `${p.label} athan`}
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

        <Section
          title="Reminders"
          footer={`Each enabled prayer rings at athan time. A reminder adds an extra heads-up that many minutes before. Notifications are scheduled ${DAYS_AHEAD} days ahead each time you open the app — if every prayer and reminder is on, the schedule can approach iOS's ${MAX_PENDING}-notification limit, so the farthest-out days in that window may not get scheduled until the next refresh.`}
          colors={colors}
        >
          <NavRow
            icon="timer"
            label="Reminder time"
            value={minutesLabel(settings.notifications.reminderMinutesBefore)}
            dimmed={settings.notifications.reminderMinutesBefore === 0}
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

        {/* DATA */}
        <Section title="Data" colors={colors}>
          {/* Destructive row reads as categorically different, not just a
              different color (plan §2.5/§3.7) — the icon sits in a tinted
              circular badge, the same "icon badge" pattern LocationSheet uses
              for its hero card, but in the ERROR register instead of ACCENT. */}
          <Pressable
            onPress={confirmReset}
            accessibilityRole="button"
            style={({ pressed }) => [rowStyles.row, { opacity: pressed ? PRESSED_OPACITY : 1 }]}
          >
            <View style={[styles.destructiveBadge, { backgroundColor: ERROR_SOFT, borderColor: ERROR_BORDER }]}>
              <SymbolView name="trash" size={iconSize.sm} tintColor={ERROR} />
            </View>
            <Text style={[rowStyles.rowLabel, { color: ERROR }]}>Reset all data</Text>
          </Pressable>
        </Section>

        {/* ABOUT */}
        <Section title="About" colors={colors}>
          <NavRow
            icon="hand.raised"
            label="Privacy Policy"
            value=""
            onPress={() => {
              tap();
              Linking.openURL(PRIVACY_URL).catch(() => {});
            }}
            colors={colors}
          />
          {/* Replaces "Reset all data" as the only way to re-see onboarding —
              Reset stays for its actual purpose (wiping data), decoupled
              from replaying the walkthrough. The merged onboarding flow
              (`OnboardingOverlay`, always mounted inside `MainTabs`) is a
              single entry point now, so this is a single row too — it used
              to be two ("Show product tour again" for the coach-mark pass,
              "Replay welcome tour" for the six-screen flow) because those
              were genuinely two separate systems; now `start('replay')`
              re-activates the one combined experience end to end. */}
          <NavRow
            icon="arrow.clockwise"
            label="Replay onboarding"
            value=""
            onPress={() => {
              tap();
              onboarding.start('replay');
            }}
            colors={colors}
            last={!versionLabel}
          />
          {versionLabel && (
            <RowFrame last colors={colors}>
              <SymbolView name="info.circle" size={iconSize.md} tintColor={colors.textSecondary} />
              <Text style={[rowStyles.rowLabel, { color: colors.textPrimary }]}>Version</Text>
              <Text style={[rowStyles.rowValue, { color: colors.textSecondary }]}>{versionLabel}</Text>
            </RowFrame>
          )}
        </Section>

        <View style={{ height: 40 }} />
      </View>

      {/* Calculation method picker sheet — grouped into "Recommended for your
          region" (computed from the location the app already has, falling
          back to device locale) + "All methods" alphabetically, each with
          the same one-line "why" copy the onboarding calc-method screen uses
          (plan §3.7, reuses `calcMethodDefaults.ts` rather than re-writing
          the explanations here). */}
      <Sheet visible={methodSheetOpen} onClose={() => setMethodSheetOpen(false)} title="Calculation method">
        <ScrollView>
          <Text style={[styles.pickerSectionTitle, { color: colors.textSecondary }]}>RECOMMENDED FOR YOUR REGION</Text>
          {renderMethodOption(recommendedMethod)}

          <Text style={[styles.pickerSectionTitle, { color: colors.textSecondary }]}>ALL METHODS</Text>
          {otherMethods.map(renderMethodOption)}
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
                style={({ pressed }) => [styles.optionRow, { borderBottomColor: colors.separator, opacity: pressed ? PRESSED_OPACITY : 1 }]}
              >
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{minutesLabel(m)}</Text>
                {selected && <SymbolView name="checkmark" size={18} tintColor={ACCENT} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
      </ScrollView>
    </View>
  );
}

/* ---------- Section wrapper ---------- */
/* RowFrame/ToggleRow/NavRow/SegmentRow moved to
   `src/components/settings/SettingsRows.tsx` (plan §3.7) — mechanical
   extraction, behavior unchanged, so they're reusable outside Settings. */

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
      {footer ? <Text style={[styles.sectionFooter, { color: colors.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...type.caption2, marginBottom: spacing.xs, marginLeft: spacing.xs },
  sectionFooter: { ...type.caption, marginTop: spacing.xs, marginLeft: spacing.xs },
  group: { borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flex: 1, marginRight: spacing.sm },
  optionLabel: { ...type.body },
  optionWhy: { ...type.footnote, marginTop: 2 },
  pickerSectionTitle: { ...type.caption2, marginTop: spacing.md, marginBottom: spacing.xs, marginLeft: spacing.lg },
  destructiveBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
