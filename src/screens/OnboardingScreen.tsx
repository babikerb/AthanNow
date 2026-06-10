import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AmbientGradient from '../components/AmbientGradient';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../hooks/useLocation';
import { ACCENT } from '../theme/colors';
import { requestNotificationPermission } from '../utils/notifications';

export default function OnboardingScreen() {
  const { prayerGradients } = useTheme();
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
    <View style={styles.screen}>
      <AmbientGradient colors={prayerGradients.isha} />

      <View style={styles.center}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>AthanNow</Text>
        <Text style={styles.tagline}>Prayer times and the Quran.{'\n'}Calm and beautiful, every day.</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.ready}>Ready to get started?</Text>
        <TouchableOpacity style={styles.btn} onPress={start} activeOpacity={0.85} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get Started</Text>}
        </TouchableOpacity>
        <Text style={styles.disclaimer}>We use your location only to calculate prayer times.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 32, backgroundColor: '#070d18' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logo: { width: 110, height: 110, borderRadius: 26, marginBottom: 8 },
  wordmark: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1.6 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 23, textAlign: 'center', letterSpacing: -0.2 },
  footer: { paddingBottom: 56, gap: 14, alignItems: 'center' },
  ready: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '500' },
  btn: { backgroundColor: ACCENT, borderRadius: 18, paddingVertical: 17, alignSelf: 'stretch', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  disclaimer: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' },
});
