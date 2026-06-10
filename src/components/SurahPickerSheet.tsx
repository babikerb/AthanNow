import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { getSurah, Surah, SURAHS } from '../data/surahs';
import { ACCENT, ACCENT_SOFT } from '../theme/colors';
import { Sheet } from './Sheet';

interface SurahPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentSurahId: number;
  onSelect: (surahId: number) => void;
  /** Jump to a specific "surah:ayah" reference (e.g. "2:286"). */
  onSelectVerse?: (verseKey: string) => void;
}

export function SurahPickerSheet({ visible, onClose, currentSurahId, onSelect, onSelectVerse }: SurahPickerSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  // Detect a verse reference like "2:286" or "2.286".
  const verseRef = useMemo(() => {
    const m = query.trim().match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (!m) return null;
    const surahId = Number(m[1]);
    const ayah = Number(m[2]);
    const s = getSurah(surahId);
    if (!s || ayah < 1 || ayah > s.totalVerses) return null;
    return { surahId, ayah, key: `${surahId}:${ayah}`, name: s.transliteration };
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.transliteration.toLowerCase().includes(q) ||
        s.translation.toLowerCase().includes(q) ||
        s.arabicName.includes(query.trim()) ||
        String(s.id) === q,
    );
  }, [query]);

  const renderItem = ({ item }: { item: Surah }) => {
    const selected = item.id === currentSurahId;
    return (
      <Pressable
        onPress={() => {
          onSelect(item.id);
          onClose();
        }}
        style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={[styles.numberBadge, { backgroundColor: selected ? ACCENT : ACCENT_SOFT }]}>
          <Text style={[styles.numberText, { color: selected ? '#FFF' : ACCENT }]}>{item.id}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{item.transliteration}</Text>
          <Text style={[styles.sub, { color: colors.textTertiary }]}>
            {item.translation} · {item.totalVerses} ayat
          </Text>
        </View>
        <Text style={[styles.arabic, { color: colors.textSecondary }]}>{item.arabicName}</Text>
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Surahs">
      <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
        <SymbolView name="magnifyingglass" size={18} tintColor={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder="Search surah"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>
      {verseRef && onSelectVerse && (
        <Pressable
          onPress={() => {
            onSelectVerse(verseRef.key);
            onClose();
          }}
          style={({ pressed }) => [styles.gotoRow, { backgroundColor: ACCENT_SOFT, opacity: pressed ? 0.6 : 1 }]}
        >
          <SymbolView name="arrow.right.circle.fill" size={22} tintColor={ACCENT} />
          <Text style={[styles.gotoText, { color: colors.textPrimary }]}>
            Go to {verseRef.name} {verseRef.surahId}:{verseRef.ayah}
          </Text>
        </Pressable>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  input: { flex: 1, fontSize: 16 },
  gotoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12 },
  gotoText: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  numberBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 1 },
  arabic: { fontSize: 20, writingDirection: 'rtl' },
});
