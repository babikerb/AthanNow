import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Surah } from '../data/surahs';
import { ACCENT, QURAN_FONT } from '../theme/colors';

const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

interface SurahHeaderProps {
  surah: Surah;
  /** Tighter top spacing when this header follows the previous surah in a continuous flow. */
  continued?: boolean;
}

export function SurahHeader({ surah, continued }: SurahHeaderProps) {
  const { colors } = useTheme();
  const showBismillah = surah.id !== 9; // At-Tawbah has no opening bismillah.

  return (
    <View style={[styles.container, continued && styles.continued]}>
      {/* Ornamental name band: thin rules flanking a centered medallion. */}
      <View style={styles.band}>
        <View style={[styles.rule, { backgroundColor: colors.separator }]} />
        <View style={[styles.medallion, { borderColor: colors.separator, backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.arabicName, { color: colors.textPrimary }]}>{surah.arabicName}</Text>
        </View>
        <View style={[styles.rule, { backgroundColor: colors.separator }]} />
      </View>

      <Text style={[styles.meta, { color: colors.textTertiary }]}>
        {surah.transliteration.toUpperCase()} · {surah.type === 'meccan' ? 'MECCAN' : 'MEDINAN'} · {surah.totalVerses} AYAT
      </Text>

      {showBismillah && (
        <Text style={[styles.bismillah, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
          {BISMILLAH}
        </Text>
      )}
      <View style={[styles.accentDot, { backgroundColor: ACCENT }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 28, paddingBottom: 18 },
  continued: { paddingTop: 40 },
  band: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 24 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  medallion: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  arabicName: { fontFamily: QURAN_FONT, fontSize: 26, writingDirection: 'rtl', lineHeight: 44 },
  meta: { fontSize: 10, letterSpacing: 1.5, marginTop: 12 },
  bismillah: {
    fontFamily: QURAN_FONT,
    fontSize: 24,
    writingDirection: 'rtl',
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 32,
    lineHeight: 46,
  },
  accentDot: { width: 4, height: 4, borderRadius: 2, marginTop: 16, opacity: 0.5 },
});
