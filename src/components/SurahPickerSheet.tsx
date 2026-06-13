import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { getSurah, Surah, SURAHS } from '../data/surahs';
import { TOTAL_PAGES } from '../data/surahPages';
import { ACCENT, ACCENT_SOFT, QURAN_FONT } from '../theme/colors';
import { AyahHit, searchAyat } from '../utils/quran';
import { Sheet } from './Sheet';

interface SurahPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentSurahId: number;
  onSelect: (surahId: number) => void;
  /** Jump to a specific "surah:ayah" reference (e.g. "2:286"). */
  onSelectVerse?: (verseKey: string) => void;
  /** Jump to a 1-based mushaf page number. */
  onSelectPage?: (page: number) => void;
}

export function SurahPickerSheet({ visible, onClose, currentSurahId, onSelect, onSelectVerse, onSelectPage }: SurahPickerSheetProps) {
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

  // Detect a page jump: "page 50" / "pg 50" / "p50", or a bare number that can't be a
  // surah (115–604). Bare 1–114 stays ambiguous and is treated as a surah filter.
  const pageRef = useMemo(() => {
    const q = query.trim().toLowerCase();
    let n: number | null = null;
    const labelled = q.match(/^(?:page|pg|p)\s*(\d{1,3})$/);
    if (labelled) n = Number(labelled[1]);
    else if (/^\d{1,3}$/.test(q) && Number(q) > 114) n = Number(q);
    if (n === null || n < 1 || n > TOTAL_PAGES) return null;
    return n;
  }, [query]);

  // Arabic full-text ayah search (debounced) when the query contains Arabic letters.
  const isArabic = /[؀-ۿ]/.test(query);
  const [ayahHits, setAyahHits] = useState<AyahHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!isArabic || query.trim().length < 2 || verseRef) {
      setAyahHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      searchAyat(query)
        .then((h) => !cancelled && (setAyahHits(h), setSearching(false)))
        .catch(() => !cancelled && (setAyahHits([]), setSearching(false)));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isArabic, verseRef]);

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
    <Sheet visible={visible} onClose={onClose} title="Go to">
      <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
        <SymbolView name="magnifyingglass" size={18} tintColor={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder="Surah, ayah, or page"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          keyboardType="default"
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
      {pageRef && onSelectPage && (
        <Pressable
          onPress={() => {
            onSelectPage(pageRef);
            onClose();
          }}
          style={({ pressed }) => [styles.gotoRow, { backgroundColor: ACCENT_SOFT, opacity: pressed ? 0.6 : 1 }]}
        >
          <SymbolView name="book.pages.fill" size={22} tintColor={ACCENT} />
          <Text style={[styles.gotoText, { color: colors.textPrimary }]}>Go to page {pageRef}</Text>
        </Pressable>
      )}
      {isArabic && !verseRef ? (
        searching && ayahHits.length === 0 ? (
          <View style={styles.searchState}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : ayahHits.length === 0 ? (
          <View style={styles.searchState}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No ayat match that text.</Text>
          </View>
        ) : (
          <FlatList
            data={ayahHits}
            keyExtractor={(a) => a.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelectVerse?.(item.key);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ayahText, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.text}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textTertiary }]}>
                    {item.surahName} · {item.surahId}:{item.ayah}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    height: 50,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 14,
  },
  input: { flex: 1, fontSize: 16 },
  gotoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14 },
  gotoText: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  numberBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
  arabic: { fontSize: 20, writingDirection: 'rtl' },
  ayahText: { fontSize: 19, lineHeight: 32, fontFamily: QURAN_FONT, writingDirection: 'rtl', textAlign: 'right' },
  searchState: { paddingTop: 30, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14 },
});
