import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, View } from 'react-native';

import { QURAN_ENABLED } from '../config/features';
import { useOnboarding } from '../context/OnboardingContext';
import { Appearance, AsrMadhab, PrayerKey, useSettings } from '../context/SettingsContext';
import { LocationSheet } from '../components/LocationSheet';
import { Sheet } from '../components/Sheet';
import { haptic } from '../design/haptics';
import { ListGroup, ListRow, SectionHeader } from '../design/List';
import { ScreenContainer } from '../design/ScreenContainer';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { useTheme as useDesignTheme } from '../design/theme';
import { Toggle } from '../design/Toggle';
import { useLocation } from '../context/LocationContext';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../utils/calcMethodDefaults';
import {
  getNotificationPermissionState,
  getScheduledSummary,
  requestNotificationPermissionState,
  rescheduleNotifications,
  type ScheduledSummary,
} from '../utils/notifications';
import { downloadAllPages, isOfflineDownloaded } from '../utils/mushafCache';
import { classifyPermission, type PermissionUIState } from '../utils/permissionState';

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

/**
 * Notification status: the toggles below can all read "on" while iOS has notifications blocked, in which case nothing
 * fires. This row says so, offers the recovery (ask, or open iOS Settings), and states how far ahead reminders are
 * actually scheduled. Read-only: it never changes what gets scheduled.
 */
function NotificationStatus() {
  const settings = useSettings();
  const { location } = useLocation();
  const [perm, setPerm] = useState<PermissionUIState>('checking');
  const [summary, setSummary] = useState<ScheduledSummary | null>(null);
  const prev = useRef<PermissionUIState>('checking');

  const refresh = useCallback(async () => {
    try {
      const p = await getNotificationPermissionState();
      const next = classifyPermission(p.status, p.canAskAgain);
      setPerm(next);
      setSummary(next === 'granted' ? await getScheduledSummary() : null);
    } catch {
      // Keep the last known state: an error must not turn into a false 'off'.
    }
  }, []);

  useEffect(() => {
    refresh();
    // The scheduler books ~60 notifications asynchronously after a change; look again once it has had time to finish.
    const later = setTimeout(refresh, 2500);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearTimeout(later);
      sub.remove();
    };
  }, [refresh, settings.notifications]);

  // Permission just became granted (from here or from iOS Settings): book the schedule now instead of waiting for the next
  // settings/location change, which is when the scheduler would otherwise notice.
  useEffect(() => {
    const was = prev.current;
    prev.current = perm;
    const anyOn = Object.values(settings.notifications.athanEnabled).some(Boolean) || (QURAN_ENABLED && settings.notifications.quranMorningEnabled);
    if (perm === 'granted' && was !== 'granted' && was !== 'checking' && anyOn && location) {
      rescheduleNotifications(location, settings).then(refresh).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perm]);

  if (perm === 'checking') return <ListRow icon="bell" title="Checking notifications" />;

  if (perm === 'granted') {
    const anyOn = Object.values(settings.notifications.athanEnabled).some(Boolean) || (QURAN_ENABLED && settings.notifications.quranMorningEnabled);
    const detail = !anyOn
      ? 'Every prayer is switched off.'
      : summary && summary.count > 0
        ? `${summary.count} scheduled. Refreshed each time you open the app.`
        : 'Scheduling your reminders.';
    return <ListRow icon="bell.badge" title="Notifications are on" subtitle={detail} />;
  }
  if (perm === 'denied-permanent') {
    return (
      <ListRow
        icon="bell.slash"
        title="Notifications are blocked"
        subtitle="Nothing will sound until you allow them in iOS Settings."
        value="Open Settings"
        onPress={() => Linking.openSettings().catch(() => {})}
        accessibilityHint="Opens the iOS Settings app"
      />
    );
  }
  return (
    <ListRow
      icon="bell.slash"
      title="Notifications are off"
      subtitle="Allow them to hear the athan at each prayer."
      value="Allow"
      accessibilityHint="Shows the iOS permission prompt"
      onPress={async () => {
        const p = await requestNotificationPermissionState().catch(() => null);
        if (p) setPerm(classifyPermission(p.status, p.canAskAgain));
      }}
    />
  );
}

