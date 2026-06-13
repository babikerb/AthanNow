import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';

import { QuranLineMode, ScrollDirection } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { Surah } from '../data/surahs';
import { QURAN_FONT } from '../theme/colors';

// Neutral (non-accent) highlight for a bookmarked ayah inside the reading area.
const MUSHAF_HIGHLIGHT = 'rgba(128,128,128,0.18)';
import { toArabicNumber, Verse } from '../utils/quran';
import { getLineMetrics, paginate } from '../utils/quranPagination';
import { SurahHeader } from './SurahHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface ReaderSection {
  surah: Surah;
  verses: Verse[];
}

interface QuranReaderProps {
  sections: ReaderSection[];
  scrollDirection: ScrollDirection;
  lineMode: QuranLineMode;
  topInset: number;
  bottomInset: number;
  isBookmarked: (surahId: number, ayah: number) => boolean;
  onToggleBookmark: (surahId: number, ayah: number, surahName: string) => void;
  onVisibleSurahChange: (surahId: number) => void;
  onRequestMore: () => void;
}

type VerticalItem =
  | { type: 'header'; key: string; surah: Surah; continued: boolean; surahId: number }
  | { type: 'verse'; key: string; surahId: number; surahName: string; verse: Verse };

interface PageItem {
  verses: Verse[];
  surah: Surah;
  withHeader: boolean;
  continued: boolean;
}

const viewabilityConfig = { itemVisiblePercentThreshold: 30 };

export function QuranReader({
  sections,
  scrollDirection,
  lineMode,
  topInset,
  bottomInset,
  isBookmarked,
  onToggleBookmark,
  onVisibleSurahChange,
  onRequestMore,
}: QuranReaderProps) {
  const { colors } = useTheme();
  const metrics = useMemo(() => getLineMetrics(lineMode), [lineMode]);

  const longPress = useCallback(
    (surahId: number, ayah: number, name: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onToggleBookmark(surahId, ayah, name);
    },
    [onToggleBookmark],
  );

  // One viewability handler works for both modes: page items carry `surah`, vertical items carry `surahId`.
  const onVisibleSurahChangeRef = useRef(onVisibleSurahChange);
  onVisibleSurahChangeRef.current = onVisibleSurahChange;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as { surahId?: number; surah?: Surah } | undefined;
    const id = first?.surahId ?? first?.surah?.id;
    if (id) onVisibleSurahChangeRef.current(id);
  }).current;

  const pages = useMemo<PageItem[]>(() => {
    const out: PageItem[] = [];
    sections.forEach((s, idx) => {
      paginate(s.verses, metrics).forEach((p, i) =>
        out.push({ verses: p.verses, surah: s.surah, withHeader: i === 0, continued: idx > 0 && i === 0 }),
      );
    });
    return out;
  }, [sections, metrics]);

  const items = useMemo<VerticalItem[]>(() => {
    const out: VerticalItem[] = [];
    sections.forEach((s, idx) => {
      out.push({ type: 'header', key: `h-${s.surah.id}`, surah: s.surah, continued: idx > 0, surahId: s.surah.id });
      s.verses.forEach((v) =>
        out.push({ type: 'verse', key: `v-${s.surah.id}-${v.id}`, surahId: s.surah.id, surahName: s.surah.transliteration, verse: v }),
      );
    });
    return out;
  }, [sections]);

  const renderVertical = useCallback(
    ({ item }: { item: VerticalItem }) => {
      if (item.type === 'header') return <SurahHeader surah={item.surah} continued={item.continued} />;
      const marked = isBookmarked(item.surahId, item.verse.id);
      return (
        <Pressable
          onLongPress={() => longPress(item.surahId, item.verse.id, item.surahName)}
          style={[styles.verseRow, marked && { backgroundColor: MUSHAF_HIGHLIGHT, borderRadius: 12 }]}
        >
          <Text style={[styles.verseText, { color: colors.textPrimary }]}>
            {item.verse.text}{'  '}
            <Text style={[styles.marker, { color: colors.textSecondary }]}>﴿{toArabicNumber(item.verse.id)}﴾</Text>
          </Text>
        </Pressable>
      );
    },
    [colors, isBookmarked, longPress],
  );

  const renderPage = useCallback(
    ({ item: page }: { item: PageItem }) => (
      <Pressable style={[styles.page, { width: SCREEN_WIDTH, paddingTop: topInset + 8, paddingBottom: bottomInset + 8 }]}>
        {page.withHeader && <SurahHeader surah={page.surah} continued={page.continued} />}
        <Text style={[styles.flowText, { color: colors.textPrimary, fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }]}>
          {page.verses.map((v) => {
            const marked = isBookmarked(page.surah.id, v.id);
            return (
              <Text
                key={v.id}
                onLongPress={() => longPress(page.surah.id, v.id, page.surah.transliteration)}
                style={marked ? { backgroundColor: MUSHAF_HIGHLIGHT } : undefined}
              >
                {v.text}{' '}
                <Text style={[styles.marker, { color: colors.textSecondary, fontSize: metrics.fontSize - 4 }]}>
                  ﴿{toArabicNumber(v.id)}﴾
                </Text>{'  '}
              </Text>
            );
          })}
        </Text>
      </Pressable>
    ),
    [colors, metrics, isBookmarked, longPress, topInset, bottomInset],
  );

  if (scrollDirection === 'horizontal') {
    return (
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        inverted
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `page-${i}`}
        onEndReached={onRequestMore}
        onEndReachedThreshold={0.5}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewable}
        renderItem={renderPage}
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.key}
      renderItem={renderVertical}
      showsVerticalScrollIndicator={false}
      onEndReached={onRequestMore}
      onEndReachedThreshold={0.6}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewable}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: bottomInset + 40 }}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22 },
  flowText: { fontFamily: QURAN_FONT, textAlign: 'justify', writingDirection: 'rtl' },
  marker: { fontFamily: QURAN_FONT },
  verseRow: { paddingVertical: 11, paddingHorizontal: 8 },
  verseText: { fontFamily: QURAN_FONT, fontSize: 28, lineHeight: 56, textAlign: 'right', writingDirection: 'rtl' },
});
