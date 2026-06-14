import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';

import { getSurah } from '../data/surahs';
import { surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { Palette } from '../theme/colors';
import { fetchPageMeta, PageMeta } from '../utils/mushaf';

interface MushafImageReaderProps {
  /** 1-based page to open on. */
  initialPage: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  dark: boolean;
  /** true = continuous vertical scroll; false = horizontal page turning. */
  vertical: boolean;
  onPageChange: (page: number) => void;
}

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const viewabilityConfig = { itemVisiblePercentThreshold: 55 };

// Native pixel aspect ratio of the source page images (1024 x 1656).
const ASPECT = 1656 / 1024;
const CAPTION_H = 34;

// Standard Madani-mushaf juz (part) start pages, 1..30.
const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
function juzForPage(page: number): number {
  let j = 1;
  for (let i = 0; i < JUZ_START.length; i++) if (JUZ_START[i] <= page) j = i + 1;
  return j;
}

// Official King Fahd "Madani" (15-line Hafs) printed page images — black ink on a
// TRANSPARENT background, so we paint the page color behind and tint the ink.
const pad3 = (n: number) => String(n).padStart(3, '0');
const pageUrl = (page: number) => `https://files.quran.app/hafs/madani/width_1024/page${pad3(page)}.png`;

function pageLabel(page: number): string {
  const name = getSurah(surahForPage(page))?.transliteration ?? '';
  return `${name}   ·   Juz ${juzForPage(page)}`;
}

/** Just the page image with its own load/error state and ink tint. */
function PageImage({ page, imgWidth, imgHeight, colors, dark, resize }: { page: number; imgWidth: number; imgHeight: number; colors: Palette; dark: boolean; resize: 'contain' | 'cover' }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <View style={{ width: imgWidth, height: imgHeight, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={{ uri: pageUrl(page) }}
        // Slightly softened in dark mode so light-on-dark ink doesn't read as bold/heavy.
        style={{ width: imgWidth, height: imgHeight, tintColor: dark ? '#CFCFCF' : '#141414' }}
        resizeMode={resize}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        fadeDuration={120}
      />
      {state === 'loading' && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      )}
      {state === 'error' && (
        <View style={styles.overlay}>
          <SymbolView name="wifi.slash" size={30} tintColor={colors.textTertiary} />
          <Text style={[styles.msg, { color: colors.textSecondary }]}>Couldn't load page {page}.</Text>
          <Pressable onPress={() => setState('loading')} style={[styles.retry, { borderColor: colors.separator }]}>
            <Text style={[styles.retryText, { color: colors.textPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Loads the Juz/Hizb-quarter for a page (cached); null until ready. */
function usePageMeta(page: number): PageMeta | null {
  const [meta, setMeta] = useState<PageMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    fetchPageMeta(page)
      .then((m) => !cancelled && setMeta(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page]);
  return meta;
}

/**
 * One full-screen printed page with its chrome: surah (top-left), Juz (top-right),
 * Hizb quarter (bottom-left) and the page number in a pill (bottom-center). The
 * page image fills the area edge-to-edge by width (contain — never stretched or
 * side-cropped); chrome sits in the top/bottom margins.
 */
function MushafPage({
  page,
  width,
  pageHeight,
  topInset,
  bottomInset,
  colors,
  dark,
}: {
  page: number;
  width: number;
  pageHeight: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  dark: boolean;
}) {
  const meta = usePageMeta(page);
  const surah = getSurah(surahForPage(page))?.transliteration ?? '';
  const juz = juzForPage(page);

  return (
    <View style={{ width, paddingTop: topInset, paddingBottom: bottomInset }}>
      <View style={{ width, height: pageHeight }}>
        <View style={styles.imgClip}>
          <PageImage page={page} imgWidth={width} imgHeight={pageHeight} colors={colors} dark={dark} resize="contain" />
        </View>

        {/* Top margin: surah · juz */}
        <View style={styles.topBar} pointerEvents="none">
          <Text style={[styles.cornerText, styles.cornerLeft, { color: colors.textTertiary }]} numberOfLines={1}>
            {surah}
          </Text>
          <Text style={[styles.cornerText, styles.cornerRight, { color: colors.textTertiary }]} numberOfLines={1}>
            Juz {juz}
          </Text>
        </View>

        {/* Bottom margin: hizb quarter · page-number pill */}
        <View style={styles.bottomBar} pointerEvents="none">
          <Text style={[styles.cornerText, styles.cornerLeft, { color: colors.textTertiary }]} numberOfLines={1}>
            {meta ? `${meta.quarter}/4` : ''}
          </Text>
          <View style={[styles.pagePill, { borderColor: colors.separator }]}>
            <Text style={[styles.pageNumText, { color: colors.textSecondary }]}>{page}</Text>
          </View>
          <View style={styles.cornerRight} />
        </View>
      </View>
    </View>
  );
}

export function MushafImageReader({ initialPage, topInset, bottomInset, colors, dark, vertical, onPageChange }: MushafImageReaderProps) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const startIndex = Math.min(Math.max(initialPage - 1, 0), TOTAL_PAGES - 1);

  useEffect(() => {
    listRef.current?.scrollToIndex({ index: startIndex, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage]);

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const p = viewableItems[0]?.item as number | undefined;
    if (p) onPageChangeRef.current(p);
  }).current;

  // ---- Vertical continuous scroll ----
  if (vertical) {
    const imgH = width * ASPECT;
    const itemH = imgH + CAPTION_H;
    const renderItem = ({ item }: { item: number }) => (
      <View>
        <PageImage page={item} imgWidth={width} imgHeight={imgH} colors={colors} dark={dark} resize="contain" />
        <View style={[styles.caption, { borderTopColor: colors.separator }]}>
          <Text style={[styles.captionText, { color: colors.textTertiary }]} numberOfLines={1}>
            {pageLabel(item)}   ·   {item}
          </Text>
        </View>
      </View>
    );
    return (
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(p) => String(p)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({ length: itemH, offset: itemH * index, index })}
        windowSize={4}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewable}
        // Snap each full page to the top so vertical scrolling lands on one page at a time.
        snapToInterval={itemH}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: bottomInset + 24 }}
      />
    );
  }

  // ---- Horizontal page turning (full-bleed) ----
  const pageHeight = height - topInset - bottomInset;
  const renderItem = ({ item }: { item: number }) => (
    <MushafPage page={item} width={width} pageHeight={pageHeight} topInset={topInset} bottomInset={bottomInset} colors={colors} dark={dark} />
  );

  return (
    <FlatList
      ref={listRef}
      data={PAGES}
      keyExtractor={(p) => String(p)}
      horizontal
      pagingEnabled
      inverted
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={startIndex}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      windowSize={3}
      maxToRenderPerBatch={2}
      initialNumToRender={1}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewable}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  imgClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 6, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  bottomBar: { position: 'absolute', bottom: 6, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  cornerText: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2 },
  cornerLeft: { flex: 1, textAlign: 'left' },
  cornerRight: { flex: 1, textAlign: 'right' },
  pagePill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 3, minWidth: 42, alignItems: 'center' },
  pageNumText: { fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { fontSize: 14 },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
  caption: { height: CAPTION_H, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  captionText: { fontSize: 12, fontWeight: '500' },
});