/** Download every mushaf page so the reader works with no connection (about 60 MB). */
function OfflineQuranRow() {
  const [state, setState] = useState<'unknown' | 'none' | 'done' | 'failed' | { done: number; total: number }>('unknown');
  const cancel = useRef({ cancelled: false });
  useEffect(() => {
    isOfflineDownloaded().then((d) => setState(d ? 'done' : 'none'));
    return () => {
      cancel.current.cancelled = true;
    };
  }, []);
  const start = async () => {
    haptic.light();
    cancel.current = { cancelled: false };
    setState({ done: 0, total: 604 });
    const ok = await downloadAllPages((done, total) => setState({ done, total }), cancel.current);
    if (!cancel.current.cancelled) {
      if (ok) haptic.success();
      setState(ok ? 'done' : 'failed');
    }
  };
  const footer = 'About 60 MB. Pages you open are kept for offline reading either way.';
  if (typeof state === 'object') {
    return (
      <ListGroup footer={footer}>
        <ListRow title="Downloading pages" value={`${Math.round((state.done / state.total) * 100)}%`} />
      </ListGroup>
    );
  }
  return (
    <ListGroup footer={footer}>
      {state === 'done' ? (
        <ListRow title="All pages downloaded" />
      ) : (
        <ListRow
          title={state === 'failed' ? 'Some pages didn’t download' : 'Download all pages'}
          value={state === 'failed' ? 'Try again' : undefined}
          onPress={state === 'unknown' ? undefined : start}
        />
      )}
    </ListGroup>
  );
}

export default function SettingsScreen() {
  const dt = useDesignTheme();
  const settings = useSettings();
  const onboarding = useOnboarding();
  const { location, cityName } = useLocation();
  useFocusedStatusBar(dt.scheme === 'dark' ? 'light' : 'dark');
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
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
        <SectionHeader title="Location" />
        <ListGroup footer={location?.isManual ? 'Chosen by you.' : 'Follows where you are.'}>
          <ListRow title="City" value={cityName} onPress={() => setLocationSheetOpen(true)} />
        </ListGroup>

        <SectionHeader title="Appearance" />
        <ListGroup footer="Home and Qibla always show the night sky. Appearance changes everything else.">
          <SegmentBlock title="Theme">
            <SegmentedControl options={APPEARANCE_OPTIONS} value={settings.appearance} onChange={(v) => settings.update({ appearance: v })} />
          </SegmentBlock>
        </ListGroup>

        <SectionHeader title="Time" />
        <ListGroup>
          <ListRow
            title="24-hour time"
            accessory={<Toggle label="24-hour time" value={settings.use24Hour} onValueChange={(v) => settings.update({ use24Hour: v })} />}
          />
        </ListGroup>

        <SectionHeader title="Prayer calculation" />
        <ListGroup>
          <ListRow title="Calculation method" value={methodLabel} onPress={() => setMethodSheetOpen(true)} />
          <SegmentBlock title="Asr method">
            <SegmentedControl options={ASR_OPTIONS} value={settings.asrMadhab} onChange={(v) => settings.update({ asrMadhab: v })} />
          </SegmentBlock>
        </ListGroup>

        <SectionHeader title="Notifications" />
        <ListGroup footer="Time sensitive, so they can break through Focus when you allow it.">
          <NotificationStatus />
          <ListRow
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
          <ListRow title="Reminder time" value={minutesLabel(settings.notifications.reminderMinutesBefore)} onPress={() => setReminderSheetOpen(true)} />
          <ListRow
            title="Play adhan sound"
            accessory={<Toggle label="Play adhan sound" value={settings.notifications.athanSound} onValueChange={(v) => settings.updateNotifications({ athanSound: v })} />}
          />
          {QURAN_ENABLED && (
            <ListRow
              title="Morning Quran reminder"
              accessory={
                <Toggle label="Morning Quran reminder" value={settings.notifications.quranMorningEnabled} onValueChange={(v) => settings.updateNotifications({ quranMorningEnabled: v })} />
              }
            />
          )}
        </ListGroup>

        {QURAN_ENABLED && (
          <>
            <SectionHeader title="Quran" />
            <OfflineQuranRow />
          </>
        )}

        <SectionHeader title="About" />
        <ListGroup>
          <ListRow title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
          <ListRow title="Replay onboarding" onPress={() => onboarding.start('replay')} />
          {versionLabel ? <ListRow title="Version" value={versionLabel} /> : null}
          <ListRow title="Reset all data" destructive onPress={confirmReset} />
        </ListGroup>
      </ScreenContainer>

      <LocationSheet visible={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />

      <Sheet visible={methodSheetOpen} onClose={() => setMethodSheetOpen(false)} title="Calculation method">
        <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingBottom: dt.spacing.xxl }}>
          <SectionHeader title="Recommended for your region" />
          <ListGroup>{methodRow(recommendedMethod)}</ListGroup>
          <SectionHeader title="All methods" />
          <ListGroup>{otherMethods.map(methodRow)}</ListGroup>
        </ScrollView>
      </Sheet>

      <Sheet visible={reminderSheetOpen} onClose={() => setReminderSheetOpen(false)} title="Reminder time">
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
      </Sheet>
    </>
  );
}
