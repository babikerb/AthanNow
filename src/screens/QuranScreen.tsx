import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarHidden } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { MushafImageReader } from '../components/MushafImageReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { getSurah } from '../data/surahs';
import { pageForSurah, surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { haptic } from '../design/haptics';
import { textStyle } from '../design/tokens';
import { Bookmark, BOOKMARK_COLOR_NAMES, BOOKMARK_COLORS, BookmarkColor, bookmarkColor, useBookmarks } from '../hooks/useBookmarks';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { setImmersive } from '../navigation/immersive';
import { readingPalette } from '../theme/colors';
import { fetchMushafPage, juzForPage, pageForVerse } from '../utils/mushaf';

const LAST_PAGE_KEY = 'athannow.quran.lastpage.v1';
const LAST_COLOR_KEY = 'athannow.quran.lastcolor.v1';

// Running head (surah, juz) height below the status-bar inset, and the page-number row at the foot.
const HEAD_H = 26;
const FOOT_H = 30;
// The native tab bar (react-native-bottom-tabs) draws over the screen instead of shrinking it.
const TAB_BAR_H = 49;

const COLOR_ORDER = Object.keys(BOOKMARK_COLORS) as BookmarkColor[];

export default function QuranScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { bookmarks, bookmarkForPage, setPageBookmark, removeBookmark } = useBookmarks();

  // The reading surface is always warm paper, the one deliberate exception to the app's dark theme.
  const colors = readingPalette;
  useFocusedStatusBar('dark');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageTarget, setPageTarget] = useState(1);
  const [restored, setRestored] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [lastColor, setLastColor] = useState<BookmarkColor>('red');

  // Restore the last-read page so the reader resumes instead of resetting to page 1.
  useEffect(() => {
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(LAST_PAGE_KEY), AsyncStorage.getItem(LAST_COLOR_KEY)])
      .then(([pageRaw, colorRaw]) => {
        if (cancelled) return;
        const n = Number(pageRaw);
        if (Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) {
          setPageTarget(n);
          setCurrentPage(n);
        }
        if (colorRaw && colorRaw in BOOKMARK_COLORS) setLastColor(colorRaw as BookmarkColor);
      })
      .catch(() => {})
      .finally(() => !cancelled && setRestored(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restored) AsyncStorage.setItem(LAST_PAGE_KEY, String(currentPage)).catch(() => {});
  }, [currentPage, restored]);

  // ---- Immersive reading: tap the page to hide the bars and the tab bar ----
  const [chromeHidden, setChromeHidden] = useState(false);
  const chrome = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(chrome, { toValue: chromeHidden ? 0 : 1, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start();
    setImmersive(chromeHidden);
    setStatusBarHidden(chromeHidden, reduceMotion ? 'none' : 'fade');
  }, [chromeHidden, chrome, reduceMotion]);
  // Never leave the tab bar hidden when the reader loses focus.
  useFocusEffect(
    useCallback(() => {
      setImmersive(chromeHidden);
      setStatusBarHidden(chromeHidden, 'none');
      return () => {
        setImmersive(false);
        setStatusBarHidden(false, 'none');
      };
    }, [chromeHidden]),
  );
  const toggleChrome = useCallback(() => {
    setTrayOpen(false);
    setChromeHidden((h) => !h);
  }, []);

  const jumpTo = useCallback((page: number) => {
    setPageTarget(page);
    setCurrentPage(page);
    setChromeHidden(false);
  }, []);

  const goToVerse = useCallback(
    async (verseKey: string) => {
      const page = await pageForVerse(verseKey).catch(() => undefined);
      jumpTo(page ?? pageForSurah(Number(verseKey.split(':')[0])));
    },
    [jumpTo],
  );

  const selectBookmark = useCallback((b: Bookmark) => jumpTo(b.page ?? pageForSurah(b.surahId)), [jumpTo]);

  const surahId = surahForPage(currentPage);
  const surah = useMemo(() => getSurah(surahId)!, [surahId]);
  const juz = juzForPage(currentPage);
  const pageMark = bookmarkForPage(currentPage);

  const markPage = useCallback(
    async (color: BookmarkColor) => {
      haptic.success();
      setTrayOpen(false);
      setLastColor(color);
      AsyncStorage.setItem(LAST_COLOR_KEY, color).catch(() => {});
      const page = currentPage;
      // The first verse on the page names the bookmark; fall back to the page's surah if offline.
      let spot = { surahId: surahForPage(page), ayah: 1 };
      try {
        const data = await fetchMushafPage(page);
        const key = data.lines.flatMap((l) => l.words).find((w) => w.verse_key)?.verse_key;
        if (key) {
          const [s, a] = key.split(':').map(Number);
          spot = { surahId: s, ayah: a };
        }
      } catch {
        // keep the fallback
      }
      setPageBookmark({ page, ...spot, surahName: getSurah(spot.surahId)?.transliteration ?? '' }, color);
    },
    [currentPage, setPageBookmark],
  );

  // Laid out like a printed mushaf: a running head (surah left, juz right) and the page number at the
  // foot, on the same paper as the page with no rule between them. Neither moves when the reading
  // chrome hides; the page number only slides down from above the tab bar to the bottom edge.
  const topInset = insets.top + HEAD_H;
  const bottomInset = insets.bottom + FOOT_H;
  const chromePointer = chromeHidden ? 'none' : 'auto';
  const footLift = chrome.interpolate({ inputRange: [0, 1], outputRange: [0, -TAB_BAR_H] });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {restored ? (
        <MushafImageReader
          initialPage={pageTarget}
          topInset={topInset}
          bottomInset={bottomInset}
          colors={colors}
          onPageChange={setCurrentPage}
          onTap={toggleChrome}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      )}

      {/* Running head. */}
      <View
        style={[styles.head, { height: topInset, paddingTop: insets.top, backgroundColor: colors.background }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${surah.transliteration}, Juz ${juz}, page ${currentPage}`}
      >
        <Text style={[styles.headSurah, { color: colors.textPrimary }]} numberOfLines={1}>
          {surah.transliteration}
        </Text>
        <Text style={[styles.headJuz, { color: colors.textSecondary }]}>Juz {juz}</Text>
      </View>

      {/* Foot: page number in the middle; the reading actions either side fade out in full screen. */}
      <Animated.View style={[styles.foot, { bottom: insets.bottom, height: FOOT_H + 14, transform: [{ translateY: footLift }] }]} pointerEvents="box-none">
        <Animated.View pointerEvents={chromePointer} style={[styles.footSide, { opacity: chrome }]}>
          <FootButton
            label={pageMark ? 'Change or remove this page’s bookmark' : 'Bookmark this page'}
            onPress={() => {
              haptic.select();
              // First tap on an unmarked page uses the last colour; tapping again offers the others.
              if (!pageMark && !trayOpen) markPage(lastColor);
              else setTrayOpen((o) => !o);
            }}
            onLongPress={() => setTrayOpen(true)}
          >
            <SymbolView name={pageMark ? 'bookmark.fill' : 'bookmark'} size={18} tintColor={pageMark ? bookmarkColor(pageMark) : colors.textSecondary} />
          </FootButton>
          <FootButton label="Bookmarks" onPress={() => setBookmarksOpen(true)}>
            <SymbolView name="list.bullet" size={18} tintColor={colors.textSecondary} />
          </FootButton>
        </Animated.View>
        <Text style={[styles.pageNumber, { color: colors.textSecondary }]} accessibilityLabel={`Page ${currentPage}`}>
          {currentPage}
        </Text>
        <Animated.View pointerEvents={chromePointer} style={[styles.footSide, styles.footRight, { opacity: chrome }]}>
          <FootButton
            label="Search the Quran"
            onPress={() => {
              haptic.select();
              setPickerOpen(true);
            }}
          >
            <SymbolView name="magnifyingglass" size={18} tintColor={colors.textSecondary} />
          </FootButton>
        </Animated.View>
      </Animated.View>

      {/* Colour tray for the page ribbon, just above the foot. */}
      {trayOpen && !chromeHidden && (
        <View style={[styles.tray, { bottom: insets.bottom + TAB_BAR_H + FOOT_H + 14, backgroundColor: colors.surface }]}>
          {COLOR_ORDER.map((c) => {
            const selected = pageMark?.color === c || (pageMark && !pageMark.color && c === 'red');
            return (
              <Pressable
                key={c}
                onPress={() => markPage(c)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${BOOKMARK_COLOR_NAMES[c]} bookmark`}
                accessibilityState={{ selected: !!selected }}
                style={[styles.swatch, { backgroundColor: BOOKMARK_COLORS[c] }, selected && { borderColor: colors.textPrimary }]}
              />
            );
          })}
          {pageMark && (
            <Pressable
              onPress={() => {
                haptic.light();
                removeBookmark(pageMark);
                setTrayOpen(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.trayRemove}
            >
              <Text style={[styles.trayLabel, { color: colors.textSecondary }]}>Remove</Text>
            </Pressable>
          )}
        </View>
      )}

      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={surahId}
        onSelect={(id) => jumpTo(pageForSurah(id))}
        onSelectVerse={goToVerse}
        onSelectPage={jumpTo}
        palette={colors}
      />
      <BookmarkSheet
        visible={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelect={selectBookmark}
        onRemove={removeBookmark}
        palette={colors}
      />
    </View>
  );
}

function FootButton({ label, onPress, onLongPress, children }: { label: string; onPress: () => void; onLongPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.footButton, pressed && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
  },
  headSurah: { ...textStyle('footnote'), flexShrink: 1 },
  headJuz: { ...textStyle('footnote') },
  foot: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  footSide: { flex: 1, flexDirection: 'row' },
  footRight: { justifyContent: 'flex-end' },
  footButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageNumber: { ...textStyle('footnote'), fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 11,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginHorizontal: 12,
  },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  trayRemove: { marginLeft: 'auto' },
  trayLabel: { ...textStyle('subhead') },
});
