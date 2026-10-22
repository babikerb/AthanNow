import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';

import { TOTAL_PAGES } from '../data/surahPages';
import { textStyle } from '../design/tokens';
import { Palette } from '../theme/colors';
import { pageUrl, prefetchAround } from '../utils/mushafCache';

interface MushafImageReaderProps {
  /** 1-based page to open on. */
  initialPage: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  onPageChange: (page: number) => void;
  /** Single tap on the page (toggles the reading chrome). */
  onTap?: () => void;
}

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const viewabilityConfig = { itemVisiblePercentThreshold: 55 };

/** One printed page with its own load/error state. Ink is tinted to the reading text colour. */
function PageImage({ page, width, height, colors }: { page: number; width: number; height: number; colors: Palette }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumping the attempt remounts the image so Retry actually re-requests it.
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        key={attempt}
        source={{ uri: pageUrl(page) }}
        style={{ width, height }}
        tintColor={colors.textPrimary}
        contentFit="contain"
        cachePolicy="disk"
        transition={120}
        recyclingKey={String(page)}
        accessibilityLabel={`Page ${page}`}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
      {state === 'loading' && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      )}
      {state === 'error' && (
        <View style={styles.overlay}>
          <SymbolView name="wifi.slash" size={28} tintColor={colors.textTertiary} />
          <Text style={[styles.msg, { color: colors.textSecondary }]}>Page {page} isn't downloaded yet.</Text>
          <Pressable
            onPress={() => {
              setState('loading');
              setAttempt((a) => a + 1);
            }}
            style={[styles.retry, { borderColor: colors.separator }]}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: colors.textPrimary }]}>Try again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The printed Madani mushaf, one full-screen page at a time, turned right-to-left like a book. */
export function MushafImageReader({ initialPage, topInset, bottomInset, colors, onPageChange, onTap }: MushafImageReaderProps) {
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
    if (p) {
      onPageChangeRef.current(p);
      prefetchAround(p);
    }
  }).current;

  // The page area stays the same size whether or not the chrome is showing, so toggling
  // it never reflows the page under the reader's eyes.
  const pageHeight = height - topInset - bottomInset;

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
      renderItem={({ item }) => (
        <Pressable onPress={onTap} accessible={false} style={{ width, paddingTop: topInset, paddingBottom: bottomInset }}>
          <PageImage page={item} width={width} height={pageHeight} colors={colors} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { ...textStyle('subhead') },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { ...textStyle('subhead'), fontWeight: '600' },
});
