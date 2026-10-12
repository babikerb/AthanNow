import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';

import { useOnboarding } from '../context/OnboardingContext';
import { Appearance, AsrMadhab, PrayerKey, useSettings } from '../context/SettingsContext';
import { BottomSheet } from '../design/BottomSheet';
import { haptic } from '../design/haptics';
import { ListGroup, ListRow, SectionHeader } from '../design/List';
import { ScreenContainer } from '../design/ScreenContainer';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { useTheme as useDesignTheme } from '../design/theme';
import { Toggle } from '../design/Toggle';
import { useLocation } from '../hooks/useLocation';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../utils/calcMethodDefaults';

const PRIVACY_URL = 'https://athannow.bbabiker.com/privacy';

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

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ASR_OPTIONS: { value: AsrMadhab; label: string }[] = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Hanafi', label: 'Hanafi' },
];

/** A label above a full-width segmented control, inside a grouped list. */
function SegmentBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const dt = useDesignTheme();
  return (
    <View style={{ paddingHorizontal: dt.spacing.lg, paddingVertical: dt.spacing.md, gap: dt.spacing.sm }}>
      <Text variant="body">{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const dt = useDesignTheme();
  const settings = useSettings();
  const onboarding = useOnboarding();
  const { location } = useLocation();
  useFocusedStatusBar(dt.scheme === 'dark' ? 'light' : 'dark');
  const [methodSheetOpen, setMethodSheetOpen] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  // Collapsed by default: six near-identical toggles at once felt intimidating. The six independent per-prayer
  // settings are unchanged; they sit behind one summary row until someone wants to fine-tune.
  const [notifExpanded, setNotifExpanded] = useState(false);

  const confirmReset = () => {
    Alert.alert('Reset all data', 'This clears your preferences and onboarding, returning the app to defaults. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          haptic.warning();
          settings.resetAllData();
        },
      },
    ]);
  };

  const methodLabel = CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod;
  const enabledCount = Object.values(settings.notifications.athanEnabled).filter(Boolean).length;

  // "Recommended for your region" + "All methods": same country -> method lookup and "why" copy as onboarding.
  const recommendedCountry = location?.countryCode ?? localeCountryCode();
  const recommendedKey = calcMethodForCountry(recommendedCountry);
  const recommendedMethod = CALC_METHODS.find((m) => m.key === recommendedKey) ?? CALC_METHODS[0];
  const otherMethods = useMemo(
    () => CALC_METHODS.filter((m) => m.key !== recommendedMethod.key).sort((a, b) => a.label.localeCompare(b.label)),
    [recommendedMethod.key],
  );

  const check = <SymbolView name="checkmark" size={16} weight="semibold" tintColor={dt.c.accentText} />;
  const methodRow = (m: (typeof CALC_METHODS)[number]) => (
    <ListRow
      key={m.key}
      title={m.label}
      subtitle={CALC_METHOD_WHY[m.key]}
      accessory={m.key === settings.calcMethod ? check : undefined}
      selected={m.key === settings.calcMethod}
      onPress={() => {
        settings.update({ calcMethod: m.key });
        setMethodSheetOpen(false);
      }}
    />
  );

  // App version / build number. `Constants.expoConfig` mirrors app.json's `version`.
  const appVersion = Constants.expoConfig?.version;
  const buildNumber = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = appVersion ? (buildNumber ? `${appVersion} (${buildNumber})` : String(appVersion)) : null;

  return (
    <>
      <ScreenContainer title="Settings">
        <SectionHeader title="Appearance" />
        <ListGroup footer="Home and Qibla always show the night sky. Appearance changes everything else.">
          <SegmentBlock title="Theme">
            <SegmentedControl options={APPEARANCE_OPTIONS} value={settings.appearance} onChange={(v) => settings.update({ appearance: v })} />
          </SegmentBlock>
        </ListGroup>

        <SectionHeader title="Time" />
        <ListGroup>
          <ListRow
            icon="clock"
            title="24-hour time"
            accessory={<Toggle label="24-hour time" value={settings.use24Hour} onValueChange={(v) => settings.update({ use24Hour: v })} />}
          />
        </ListGroup>

        <SectionHeader title="Prayer calculation" />
        <ListGroup>
          <ListRow icon="globe" title="Calculation method" value={methodLabel} onPress={() => setMethodSheetOpen(true)} />
          <SegmentBlock title="Asr method">
            <SegmentedControl options={ASR_OPTIONS} value={settings.asrMadhab} onChange={(v) => settings.update({ asrMadhab: v })} />
          </SegmentBlock>
        </ListGroup>

        <SectionHeader title="Notifications" />
        <ListGroup footer="Reminders are time sensitive, so they come through even on Focus or silent.">
          <ListRow
            icon="bell"
            title="Prayer notifications"
            value={`${enabledCount} of ${PRAYER_LABELS.length} on`} // read by VoiceOver; the visible copy is in the accessory
            accessory={
              <>
                <Text variant="body" color="textSecondary">{`${enabledCount} of ${PRAYER_LABELS.length} on`}</Text>
                <SymbolView name={notifExpanded ? 'chevron.up' : 'chevron.down'} size={13} weight="semibold" tintColor={dt.c.glyphQuiet} />
              </>
            }
            expanded={notifExpanded}
            onPress={() => setNotifExpanded((v) => !v)}
            accessibilityHint={notifExpanded ? 'Collapses the prayer list' : 'Shows a switch for each prayer'}
          />
          {notifExpanded &&
            PRAYER_LABELS.map((p) => (
              <ListRow
                key={p.key}
                icon={p.key === 'sunrise' ? 'sunrise' : 'bell'}
                title={p.key === 'sunrise' ? 'Sunrise' : `${p.label} athan`}
                accessory={
                  <Toggle
                    label={p.key === 'sunrise' ? 'Sunrise' : `${p.label} athan`}
                    value={settings.notifications.athanEnabled[p.key]}
                    onValueChange={(v) => settings.updateNotifications({ athanEnabled: { ...settings.notifications.athanEnabled, [p.key]: v } })}
                  />
                }
              />
            ))}
        </ListGroup>

        <SectionHeader title="Reminders" />
        <ListGroup footer="A reminder gives you an extra heads-up before each athan.">
          <ListRow icon="timer" title="Reminder time" value={minutesLabel(settings.notifications.reminderMinutesBefore)} onPress={() => setReminderSheetOpen(true)} />
          <ListRow
            icon="speaker.wave.2"
            title="Play adhan sound"
            accessory={<Toggle label="Play adhan sound" value={settings.notifications.athanSound} onValueChange={(v) => settings.updateNotifications({ athanSound: v })} />}
          />
          <ListRow
            icon="sunrise"
            title="Morning Quran reminder"
            accessory={
              <Toggle label="Morning Quran reminder" value={settings.notifications.quranMorningEnabled} onValueChange={(v) => settings.updateNotifications({ quranMorningEnabled: v })} />
            }
          />
        </ListGroup>

        <SectionHeader title="About" />
        <ListGroup>
          <ListRow icon="hand.raised" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
          <ListRow icon="arrow.clockwise" title="Replay onboarding" onPress={() => onboarding.start('replay')} />
          {versionLabel ? <ListRow icon="info.circle" title="Version" value={versionLabel} /> : null}
          <ListRow icon="trash" title="Reset all data" destructive onPress={confirmReset} />
        </ListGroup>
      </ScreenContainer>

      <BottomSheet visible={methodSheetOpen} onClose={() => setMethodSheetOpen(false)} title="Calculation method" detents={[0.7, 0.92]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingBottom: dt.spacing.xxl }}>
          <SectionHeader title="Recommended for your region" />
          <ListGroup>{methodRow(recommendedMethod)}</ListGroup>
          <SectionHeader title="All methods" />
          <ListGroup>{otherMethods.map(methodRow)}</ListGroup>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={reminderSheetOpen} onClose={() => setReminderSheetOpen(false)} title="Reminder time" detents={[0.6]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingBottom: dt.spacing.xxl }}>
          <ListGroup>
            {MINUTE_OPTIONS.map((m) => (
              <ListRow
                key={m}
                title={minutesLabel(m)}
                accessory={m === settings.notifications.reminderMinutesBefore ? check : undefined}
                selected={m === settings.notifications.reminderMinutesBefore}
                onPress={() => {
                  settings.updateNotifications({ reminderMinutesBefore: m });
                  setReminderSheetOpen(false);
                }}
              />
            ))}
          </ListGroup>
        </ScrollView>
      </BottomSheet>
    </>
  );
}
