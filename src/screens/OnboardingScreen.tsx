import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { ACCENT } from '../theme/colors';
import { requestNotificationPermission } from '../utils/notifications';

const FEATURES: { icon: SFSymbol; title: string; body: string }[] = [
  {
    icon: 'location.fill',
    title: 'Accurate prayer times',
    body: 'Times calculated for your exact location with the method you trust.',
  },
  {
    icon: 'book.fill',
    title: 'A beautiful Quran',
    body: 'Read in a calm, distraction-free mushaf with bookmarks and search.',
  },
  {
    icon: 'bell.badge.fill',
    title: 'Gentle reminders',
    body: 'Athan alerts, jamaa nudges, and a morning invitation to read.',
  },
];

export default function OnboardingScreen() {
  const { colors, prayerGradients } = useTheme();
  const { update } = useSettings();
  const { refreshLocation } = useLocation();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await refreshLocation();
      await requestNotificationPermission();
    } finally {
      update({ onboardingComplete: true });
    }
  };

  return (
    <LinearGradient colors={prayerGradients.isha} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={[styles.appBadge, { borderColor: 'rgba(255,255,255,0.15)' }]}>
            <SymbolView name="moon.stars.fill" size={40} tintColor={ACCENT} />
          </View>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.appName}>AthanNow</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <SymbolView name={f.icon} size={28} tintColor="rgba(255,255,255,0.9)" style={styles.featureIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={start}
            disabled={busy}
            style={({ pressed }) => [styles.cta, { backgroundColor: ACCENT, opacity: pressed || busy ? 0.85 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>Get started</Text>
            )}
          </Pressable>
          <Text style={[styles.disclaimer, { color: 'rgba(255,255,255,0.45)' }]}>
            We use your location only to calculate prayer times.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 24 },
  header: { alignItems: 'center', marginTop: 48 },
  appBadge: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  welcome: { color: 'rgba(255,255,255,0.6)', fontSize: 18 },
  appName: { color: '#FFF', fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  features: { gap: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  featureIcon: { marginTop: 2 },
  featureTitle: { color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 3 },
  featureBody: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 19 },
  footer: { gap: 14 },
  cta: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
