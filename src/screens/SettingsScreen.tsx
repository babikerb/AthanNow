import Constants from 'expo-constants';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { QURAN_ENABLED } from '../config/features';
import { useOnboarding } from '../context/OnboardingContext';
import { Appearance, AsrMadhab, PrayerKey, useSettings } from '../context/SettingsContext';
import { LocationSheet } from '../components/LocationSheet';
import { Sheet } from '../components/Sheet';
import { haptic } from '../design/haptics';
import { ListGroup, ListRow, SectionHeader } from '../design/List';
import { ScreenContainer } from '../design/ScreenContainer';
import { Text } from '../design/Text';
import { useTheme as useDesignTheme } from '../design/theme';
import { Toggle } from '../design/Toggle';
import { useLocation } from '../context/LocationContext';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../utils/calcMethodDefaults';
import {
  getNotificationPermissionState,
  requestNotificationPermissionState,
  rescheduleNotifications,
} from '../utils/notifications';
import { ATHAN_VOICES, AthanVoice, athanVoice } from '../config/athanVoices';
import { playAthanPreview, stopAthanPreview } from '../utils/athanPreview';
import { downloadAllPages, isOfflineDownloaded } from '../utils/mushafCache';
import { classifyPermission, type PermissionUIState } from '../utils/permissionState';

const PRIVACY_URL = 'https://athannow.bbabiker.com/privacy';

const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30];

function minutesLabel(m: number): string {
  return m === 0 ? 'Off' : `${m} minutes before`;
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

/**
 * Notification status: the toggles below can all read "on" while iOS has notifications blocked, in which case nothing
 * fires. This row appears only then, with the recovery (ask, or open iOS Settings). It also books the schedule the
 * moment permission is granted.
 */
function NotificationStatus() {
  const settings = useSettings();
  const { location } = useLocation();
  const [perm, setPerm] = useState<PermissionUIState>('checking');
  const prev = useRef<PermissionUIState>('checking');

  const refresh = useCallback(async () => {
    try {
      const p = await getNotificationPermissionState();
      const next = classifyPermission(p.status, p.canAskAgain);
      setPerm(next);
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

  // Quiet when everything works; a row only appears when the user has something to do.
  if (perm === 'checking' || perm === 'granted') return null;
  if (perm === 'denied-permanent') {
    return (
      <ListRow
        title="Notifications are off"
        subtitle="Allow them in iOS Settings to hear the athan."
        value="Settings"
        onPress={() => Linking.openSettings().catch(() => {})}
        accessibilityHint="Opens the iOS Settings app"
      />
    );
  }
  return (
    <ListRow
      title="Notifications are off"
      subtitle="Allow them to hear the athan at each prayer."
      value="Turn On"
      accessibilityHint="Shows the iOS permission prompt"
      onPress={async () => {
        const p = await requestNotificationPermissionState().catch(() => null);
        if (p) setPerm(classifyPermission(p.status, p.canAskAgain));
      }}
    />
  );
}

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
  const [athanSheetOpen, setAthanSheetOpen] = useState(false);
  const [asrSheetOpen, setAsrSheetOpen] = useState(false);
  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);
  const [soundSheetOpen, setSoundSheetOpen] = useState(false);

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
  const athanValue = enabledCount === PRAYER_LABELS.length ? 'All' : enabledCount === 0 ? 'Off' : `${enabledCount} of ${PRAYER_LABELS.length}`;

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
        <View style={{ height: dt.spacing.sm }} />
        <ListGroup>
          <ListRow title="Location" value={cityName} onPress={() => setLocationSheetOpen(true)} />
        </ListGroup>

        <SectionHeader title="Prayer times" />
        <ListGroup>
          <ListRow title="Calculation method" value={methodLabel} onPress={() => setMethodSheetOpen(true)} />
          <ListRow title="Asr" value={ASR_OPTIONS.find((o) => o.value === settings.asrMadhab)?.label} onPress={() => setAsrSheetOpen(true)} />
          <ListRow
            title="24-hour time"
            accessory={<Toggle label="24-hour time" value={settings.use24Hour} onValueChange={(v) => settings.update({ use24Hour: v })} />}
          />
        </ListGroup>

        <SectionHeader title="Notifications" />
        <ListGroup>
          <NotificationStatus />
          <ListRow title="Athan" value={athanValue} onPress={() => setAthanSheetOpen(true)} />
          <ListRow title="Reminder" value={minutesLabel(settings.notifications.reminderMinutesBefore)} onPress={() => setReminderSheetOpen(true)} />
          <ListRow
            title="Athan sound"
            value={settings.notifications.athanSound ? athanVoice(settings.notifications.athanVoice).name : 'Silent'}
            onPress={() => setSoundSheetOpen(true)}
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

        <SectionHeader title="General" />
        <ListGroup>
          <ListRow title="Appearance" value={APPEARANCE_OPTIONS.find((o) => o.value === settings.appearance)?.label} onPress={() => setAppearanceSheetOpen(true)} />
          <ListRow title="Set up again" onPress={() => onboarding.start('replay')} />
          <ListRow title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
          {versionLabel ? <ListRow title="Version" value={versionLabel} /> : null}
        </ListGroup>

        <View style={{ height: dt.spacing.xxl }} />
        <ListGroup>
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

      <PickerSheet
        visible={asrSheetOpen}
        onClose={() => setAsrSheetOpen(false)}
        title="Asr"
        options={ASR_OPTIONS.map((o) => ({ ...o, subtitle: o.value === 'Hanafi' ? 'Later Asr, when shadows are twice an object’s length.' : 'Shafi’i, Maliki and Hanbali.' }))}
        value={settings.asrMadhab}
        onChange={(v) => settings.update({ asrMadhab: v })}
      />

      <PickerSheet
        visible={appearanceSheetOpen}
        onClose={() => setAppearanceSheetOpen(false)}
        title="Appearance"
        options={APPEARANCE_OPTIONS}
        value={settings.appearance}
        onChange={(v) => settings.update({ appearance: v })}
      />

      <PickerSheet
        visible={reminderSheetOpen}
        onClose={() => setReminderSheetOpen(false)}
        title="Reminder"
        options={MINUTE_OPTIONS.map((m) => ({ value: m, label: minutesLabel(m) }))}
        value={settings.notifications.reminderMinutesBefore}
        onChange={(v) => settings.updateNotifications({ reminderMinutesBefore: v })}
      />

      <AthanSoundSheet visible={soundSheetOpen} onClose={() => setSoundSheetOpen(false)} />

      <Sheet visible={athanSheetOpen} onClose={() => setAthanSheetOpen(false)} title="Athan">
        <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingTop: dt.spacing.md, paddingBottom: dt.spacing.xxl }}>
          <ListGroup>
            {PRAYER_LABELS.map((p) => (
              <ListRow
                key={p.key}
                title={p.label}
                accessory={
                  <Toggle
                    label={p.label}
                    value={settings.notifications.athanEnabled[p.key]}
                    onValueChange={(v) => settings.updateNotifications({ athanEnabled: { ...settings.notifications.athanEnabled, [p.key]: v } })}
                  />
                }
              />
            ))}
          </ListGroup>
        </ScrollView>
      </Sheet>
    </>
  );
}

