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
  TextStyle,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIVACY_URL = 'https://athannow.bbabiker.com/privacy';

import { SafeAreaScrim } from '../components/FloatingControl';
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
  const { colors } = useTheme();
  const settings = useSettings();
  const onboarding = useOnboarding();
  const tabBarHeight = useTabBarHeight();
  const { location } = useLocation();
  useFocusedStatusBar('light');
  const [methodSheetOpen, setMethodSheetOpen] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  // Collapsed by default (per-prayer redesign): six near-identical toggle
  // rows shown at once, right at the top of the screen, was the single
  // biggest contributor to Settings feeling "intimidating" — nothing about
  // the underlying six independent per-prayer settings changed, they're just
  // hidden behind one summary row until a user actually wants to fine-tune.
  const [notifExpanded, setNotifExpanded] = useState(false);

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
  const enabledCount = Object.values(settings.notifications.athanEnabled).filter(Boolean).length;
  const totalPrayerCount = PRAYER_LABELS.length;

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
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No header bar (per the app-wide redesign: no chrome unless a screen
          needs a real control) — just a large scrolling title, like iOS's
          native large-title pattern, so there's still orientation without a
          fixed bar spending permanent vertical space on it. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: tabBarHeight + spacing.md }}
        showsVerticalScrollIndicator={false}
      >
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

        {/* NOTIFICATIONS — collapsed to one summary row by default; expands
            in place to the six per-prayer toggles only when tapped. */}
        <Section title="Notifications" description="Reminders are time sensitive, so they come through even on Focus or silent." colors={colors}>
          <NavRow
            icon="bell"
            label="Prayer notifications"
            value={`${enabledCount} of ${totalPrayerCount} on`}
            chevron={notifExpanded ? 'chevron.up' : 'chevron.down'}
            onPress={() => {
              tap();
              setNotifExpanded((v) => !v);
            }}
            colors={colors}
            last={!notifExpanded}
          />
          {notifExpanded &&
            PRAYER_LABELS.map((p, i) => (
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
          description="A reminder gives you an extra heads-up before each athan."
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

        {/* ABOUT (Reset folded in here, last — see note below) */}
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
          />
          {versionLabel && (
            <RowFrame colors={colors}>
              <SymbolView name="info.circle" size={iconSize.md} tintColor={colors.textSecondary} />
              <Text style={[rowStyles.rowLabel, { color: colors.textPrimary }]}>Version</Text>
              <Text style={[rowStyles.rowValue, { color: colors.textSecondary }]}>{versionLabel}</Text>
            </RowFrame>
          )}
          {/* Reset moved in here (was its own titled/bordered "Data" section)
              per the "less intimidating" redesign — a single destructive
              action doesn't need the same section-level visual weight as
              five other groups of real settings; it's still marked as
              categorically different via the icon badge below, just not via
              an entire section of its own competing for attention. Last
              item in the whole screen, easiest thing to *not* run into by
              accident while scrolling past everything else. */}
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

      {/* Guaranteed opaque backing behind the status bar — same reasoning as
          Calendar's scrim (see FloatingControl.tsx's doc comment). */}
      <SafeAreaScrim color={colors.background} />
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
  description,
  colors,
  children,
}: {
  title: string;
  /** Sits right below the header, above the actual rows, instead of as a
   *  trailing footnote after everything, so you read the explanation before
   *  you hit the controls it's explaining, not after. */
  description?: string;
  colors: Colors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text> : null}
      {description ? <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{description}</Text> : null}
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.separator }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  screenTitle: { ...type.title1, marginBottom: spacing.md, marginLeft: spacing.xs } as TextStyle,
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...type.caption2, marginBottom: spacing.xs, marginLeft: spacing.xs },
  sectionDescription: { ...type.caption, marginBottom: spacing.sm, marginLeft: spacing.xs },
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
