import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, GestureResponderEvent, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';

import { TOTAL_PAGES } from '../../data/surahPages';
import { textStyle } from '../../design/tokens';
import { ayahAt, ayahRects, type AyahRef } from '../../quran/pageLayout';
import { Palette } from '../../theme/colors';
import { pageUrl, prefetchAround } from '../../utils/mushafCache';

// Source pages are 1024 x 1656 with roughly 45px of empty paper either side of the text block.
// Scaling to the text block (not the whole image) crops that paper, so the page reads edge to edge.
const SRC_W = 1024;
const SRC_H = 1656;
const INK_W = 934;

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const viewabilityConfig = { itemVisiblePercentThreshold: 55 };

export interface Highlight {
  ref: AyahRef;
  color: string;
}

export interface MushafPagerHandle {
  goTo: (page: number, animated?: boolean) => void;
}

interface Props {
  initialPage: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  /** Drawn behind the ink, the selected ayah over the playing one. */
  highlights: Highlight[];
  onPageChange: (page: number) => void;
  onTap: () => void;
  /** A long press on an ayah, with the screen y of the line pressed. */
  onAyahLongPress: (page: number, ref: AyahRef, y: number) => void;
}

/** Where the page image sits inside a page of the pager. */
function geometry(width: number, height: number) {
  const scale = Math.min(width / INK_W, height / SRC_H);
  return { scale, imgW: SRC_W * scale, imgH: SRC_H * scale, offX: (width - SRC_W * scale) / 2 };
}

const PageImage = memo(function PageImage({
  page,
  width,
  height,
  colors,
  highlights,
}: {
  page: number;
  width: number;
  height: number;
  colors: Palette;
  highlights: Highlight[];
}) {
  const { scale, imgW, imgH } = geometry(width, height);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumping the attempt remounts the image so Try again actually re-requests it.
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={{ width, height, alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ width: imgW, height: imgH }}>
        {highlights.map((h) =>
          ayahRects(page, h.ref).map((r, i) => (
            <View
              key={`${h.ref.surah}:${h.ref.ayah}:${h.color}:${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: r.x * scale,
                top: r.y * scale,
                width: r.w * scale,
                height: r.h * scale,
                borderRadius: 6,
                backgroundColor: h.color,
              }}
            />
          )),
        )}
        <Image
          key={attempt}
          source={{ uri: pageUrl(page) }}
          style={StyleSheet.absoluteFill}
          tintColor={colors.textPrimary}
          contentFit="contain"
          cachePolicy="disk"
          transition={120}
          recyclingKey={String(page)}
          accessibilityLabel={`Page ${page}`}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      </View>
      {state === 'loading' && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      )}
      {state === 'error' && (
        <View style={styles.overlay}>
          <SymbolView name="wifi.slash" size={28} tintColor={colors.textTertiary} />
          <Text style={[styles.msg, { color: colors.textSecondary }]}>Page {page} isn’t downloaded yet.</Text>
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
});

/**
 * The printed Madani mushaf, one full-screen page at a time, turned right-to-left like a book.
 * Tap to show or hide the controls; press and hold an ayah to act on it.
 */
export const MushafPager = forwardRef<MushafPagerHandle, Props>(function MushafPager(
  { initialPage, topInset, bottomInset, colors, highlights, onPageChange, onTap, onAyahLongPress },
  ref,
) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const startIndex = Math.min(Math.max(initialPage - 1, 0), TOTAL_PAGES - 1);

  useImperativeHandle(ref, () => ({
    goTo: (page, animated = true) => {
      const index = Math.min(Math.max(page - 1, 0), TOTAL_PAGES - 1);
      listRef.current?.scrollToIndex({ index, animated });
    },
  }));

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const p = viewableItems[0]?.item as number | undefined;
    if (p) {
      onPageChangeRef.current(p);
      prefetchAround(p);
    }
  }).current;

  // The page area stays the same size whether or not the controls show, so toggling them never
  // moves the page under the reader's eyes.
  const pageHeight = height - topInset - bottomInset;
  const geo = geometry(width, pageHeight);

  const longPress = useCallback(
    (page: number, e: GestureResponderEvent) => {
      // Screen coordinates: the inverted list mirrors its cells, so local ones can't be trusted.
      const { pageX, pageY } = e.nativeEvent;
      const hit = ayahAt(page, (pageX - geo.offX) / geo.scale, (pageY - topInset) / geo.scale);
      if (hit) onAyahLongPress(page, hit, pageY);
    },
    [geo.offX, geo.scale, topInset, onAyahLongPress],
  );

  return (
    <FlatList
      ref={listRef}
      data={PAGES}
      extraData={highlights}
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
        <Pressable
          onPress={onTap}
          onLongPress={(e) => longPress(item, e)}
          delayLongPress={350}
          accessible={false}
          style={{ width, paddingTop: topInset, paddingBottom: bottomInset }}
        >
          <PageImage page={item} width={width} height={pageHeight} colors={colors} highlights={highlights} />
        </Pressable>
      )}
    />
  );
});

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { ...textStyle('subhead') },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { ...textStyle('subhead') },
});
