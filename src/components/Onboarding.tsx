import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocation } from '../context/LocationContext';
import { useOnboarding } from '../context/OnboardingContext';
import { PrayerKey, useSettings } from '../context/SettingsContext';
import { Button } from '../design/Button';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { Toggle } from '../design/Toggle';
import { CALC_METHODS, calcMethodForCountry } from '../utils/calcMethodDefaults';
import { getNotificationPermissionState, requestNotificationPermissionState } from '../utils/notifications';
import { LocationSheet } from './LocationSheet';
import SkyScene, { ScenePeriod } from './SkyScene';

// The sky moves through the day as you go: dawn, midday, dusk. That's the progress indicator.
const STEP_SKY: ScenePeriod[] = ['fajr', 'dhuhr', 'maghrib'];

const PRAYERS: { key: PrayerKey; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

/**
 * First-run setup, three steps over the illustrated sky: welcome, where you are, which athans to hear.
 * No tour of the tabs; the app explains itself once it's set up.
 */
export function Onboarding() {
  const { active, mode, finish } = useOnboarding();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const settings = useSettings();
  const { location, status, permission, hasRestored, refreshLocation } = useLocation();

  const [step, setStep] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) setStep(0);
  }, [active]);

  useEffect(() => {
    getNotificationPermissionState()
      .then((p) => setNotifGranted(p.status === 'granted'))
      .catch(() => {});
  }, [step]);

  // First run picks the calculation method for the user's region as soon as their country is known.
  // A replay never overrides a method someone already chose.
  const country = location.countryCode;
  useEffect(() => {
    if (active && mode === 'initial' && country) settings.update({ calcMethod: calcMethodForCountry(country) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, country]);

  if (!active) return null;

  const go = (next: number) => {
    haptic.select();
    const swap = () => setStep(next);
    if (t.reduceMotion) return swap();
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      swap();
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const done = () => {
    haptic.success();
    settings.update({ onboardingComplete: true });
    finish();
  };

  const sceneH = Math.round(Math.min(Math.max(height * 0.42, 240), 380));
  const gutter = width <= 375 ? 20 : 24;

  // ---- Step content ----
  const located = hasRestored && status === 'ready' && (location.isManual || permission === 'granted');
  const locating = status === 'loading';
  const methodLabel = CALC_METHODS.find((m) => m.key === settings.calcMethod)?.label ?? settings.calcMethod;

  let title: string;
  let body: string;
  let content: React.ReactNode = null;
  let primary: { label: string; onPress: () => void; loading?: boolean };
  let secondary: { label: string; onPress: () => void } | null = null;

  if (step === 0) {
    title = 'AthanNow';
    body = 'Prayer times and the Qibla for wherever you are.';
    primary = { label: 'Set up', onPress: () => go(1) };
    if (mode === 'replay') secondary = { label: 'Close', onPress: finish };
  } else if (step === 1) {
    title = 'Where are you?';
    if (located) {
      body = 'Prayer times are worked out for this place.';
      content = (
        <View style={[styles.card, { backgroundColor: t.c.surface1 }]}>
          <View style={styles.cardText}>
            <Text variant="headline">{location.city}</Text>
            {!!location.region && (
              <Text variant="footnote" color="textSecondary">
                {location.region}
              </Text>
            )}
            <Text variant="footnote" color="textSecondary" style={{ marginTop: t.spacing.sm }}>
              Calculated with {methodLabel}. You can change this in Settings.
            </Text>
          </View>
          <SymbolView name="checkmark" size={16} tintColor={t.c.accent} />
        </View>
      );
      primary = { label: 'Continue', onPress: () => go(2) };
      secondary = { label: 'Choose a different city', onPress: () => setSheetOpen(true) };
    } else if (permission === 'denied') {
      body = "Location is off for AthanNow, so choose your city. You can turn location on in Settings later.";
      primary = { label: 'Choose a city', onPress: () => setSheetOpen(true) };
      secondary = { label: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) };
    } else {
      body = "Prayer times depend on exactly where you are. Your location stays on this phone and is never stored by us.";
      primary = { label: 'Use my location', onPress: () => refreshLocation(), loading: locating };
      secondary = { label: 'Choose a city instead', onPress: () => setSheetOpen(true) };
    }
  } else {
    title = 'Hear the athan';
    body = 'Get a notification at each prayer you choose. You can change these any time.';
    content = (
      <View style={[styles.list, { backgroundColor: t.c.surface1 }]}>
        {PRAYERS.map((p, i) => (
          <View key={p.key} style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.hairline }]}>
            <Text variant="body">{p.label}</Text>
            <Toggle
              label={p.label}
              value={settings.notifications.athanEnabled[p.key]}
              onValueChange={(v) => settings.updateNotifications({ athanEnabled: { ...settings.notifications.athanEnabled, [p.key]: v } })}
            />
          </View>
        ))}
      </View>
    );
    primary = notifGranted
      ? { label: 'Done', onPress: done }
      : {
          label: 'Allow notifications',
          loading: notifBusy,
          onPress: async () => {
            setNotifBusy(true);
            await requestNotificationPermissionState().catch(() => null);
            setNotifBusy(false);
            done();
          },
        };
    if (!notifGranted) secondary = { label: 'Not now', onPress: done };
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: t.c.bg }]} accessibilityViewIsModal>
      <SkyScene period={STEP_SKY[step]} width={width} height={sceneH} clearTop={insets.top + 40} />

      {step > 0 && (
        <Pressable
          onPress={() => go(step - 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.back, { top: insets.top + t.spacing.sm, left: gutter - 8 }]}
        >
          <SymbolView name="chevron.left" size={18} tintColor={t.c.skyText} />
        </Pressable>
      )}

      <Animated.View style={[styles.flex, { opacity: fade }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: t.spacing.xl, paddingBottom: t.spacing.lg }} bounces={false}>
          <Text variant="footnote" color="textTertiary">
            {step + 1} of 3
          </Text>
          <Text variant={step === 0 ? 'display' : 'title1'} header style={{ marginTop: t.spacing.xs }}>
            {title}
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: t.spacing.sm }}>
            {body}
          </Text>
          {content && <View style={{ marginTop: t.spacing.xl }}>{content}</View>}
        </ScrollView>

        <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + t.spacing.md, gap: t.spacing.xs }}>
          <Button label={primary.label} onPress={primary.onPress} loading={primary.loading} fullWidth />
          {secondary ? <Button label={secondary.label} onPress={secondary.onPress} variant="ghost" fullWidth /> : <View style={{ height: 44 }} />}
        </View>
      </Animated.View>

      <LocationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  flex: { flex: 1 },
  back: { position: 'absolute', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderCurve: 'continuous', padding: 16 },
  cardText: { flex: 1 },
  list: { borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 16 },
});
