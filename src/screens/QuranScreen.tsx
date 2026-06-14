import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { MushafImageReader } from '../components/MushafImageReader';
import { QuranReader, ReaderSection } from '../components/QuranReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { useImmersive } from '../context/ImmersiveContext';
import { useOnboardingTarget } from '../context/OnboardingContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getSurah } from '../data/surahs';
import { pageForSurah, surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { Bookmark, useBookmarks } from '../hooks/useBookmarks';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { ACCENT } from '../theme/colors';
import { fetchChapterVerses } from '../utils/quran';
import { fetchMushafPage, pageForVerse } from '../utils/mushaf';

const LAST_SURAH = 114;
const LAST_PAGE_KEY = 'athannow.quran.lastpage.v1';

export default function QuranScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks();

  // Quran is always the printed-page mushaf with horizontal page turning.
  const isMushaf = true;

  // Neutral reading palette — pure dark or warm paper, never the app's purple.
  const pageColors = useMemo(
    () =>
      scheme === 'dark'
        ? { ...colors, background: '#0F0F10', surface: '#0F0F10', textPrimary: '#ECECEC', textSecondary: 'rgba(255,255,255,0.6)', textTertiary: 'rgba(255,255,255,0.4)' }
        : { ...colors, background: '#F7F3EA', surface: '#F7F3EA', textPrimary: '#1B1B1B', textSecondary: 'rgba(0,0,0,0.6)', textTertiary: 'rgba(0,0,0,0.42)' },
    [colors, scheme],
  );

  useFocusedStatusBar(scheme === 'dark' ? 'light' : 'dark');

  const [selectedSurahId, setSelectedSurahId] = useState(1);
  const [visibleSurahId, setVisibleSurahId] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTarget, setPageTarget] = useState(1);
  // Restore the last-read page so the reader resumes instead of resetting to page 1.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LAST_PAGE_KEY)
      .then((v) => {
        const n = Number(v);
        if (!cancelled && Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) {
          setPageTarget(n);
          setCurrentPage(n);
          setVisibleSurahId(surahForPage(n));
          setSelectedSurahId(surahForPage(n));
        }
      })
      .finally(() => !cancelled && setRestored(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the page as the user reads (after restore, so we don't overwrite with 1).
  useEffect(() => {
    if (restored) AsyncStorage.setItem(LAST_PAGE_KEY, String(currentPage)).catch(() => {});
  }, [currentPage, restored]);

  const [sections, setSections] = useState<ReaderSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);

  // Immersive reading: tap the page to hide all chrome (floating controls + the
  // native tab bar) for a full-bleed, Ayah-style page. Tap again to bring it back.
  const { setTabBarHidden } = useImmersive();
  const [immersive, setImmersive] = useState(false);
  const chrome = useRef(new Animated.Value(1)).current;
  const titleTarget = useOnboardingTarget('quran-title');
  const bookmarkTarget = useOnboardingTarget('quran-bookmark');

  useEffect(() => {
    setTabBarHidden(immersive);
    Animated.timing(chrome, {
      toValue: immersive ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [immersive, setTabBarHidden, chrome]);

  // Always restore the tab bar when leaving the Quran tab.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setImmersive(false);
        setTabBarHidden(false);
      };
    }, [setTabBarHidden]),
  );

  // Detect a tap (short, no drag) anywhere on the page to toggle immersive mode,
  // without stealing scroll/long-press from the reader underneath.
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() };
  }, []);
  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    const { x, y, t } = touchStart.current;
    const moved = Math.abs(e.nativeEvent.pageX - x) + Math.abs(e.nativeEvent.pageY - y);
    if (Date.now() - t < 250 && moved < 12) {
      Haptics.selectionAsync();
      setImmersive((v) => !v);
    }
  }, []);

  const sectionsRef = useRef<ReaderSection[]>([]);
  sectionsRef.current = sections;
  const loadingMoreRef = useRef(false);

  const loadSelected = useCallback((id: number) => {
    setLoading(true);
    setError(false);
    setSections([]);
    let cancelled = false;
    fetchChapterVerses(id)
      .then((v) => {
        if (cancelled) return;
        const s = getSurah(id);
        if (s) setSections([{ surah: s, verses: v }]);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Both reading modes now render the printed page images, so no chapter text is
  // fetched for display. (loadSelected is retained for potential future use.)
  void loadSelected;

  const onRequestMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    const cur = sectionsRef.current;
    if (cur.length === 0) return;
    const lastId = cur[cur.length - 1].surah.id;
    if (lastId >= LAST_SURAH) return;
    const nextId = lastId + 1;
    loadingMoreRef.current = true;
    fetchChapterVerses(nextId)
      .then((v) => {
        const s = getSurah(nextId);
        if (s) setSections((p) => (p.some((x) => x.surah.id === nextId) ? p : [...p, { surah: s, verses: v }]));
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, []);

  const onMushafPageChange = useCallback((p: number) => {
    setCurrentPage(p);
    setVisibleSurahId(surahForPage(p));
  }, []);

  const selectSurah = useCallback((id: number) => {
    const p = pageForSurah(id);
    setSelectedSurahId(id);
    setVisibleSurahId(id);
    setCurrentPage(p);
    setPageTarget(p);
  }, []);

  // Jump to a "surah:ayah" reference from search.
  const goToVerse = useCallback(async (verseKey: string) => {
    const surahId = Number(verseKey.split(':')[0]);
    const page = await pageForVerse(verseKey).catch(() => undefined);
    if (page) {
      setPageTarget(page);
      setCurrentPage(page);
      setVisibleSurahId(surahForPage(page));
    }
    setSelectedSurahId(surahId);
  }, []);

  // Bookmark a specific ayah (used by mushaf long-press); stores the current page.
  const bookmarkVerse = useCallback(
    (surahId: number, ayah: number) => {
      toggleBookmark(surahId, ayah, getSurah(surahId)?.transliteration ?? '', currentPage);
    },
    [toggleBookmark, currentPage],
  );

  // Jump straight to a page number (from the general search).
  const goToPage = useCallback((page: number) => {
    setPageTarget(page);
    setCurrentPage(page);
    setVisibleSurahId(surahForPage(page));
    setSelectedSurahId(surahForPage(page));
  }, []);

  const selectBookmark = useCallback((b: Bookmark) => {
    if (b.page) {
      setPageTarget(b.page);
      setCurrentPage(b.page);
      setVisibleSurahId(surahForPage(b.page));
    } else {
      const p = pageForSurah(b.surahId);
      setSelectedSurahId(b.surahId);
      setVisibleSurahId(b.surahId);
      setPageTarget(p);
      setCurrentPage(p);
    }
  }, []);

  const headerSurah = useMemo(() => getSurah(visibleSurahId) ?? getSurah(selectedSurahId)!, [visibleSurahId, selectedSurahId]);

  // Page-based bookmarking in both modes (the printed page is the unit).
  const currentlyBookmarked = bookmarks.some((b) => b.page === currentPage);

  // One tap sets/removes a bookmark at the current page.
  const quickBookmark = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    {
      try {
        const data = await fetchMushafPage(currentPage);
        const fw = data.lines.flatMap((l) => l.words).find((w) => w.verse_key);
        const [s, a] = fw?.verse_key ? fw.verse_key.split(':').map(Number) : [visibleSurahId, 1];
        toggleBookmark(s, a, getSurah(s)?.transliteration ?? '', currentPage);
      } catch {
        toggleBookmark(visibleSurahId, 1, headerSurah.transliteration, currentPage);
      }
    }
  }, [currentPage, visibleSurahId, headerSurah, toggleBookmark]);

  const renderBody = () => {
    // Wait for the saved page to load so we open where the user left off (no page-1 flash).
    if (!restored) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={pageColors.textTertiary} />
        </View>
      );
    }
    // The actual printed King Fahd Madani pages, horizontal page turning.
    return (
      <MushafImageReader
        vertical={!isMushaf}
        initialPage={pageTarget}
        topInset={insets.top}
        bottomInset={insets.bottom}
        colors={pageColors}
        dark={scheme === 'dark'}
        onPageChange={onMushafPageChange}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: pageColors.background }]}>
      {/* The reading surface. A tap toggles immersive mode; scroll/long-press pass through. */}
      <View style={styles.body} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {renderBody()}
      </View>

      {/* Floating glass controls — no solid header bar. Fade out in immersive mode. */}
      <Animated.View
        pointerEvents={immersive ? 'none' : 'box-none'}
        style={[styles.floating, { paddingTop: insets.top + 6, opacity: chrome }]}
      >
        {/* Left: bookmark (tap sets, long-press opens manager) */}
        <GlassCircle scheme={scheme} colors={colors}>
          <Pressable
            ref={bookmarkTarget.ref}
            onLayout={bookmarkTarget.onLayout}
            collapsable={false}
            onPress={quickBookmark}
            onLongPress={() => setBookmarkOpen(true)}
            hitSlop={10}
            style={styles.circleHit}
          >
            <SymbolView name={currentlyBookmarked ? 'bookmark.fill' : 'bookmark'} size={19} tintColor={colors.textPrimary} />
          </Pressable>
        </GlassCircle>

        {/* Right: surah browser / search (surah + Juz are now baked into the page) */}
        <GlassCircle scheme={scheme} colors={colors}>
          <Pressable
            ref={titleTarget.ref}
            onLayout={titleTarget.onLayout}
            collapsable={false}
            onPress={() => {
              Haptics.selectionAsync();
              setPickerOpen(true);
            }}
            hitSlop={10}
            style={styles.circleHit}
          >
            <SymbolView name="magnifyingglass" size={19} tintColor={colors.textPrimary} />
          </Pressable>
        </GlassCircle>
      </Animated.View>

      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={visibleSurahId}
        onSelect={selectSurah}
        onSelectVerse={goToVerse}
        onSelectPage={goToPage}
      />
      <BookmarkSheet
        visible={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        bookmarks={bookmarks}
        onSelect={selectBookmark}
        onRemove={removeBookmark}
      />
    </View>
  );
}

function GlassCircle({ scheme, colors, children }: { scheme: 'light' | 'dark'; colors: any; children: React.ReactNode }) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView interactive colorScheme={scheme} style={styles.circle}>
        {children}
      </LiquidGlassView>
    );
  }
  return <View style={[styles.circle, styles.circleFallback, { borderColor: colors.separator }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circleFallback: { backgroundColor: 'rgba(127,127,127,0.12)', borderWidth: StyleSheet.hairlineWidth },
  circleHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
