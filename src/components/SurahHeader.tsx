import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Surah } from '../data/surahs';
import { ACCENT } from '../theme/colors';

/** Bismillah rendered across two lines, as requested. At-Tawbah (9) has none. */
const BISMILLAH_LINE_1 = 'بِسْمِ اللَّهِ';
const BISMILLAH_LINE_2 = 'الرَّحْمَٰنِ الرَّحِيمِ';

interface SurahHeaderProps {
  surah: Surah;
}

export function SurahHeader({ surah }: SurahHeaderProps) {
  const { colors } = useTheme();
  const showBismillah = surah.id !== 9; // Surah At-Tawbah has no opening bismillah.

  return (
    <View style={styles.container}>
      {/* Ornamental title frame */}
      <View style={[styles.frame, { borderColor: ACCENT }]}>
        <SymbolView name="sparkle" size={14} tintColor={ACCENT} style={styles.cornerLeft} />
        <SymbolView name="sparkle" size={14} tintColor={ACCENT} style={styles.cornerRight} />
        <Text style={[styles.arabicName, { color: colors.textPrimary }]}>{surah.arabicName}</Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {surah.transliteration} · {surah.totalVerses} ayat
        </Text>
      </View>

      {showBismillah && (
        <View style={styles.bismillah}>
          <Text style={[styles.bismillahLine, { color: colors.textPrimary }]}>{BISMILLAH_LINE_1}</Text>
          <Text style={[styles.bismillahLine, { color: colors.textPrimary }]}>{BISMILLAH_LINE_2}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 22 },
  frame: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    position: 'relative',
  },
  cornerLeft: { position: 'absolute', top: -7, left: 12 },
  cornerRight: { position: 'absolute', top: -7, right: 12 },
  arabicName: { fontSize: 30, fontWeight: '700', writingDirection: 'rtl' },
  meta: { fontSize: 12, marginTop: 4, letterSpacing: 0.3 },
  bismillah: { alignItems: 'center', marginTop: 18, gap: 2 },
  bismillahLine: { fontSize: 24, writingDirection: 'rtl', lineHeight: 38 },
});
