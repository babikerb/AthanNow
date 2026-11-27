import { ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, GestureResponderEvent, ListRenderItem, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';

import { TOTAL_PAGES } from '../../data/surahPages';
import { textStyle } from '../../design/tokens';
import { ayahAt, ayahRects, type AyahRef } from '../../quran/pageLayout';
import { Palette } from '../../theme/colors';
import { pageUrl, prefetchAround } from '../../utils/mushafCache';

// Source pages are 1024 x 1656. The printed text runs from about x 43 to 997 (the widest lines and the
// surah frames), so the page is scaled to that span, centred on it, with a thin margin of paper
// either side: the words as large as they can be without any page losing its edges.
const SRC_W = 1024;
const SRC_H = 1656;
const INK_L = 40;
const INK_R = 1000;
const SIDE = 6;

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const viewabilityConfig = { itemVisiblePercentThreshold: 55 };
const NONE: Highlight[] = [];

export interface Highlight {
  ref: AyahRef;
  color: string;
}

export interface MushafPagerHandle {
  goTo: (page: number, animated?: boolean) => void;
}

/** What the native press-and-hold menu shows for a page: its items, and the ayah under the finger. */
export type MenuFor = (page: number, ayah: AyahRef | null) => React.ReactNode;

interface Props {
  initialPage: number;
  topInset: number;
  bottomInset: number;
  colors: Palette;
  /** Drawn behind the ink. */
  highlights: Highlight[];
  /** Changes whenever what `menuFor` returns would (a bookmark, the playing ayah). */
  menuKey: string;
  menuFor: MenuFor;
  onPageChange: (page: number) => void;
  onTap: () => void;
}

export interface Geometry {
  scale: number;
  imgW: number;
  imgH: number;
  offX: number;
}

/** Where the page image sits inside a page of the pager. */
export function geometry(width: number, height: number): Geometry {
  const scale = Math.min((width - SIDE * 2) / (INK_R - INK_L), height / SRC_H);
  return { scale, imgW: SRC_W * scale, imgH: SRC_H * scale, offX: width / 2 - ((INK_L + INK_R) / 2) * scale };
}

function Rects({ page, highlights, scale }: { page: number; highlights: Highlight[]; scale: number }) {
  return (
    <>
      {highlights.map((h) =>
        ayahRects(page, h.ref).map((r, i) => (
          <View
            key={`${h.ref.surah}:${h.ref.ayah}:${h.color}:${i}`}
            pointerEvents="none"
            style={{ position: 'absolute', left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale, borderRadius: 6, backgroundColor: h.color }}
          />
        )),
      )}
    </>
  );
}

const PageImage = memo(function PageImage({ page, width, height, geo, colors, highlights }: { page: number; width: number; height: number; geo: Geometry; colors: Palette; highlights: Highlight[] }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumping the attempt remounts the image so Try again actually re-requests it.
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: geo.offX, top: 0, width: geo.imgW, height: geo.imgH }}>
        <Rects page={page} highlights={highlights} scale={geo.scale} />
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

/** The held ayah lifted out of its page for the menu's preview, on the same paper, lit in gold. */
function AyahPreview({ page, ayah, width, maxHeight, colors, color }: { page: number; ayah: AyahRef; width: number; maxHeight: number; colors: Palette; color: string }) {
  const rects = ayahRects(page, ayah);
  if (!rects.length) return null;
  const pad = 14;
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  const scale = Math.min((width - pad * 2) / (INK_R - INK_L), (maxHeight - pad * 2) / (bottom - top));
  const innerW = (INK_R - INK_L) * scale;
  const innerH = (bottom - top) * scale;
  return (
    <View style={{ width, height: innerH + pad * 2, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: innerW, height: innerH, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: -INK_L * scale, top: -top * scale, width: SRC_W * scale, height: SRC_H * scale }}>
          <Rects page={page} highlights={[{ ref: ayah, color }]} scale={scale} />
          <Image source={{ uri: pageUrl(page) }} style={StyleSheet.absoluteFill} tintColor={colors.textPrimary} contentFit="contain" cachePolicy="disk" />
        </View>
      </View>
    </View>
  );
}

interface CellProps {
  page: number;
  width: number;
  pageHeight: number;
  topInset: number;
  bottomInset: number;
  geo: Geometry;
  colors: Palette;
  highlights: Highlight[];
  /** The ayah last touched on this page, or null. */
  armed: AyahRef | null;
  menuKey: string;
  menuFor: MenuFor;
  onTap: () => void;
  onTouch: (page: number, e: GestureResponderEvent) => void;
}

/**
 * One page inside a native SwiftUI context menu: press and hold anywhere for the system menu, its
 * preview the ayah under the finger. The finger's position is read as it lands, so the menu and its
 * preview are already about that ayah by the time it opens.
 */
const PageCell = memo(function PageCell({ page, width, pageHeight, topInset, bottomInset, geo, colors, highlights, armed, menuFor, onTap, onTouch }: CellProps) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ width, paddingTop: topInset, paddingBottom: bottomInset }} onTouchStart={(e) => onTouch(page, e)}>
      <Host style={{ width, height: pageHeight }} ignoreSafeArea="all">
        <ContextMenu>
          <ContextMenu.Trigger>
            <RNHostView matchContents>
              <Pressable onPress={onTap} accessible={false} style={{ width, height: pageHeight }}>
                <PageImage page={page} width={width} height={pageHeight} geo={geo} colors={colors} highlights={highlights} />
              </Pressable>
            </RNHostView>
          </ContextMenu.Trigger>
          {armed ? (
            <ContextMenu.Preview>
              <RNHostView matchContents>
                <AyahPreview page={page} ayah={armed} width={width - 24} maxHeight={height * 0.5} colors={colors} color="rgba(184, 134, 11, 0.22)" />
              </RNHostView>
            </ContextMenu.Preview>
          ) : null}
          <ContextMenu.Items>{menuFor(page, armed)}</ContextMenu.Items>
        </ContextMenu>
      </Host>
    </View>
  );
});