/** A short single-choice list in a sheet, with a checkmark on the current value. */
function PickerSheet<T extends string | number>({
  visible,
  onClose,
  title,
  options,
  value,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string; subtitle?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const dt = useDesignTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingTop: dt.spacing.md, paddingBottom: dt.spacing.xxl }}>
        <ListGroup>
          {options.map((o) => (
            <ListRow
              key={String(o.value)}
              title={o.label}
              subtitle={o.subtitle}
              accessory={o.value === value ? <SymbolView name="checkmark" size={16} weight="semibold" tintColor={dt.c.accentText} /> : undefined}
              selected={o.value === value}
              onPress={() => {
                onChange(o.value);
                onClose();
              }}
            />
          ))}
        </ListGroup>
      </ScrollView>
    </Sheet>
  );
}

/**
 * Choose the athan recording, like picking a ringtone: tapping a sound selects it and plays it, tapping
 * the playing one again stops it. The choice is saved as you tap, so leaving keeps whatever is selected.
 * Previews stop when the sheet closes.
 */
function AthanSoundSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dt = useDesignTheme();
  const settings = useSettings();
  const [playing, setPlaying] = useState<string | null>(null);
  const [previewsUnavailable, setPreviewsUnavailable] = useState(false);
  const selected = settings.notifications.athanSound ? athanVoice(settings.notifications.athanVoice).id : 'silent';

  useEffect(() => {
    if (!visible) {
      stopAthanPreview();
      setPlaying(null);
    }
  }, [visible]);
  useEffect(() => () => stopAthanPreview(), []);

  const toggle = (v: AthanVoice) => {
    if (playing === v.id) {
      stopAthanPreview();
      setPlaying(null);
      return;
    }
    const ok = playAthanPreview(v.source, () => setPlaying(null));
    setPreviewsUnavailable(!ok);
    setPlaying(ok ? v.id : null);
  };
  const choose = (v: AthanVoice) => {
    haptic.select();
    settings.updateNotifications({ athanSound: true, athanVoice: v.id });
    toggle(v);
  };
  const close = () => {
    stopAthanPreview();
    setPlaying(null);
    onClose();
  };

  const check = <SymbolView name="checkmark" size={16} weight="semibold" tintColor={dt.c.accentText} />;
  return (
    <Sheet visible={visible} onClose={close} title="Athan sound">
      <ScrollView contentContainerStyle={{ paddingHorizontal: dt.spacing.lg, paddingTop: dt.spacing.md, paddingBottom: dt.spacing.xxl }}>
        <ListGroup>
          {ATHAN_VOICES.map((v) => {
            const isPlaying = playing === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => choose(v)}
                accessibilityRole="button"
                accessibilityLabel={`${v.name}${v.detail ? `, ${v.detail}` : ''}`}
                accessibilityHint={isPlaying ? 'Stops the preview' : 'Selects it and plays a preview'}
                accessibilityState={{ selected: selected === v.id }}
                style={({ pressed }) => [styles.soundRow, pressed && { backgroundColor: dt.c.surface2 }]}
              >
                <Pressable
                  onPress={() => toggle(v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? `Stop ${v.name}` : `Play ${v.name}`}
                >
                  <SymbolView name={isPlaying ? 'stop.circle.fill' : 'play.circle.fill'} size={28} tintColor={isPlaying ? dt.c.accent : dt.c.textSecondary} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{v.name}</Text>
                  {v.detail ? (
                    <Text variant="footnote" color="textSecondary">
                      {v.detail}
                    </Text>
                  ) : null}
                </View>
                {selected === v.id ? check : null}
              </Pressable>
            );
          })}
          <ListRow
            title="Silent"
            subtitle="A notification with no sound"
            accessory={selected === 'silent' ? check : undefined}
            selected={selected === 'silent'}
            onPress={() => {
              stopAthanPreview();
              setPlaying(null);
              settings.updateNotifications({ athanSound: false });
            }}
          />
        </ListGroup>
        {previewsUnavailable && (
          <Text variant="footnote" color="textSecondary" style={{ paddingHorizontal: dt.spacing.lg, paddingTop: dt.spacing.sm }}>
            Previews need the latest version of the app. Your choice is still saved.
          </Text>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 },
});
