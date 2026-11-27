import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { TOTAL_PAGES } from '../../data/surahPages';
import { haptic } from '../../design/haptics';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { firstAyahOnPage } from '../../quran/pageLayout';

const TILE = 30;
const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
// Pages that open a surah get a mark on their tile.
const OPENS_SURAH = new Set(PAGES.filter((p) => firstAyahOnPage(p)?.ayah === 1));

/** A page as a small tile of lines; a surah's opening page is marked. */
const Tile = memo(function Tile({ page, current, onPress }: { page: number; current: boolean; onPress: (p: number) => void }) {
  const t = useTheme();
  return (
    <PressableScale scaleTo={0.9} onPress={() => onPress(page)} accessibilityRole="button" accessibilityLabel={`Page ${page}`} accessibilityState={{ selected: current }}>
      <View style={{ width: TILE, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 18,
            height: 26,
            borderRadius: 4,
            backgroundColor: current ? t.c.accent : t.c.surface2,
            paddingHorizontal: 4,
            paddingVertical: 5,
            justifyContent: 'space-between',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ height: 1.5, borderRadius: 1, backgroundColor: current ? t.c.onAccent : t.c.glyphQuiet, opacity: current ? 0.7 : 0.6 }} />
          ))}
        </View>
        {OPENS_SURAH.has(page) ? <View style={{ position: 'absolute', top: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: t.c.info }} /> : null}
      </View>
    </PressableScale>
  );
});

/**
 * Every page as a strip of tiles, turned right to left like the book: swipe to run through them (the
 * page number shows as you go), let go or tap a tile to open it.
 */
export function PageScroller({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const t = useTheme();
  const list = useRef<FlatList<number>>(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(page);
  const dragging = useRef(false);
  const last = useRef(page);

  // Follows the page as it's turned elsewhere, unless a finger is on the strip.
  useEffect(() => {
    setShown(page);
    if (!dragging.current && width > 0) list.current?.scrollToOffset({ offset: (page - 1) * TILE, animated: Math.abs(page - last.current) < 20 });
    last.current = page;
  }, [page, width]);

  const indexAt = (x: number) => Math.min(TOTAL_PAGES, Math.max(1, Math.round(x / TILE) + 1));
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    const p = indexAt(e.nativeEvent.contentOffset.x);
    setShown((s) => {
      if (s !== p) haptic.select();
      return p;
    });
  }, []);
  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!dragging.current) return;
      dragging.current = false;
      const p = indexAt(e.nativeEvent.contentOffset.x);
      setShown(p);
      if (p !== last.current) onPage(p);
    },
    [onPage],
  );

  const pad = Math.max(0, (width - TILE) / 2);
  return (
    <View style={{ flex: 1, height: 56, justifyContent: 'center' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          ref={list}
          data={PAGES}
          keyExtractor={(p) => String(p)}
          horizontal
          inverted
          showsHorizontalScrollIndicator={false}
          snapToInterval={TILE}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: TILE, offset: TILE * i, index: i })}
          initialScrollIndex={Math.max(0, page - 1)}
          contentContainerStyle={{ paddingHorizontal: pad }}
          windowSize={7}
          initialNumToRender={20}
          onScrollBeginDrag={() => (dragging.current = true)}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={(e) => {
            // A drag that ends without momentum settles here.
            if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e);
          }}
          renderItem={({ item }) => <Tile page={item} current={item === shown} onPress={onPage} />}
          accessibilityLabel={`Page ${shown} of ${TOTAL_PAGES}`}
        />
      ) : null}
      {/* The number of the page in the middle, under its tile. */}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -2, left: 0, right: 0, alignItems: 'center' }}>
        <Text variant="caption2" style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: t.c.text }}>
          {shown}
        </Text>
      </View>
    </View>
  );
}