/** The printed Madani mushaf, one full-screen page at a time, turned right-to-left like a book. */
export const MushafPager = forwardRef<MushafPagerHandle, Props>(function MushafPager(
  { initialPage, topInset, bottomInset, colors, highlights, menuKey, menuFor, onPageChange, onTap },
  ref,
) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const startIndex = Math.min(Math.max(initialPage - 1, 0), TOTAL_PAGES - 1);
  const [armed, setArmed] = useState<{ page: number; ayah: AyahRef | null } | null>(null);

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
  const geo = useMemo(() => geometry(width, pageHeight), [width, pageHeight]);

  const onTouch = useCallback(
    (page: number, e: GestureResponderEvent) => {
      // Screen coordinates: the inverted list mirrors its cells, so local ones can't be trusted.
      const { pageX, pageY } = e.nativeEvent;
      const ayah = ayahAt(page, (pageX - geo.offX) / geo.scale, (pageY - topInset) / geo.scale);
      setArmed((a) => (a && a.page === page && a.ayah?.surah === ayah?.surah && a.ayah?.ayah === ayah?.ayah ? a : { page, ayah }));
    },
    [geo, topInset],
  );

  // Each page gets only the highlights that fall on it, and the same empty list otherwise, so a
  // highlight moving re-renders the page it's on and no other.
  const byPage = useMemo(() => {
    const m = new Map<number, Highlight[]>();
    return (page: number) => {
      if (!highlights.length) return NONE;
      if (!m.has(page)) {
        const on = highlights.filter((h) => ayahRects(page, h.ref).length > 0);
        m.set(page, on.length ? on : NONE);
      }
      return m.get(page)!;
    };
  }, [highlights]);

  const menuForRef = useRef(menuFor);
  menuForRef.current = menuFor;
  const stableMenuFor = useCallback<MenuFor>((p, a) => menuForRef.current(p, a), []);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const stableTap = useCallback(() => onTapRef.current(), []);

  const renderItem = useCallback<ListRenderItem<number>>(
    ({ item }) => (
      <PageCell
        page={item}
        width={width}
        pageHeight={pageHeight}
        topInset={topInset}
        bottomInset={bottomInset}
        geo={geo}
        colors={colors}
        highlights={byPage(item)}
        armed={armed && armed.page === item ? armed.ayah : null}
        menuKey={menuKey}
        menuFor={stableMenuFor}
        onTap={stableTap}
        onTouch={onTouch}
      />
    ),
    [width, pageHeight, topInset, bottomInset, geo, colors, byPage, armed, menuKey, stableMenuFor, stableTap, onTouch],
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
      removeClippedSubviews
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewable}
      renderItem={renderItem}
    />
  );
});

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { ...textStyle('subhead') },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { ...textStyle('subhead') },
});
