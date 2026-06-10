import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';

import { Palette } from '../theme/colors';
import { ensurePageFonts, fetchMushafPage, MushafPageData } from '../utils/mushaf';
import { TOTAL_PAGES } from '../data/surahPages';
import { MushafPage } from './MushafPage';

interface MushafReaderProps {
  /** 1-based page to open on. */
  initialPage: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  onPageChange: (page: number) => void;
  onToggleFocus: () => void;
}

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

/** Loads one page's JSON + fonts, then renders the exact glyph layout. */
function PageHost({
  page,
  width,
  pageHeight,
  topInset,
  bottomInset,
  colors,
  onToggleFocus,
}: {
  page: number;
  width: number;
  pageHeight: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  onToggleFocus: () => void;
}) {
  const [data, setData] = useState<MushafPageData | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFontsReady(false);
    setError(false);
    (async () => {
      try {
        const d = await fetchMushafPage(page);
        if (cancelled) return;
        setData(d);
        await ensurePageFonts(d);
        if (!cancelled) setFontsReady(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <Pressable onPress={onToggleFocus} style={{ width, paddingTop: topInset, paddingBottom: bottomInset }}>
      {error ? (
        <View style={[styles.center, { height: pageHeight }]}>
          <SymbolView name="wifi.slash" size={32} tintColor={colors.textTertiary} />
          <Text style={[styles.msg, { color: colors.textSecondary }]}>Couldn't load page {page}.</Text>
        </View>
      ) : !data ? (
        <View style={[styles.center, { height: pageHeight }]}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      ) : (
        <>
          <MushafPage data={data} width={width} height={pageHeight} colors={colors} fontsReady={fontsReady} />
          <Text style={[styles.pageNumber, { color: colors.textTertiary }]}>{page}</Text>
        </>
      )}
    </Pressable>
  );
}

export function MushafReader({ initialPage, topInset, bottomInset, colors, onPageChange, onToggleFocus }: MushafReaderProps) {
  const { width, height } = useWindowDimensions();
  const pageHeight = height - topInset - bottomInset - 28; // 28 ~ page-number footer
  const listRef = useRef<FlatList<number>>(null);

  // Jump when the requested page changes (e.g. surah picked).
  useEffect(() => {
    const index = Math.min(Math.max(initialPage - 1, 0), TOTAL_PAGES - 1);
    listRef.current?.scrollToIndex({ index, animated: false });
  }, [initialPage]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const p = viewableItems[0]?.item as number | undefined;
    if (p) onPageChangeRef.current(p);
  }).current;
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <PageHost
        page={item}
        width={width}
        pageHeight={pageHeight}
        topInset={topInset}
        bottomInset={bottomInset}
        colors={colors}
        onToggleFocus={onToggleFocus}
      />
    ),
    [width, pageHeight, topInset, bottomInset, colors, onToggleFocus],
  );

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: width, offset: width * index, index }), [width]);

  return (
    <FlatList
      ref={listRef}
      data={PAGES}
      keyExtractor={(p) => String(p)}
      horizontal
      pagingEnabled
      inverted // right-to-left page turning, like a physical mushaf
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={Math.min(Math.max(initialPage - 1, 0), TOTAL_PAGES - 1)}
      getItemLayout={getItemLayout}
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
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { fontSize: 14 },
  pageNumber: { position: 'absolute', bottom: 6, alignSelf: 'center', fontSize: 11, fontVariant: ['tabular-nums'] },
});
