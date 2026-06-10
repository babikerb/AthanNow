import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useMemo } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { QuranLineMode, ScrollDirection } from '../context/SettingsContext';
import { Surah } from '../data/surahs';
import { ACCENT, ACCENT_SOFT } from '../theme/colors';
import { toArabicNumber, Verse } from '../utils/quran';
import { getLineMetrics, paginate } from '../utils/quranPagination';
import { SurahHeader } from './SurahHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuranReaderProps {
  surah: Surah;
  verses: Verse[];
  scrollDirection: ScrollDirection;
  lineMode: QuranLineMode;
  topInset: number;
  bottomInset: number;
  isBookmarked: (surahId: number, ayah: number) => boolean;
  onToggleBookmark: (ayah: number) => void;
  onToggleFocus: () => void;
}

export function QuranReader({
  surah,
  verses,
  scrollDirection,
  lineMode,
  topInset,
  bottomInset,
  isBookmarked,
  onToggleBookmark,
  onToggleFocus,
}: QuranReaderProps) {
  const { colors } = useTheme();

  const metrics = useMemo(() => getLineMetrics(lineMode), [lineMode]);
  const pages = useMemo(() => paginate(verses, metrics), [verses, metrics]);

  const bookmarkLongPress = (ayah: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleBookmark(ayah);
  };

  // ----- Horizontal "Pages" mode (RTL, like a physical mushaf) -----
  if (scrollDirection === 'horizontal') {
    return (
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        inverted // right-to-left page turning
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `page-${i}`}
        renderItem={({ item: page }) => (
          <Pressable onPress={onToggleFocus} style={[styles.page, { width: SCREEN_WIDTH, paddingTop: topInset + 8, paddingBottom: bottomInset + 8 }]}>
            {page.withHeader && <SurahHeader surah={surah} />}
            <Text
              style={[
                styles.flowText,
                { color: colors.textPrimary, fontSize: metrics.fontSize, lineHeight: metrics.lineHeight },
              ]}
            >
              {page.verses.map((v) => {
                const marked = isBookmarked(surah.id, v.id);
                return (
                  <Text
                    key={v.id}
                    onLongPress={() => bookmarkLongPress(v.id)}
                    style={marked ? { backgroundColor: ACCENT_SOFT } : undefined}
                  >
                    {v.text}{' '}
                    <Text style={[styles.marker, { fontSize: metrics.fontSize - 2 }]}>
                      ﴿{toArabicNumber(v.id)}﴾
                    </Text>{'  '}
                  </Text>
                );
              })}
            </Text>
          </Pressable>
        )}
      />
    );
  }

  // ----- Vertical scroll mode -----
  return (
    <FlatList
      data={verses}
      keyExtractor={(v) => String(v.id)}
      ListHeaderComponent={<SurahHeader surah={surah} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: bottomInset + 40 }}
      renderItem={({ item }) => {
        const marked = isBookmarked(surah.id, item.id);
        return (
          <Pressable
            onPress={onToggleFocus}
            onLongPress={() => bookmarkLongPress(item.id)}
            style={[styles.verseRow, marked && { backgroundColor: ACCENT_SOFT, borderRadius: 12 }]}
          >
            <Text style={[styles.verseText, { color: colors.textPrimary }]}>
              {item.text}{'  '}
              <Text style={styles.marker}>﴿{toArabicNumber(item.id)}﴾</Text>
            </Text>
            {marked && <SymbolView name="bookmark.fill" size={14} tintColor={ACCENT} style={styles.verseBookmark} />}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22 },
  flowText: { textAlign: 'justify', writingDirection: 'rtl' },
  marker: { color: ACCENT },
  verseRow: { paddingVertical: 14, paddingHorizontal: 8 },
  verseText: { fontSize: 26, lineHeight: 52, textAlign: 'right', writingDirection: 'rtl' },
  verseBookmark: { alignSelf: 'flex-start', marginTop: 4 },
});
