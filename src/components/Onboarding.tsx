import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { SCENES, SKY_TONES } from './sky/palettes';
import { HILLS_UNITS } from './sky/SkyIllustration';

// The sky moves through the day as you go: dawn, midday, dusk. That is the progress indicator.
const STEP_SKY: ScenePeriod[] = ['fajr', 'dhuhr', 'maghrib'];
// Where the sun or moon sits on its arc in each step's sky.
const STEP_ARC = [0.9, 0.5, 1];

const PRAYERS: { key: PrayerKey; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

// One fixed screen: text grows with Dynamic Type up to this factor so every step still fits.
const MAX_SCALE = 1.2;
// The tallest step's content (title, body, the prayer grid) at 1x, used to size the open sky above it.
const CONTENT_H = 270;

/**
 * First-run setup, three steps over the full-screen sky (the same scene as Home): welcome, where you
 * are, which athans to hear. One fixed screen per step, never scrolling: the open sky at the top
 * shrinks to make room. Buttons sit on the ink ground under the skyline.
 */
export function Onboarding() {
  const { active, mode, finish } = useOnboarding();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
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
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  const done = () => {
    haptic.success();
    settings.update({ onboardingComplete: true });
    finish();
  };

  // ---- Layout: open sky, content, hills, ink footer with the buttons ----
  const period = STEP_SKY[step];
  const tone = SKY_TONES[SCENES[period].full.tone];
  const darkTone = SCENES[period].full.tone === 'dark';
  const gutter = width <= 375 ? 20 : 24;
  const fs = Math.min(fontScale, MAX_SCALE);
  const footerH = insets.bottom + t.spacing.lg + 50 + t.spacing.xs + 44;
  const hillsH = Math.round((HILLS_UNITS * width) / 390);
  const topBar = insets.top + 44;
  const contentBottom = height - footerH - hillsH + 12;
  const zoneH = Math.min(160, Math.max(48, contentBottom - topBar - CONTENT_H * fs));
  const zone = { top: topBar, bottom: topBar + zoneH };
  const cardBg = darkTone ? 'rgba(255,255,255,0.42)' : 'rgba(14,11,22,0.36)';
  const divider = darkTone ? 'rgba(23,18,31,0.12)' : 'rgba(242,237,246,0.14)';

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
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.cardText}>
            <Text variant="headline" maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.text }}>
              {location.city}
            </Text>
            {!!location.region && (
              <Text variant="footnote" maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.secondary }}>
                {location.region}
              </Text>
            )}
            <Text variant="footnote" maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.secondary, marginTop: t.spacing.sm }}>
              Calculated with {methodLabel}. You can change this in Settings.
            </Text>
          </View>
          <SymbolView name="checkmark" size={16} tintColor={tone.accent} />
        </View>
      );
      primary = { label: 'Continue', onPress: () => go(2) };
      secondary = { label: 'Choose a different city', onPress: () => setSheetOpen(true) };
    } else if (permission === 'denied') {
      body = 'Location is off for AthanNow, so choose your city. You can turn location on in Settings later.';
      primary = { label: 'Choose a city', onPress: () => setSheetOpen(true) };
      secondary = { label: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) };
    } else {
      body = 'Prayer times depend on exactly where you are. Your location stays on this phone.';
      primary = { label: 'Use my location', onPress: () => refreshLocation(), loading: locating };
      secondary = { label: 'Choose a city instead', onPress: () => setSheetOpen(true) };
    }
  } else {
    title = 'Hear the athan';
    body = 'Get a notification at each prayer you choose.';
    // Two columns, so all six fit without scrolling.
    content = (
      <View style={[styles.grid, { backgroundColor: cardBg }]}>
        {PRAYERS.map((p, i) => (
          <View
            key={p.key}
            style={[
              styles.gridCell,
              i % 2 === 0 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: divider },
              i >= 2 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divider },
            ]}
          >
            <Text variant="body" maxFontSizeMultiplier={MAX_SCALE} numberOfLines={1} style={[styles.flexShrink, { color: tone.text }]}>
              {p.label}
            </Text>
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
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: SCENES[period].full.sky[0][0] }]} accessibilityViewIsModal>
      <View style={StyleSheet.absoluteFill}>
        <SkyScene
          period={period}
          width={width}
          height={height}
          layout="full"
          clearTop={topBar}
          zone={zone}
          arc={STEP_ARC[step]}
          groundLift={footerH}
          fadeMs={900}
        />
      </View>

      {/* Top bar: back on the left, step count on the right. */}
      <View style={[styles.topBar, { paddingTop: insets.top, height: topBar, paddingHorizontal: gutter - 8 }]}>
        {step > 0 ? (
          <Pressable onPress={() => go(step - 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <SymbolView name="chevron.left" size={18} tintColor={tone.text} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text variant="footnote" maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.secondary, marginRight: 8 }}>
          {step + 1} of 3
        </Text>
      </View>

      {/* Content, below the open sky. */}
      <Animated.View style={[styles.content, { top: zone.bottom, bottom: height - contentBottom, paddingHorizontal: gutter, opacity: fade }]}>
        <Text variant={step === 0 ? 'display' : 'title1'} header maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.text }}>
          {title}
        </Text>
        <Text variant="body" maxFontSizeMultiplier={MAX_SCALE} style={{ color: tone.secondary, marginTop: t.spacing.sm }}>
          {body}
        </Text>
        {content && <View style={{ marginTop: t.spacing.xl }}>{content}</View>}
      </Animated.View>

      {/* Buttons on the ink ground under the skyline. */}
      <Animated.View style={[styles.footer, { height: footerH, paddingBottom: insets.bottom + t.spacing.lg, paddingHorizontal: gutter, opacity: fade }]}>
        <Button label={primary.label} onPress={primary.onPress} loading={primary.loading} fullWidth />
        {secondary ? (
          <Pressable onPress={secondary.onPress} hitSlop={6} accessibilityRole="button" style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}>
            <Text variant="subhead" maxFontSizeMultiplier={MAX_SCALE} style={{ color: SKY_TONES.light.text }}>
              {secondary.label}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.secondary} />
        )}
      </Animated.View>

      <LocationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  flexShrink: { flexShrink: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', gap: 8 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderCurve: 'continuous', padding: 16 },
  cardText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  gridCell: { width: '50%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14 },
});
