import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { MushafImageReader } from '../components/MushafImageReader';
import { QuranReader, ReaderSection } from '../components/QuranReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getSurah } from '../data/surahs';
import { pageForSurah, surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { Bookmark, useBookmarks } from '../hooks/useBookmarks';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { readingPalette } from '../theme/colors';
import { fetchChapterVerses } from '../utils/quran';
import { fetchMushafPage, juzForPage, pageForVerse } from '../utils/mushaf';

const LAST_SURAH = 114;
const LAST_PAGE_KEY = 'athannow.quran.lastpage.v1';

// Content height of the header/footer bars, excluding the safe-area inset
// (top-of-notch / home-indicator) each one also carries.
const HEADER_CONTENT_H = 44;
const FOOTER_CONTENT_H = 56;
// Standard iOS native tab bar height (49pt) on top of the home-indicator
// inset. `react-native-bottom-tabs` renders the screen full-bleed *behind*
// the tab bar rather than shrinking it, so anything anchored to this
// screen's own bottom edge (like the footer bar) renders underneath the
// tab bar unless it's pushed up by this amount.
const TAB_BAR_H_ESTIMATE = 49;

export default function QuranScreen() {
  const insets = useSafeAreaInsets();
  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks();

  // Quran is always the printed-page mushaf with horizontal page turning.
  const isMushaf = true;

  // Reading surface is always the warm-paper light palette, regardless of the
  // rest of the app's forced-dark theme — a full page of Arabic text reads
  // best on light paper, and this is the one deliberate exception.
  const pageColors = readingPalette;

  useFocusedStatusBar('dark');

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
  const juz = useMemo(() => juzForPage(currentPage), [currentPage]);
  const tabBarH = insets.bottom + TAB_BAR_H_ESTIMATE;

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
        topInset={insets.top + HEADER_CONTENT_H}
        bottomInset={tabBarH + FOOTER_CONTENT_H}
        colors={pageColors}
        dark={false}
        onPageChange={onMushafPageChange}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: pageColors.background }]}>
      <View style={styles.body}>{renderBody()}</View>

      {/* Header bar — surah, page, Juz. Always visible, no immersive mode. */}
      <View
        style={[
          styles.header,
          {
            height: insets.top + HEADER_CONTENT_H,
            paddingTop: insets.top,
            backgroundColor: pageColors.surface,
            borderBottomColor: pageColors.separator,
          },
        ]}
      >
        <Text style={[styles.headerSurah, { color: pageColors.textPrimary }]} numberOfLines={1}>
          {headerSurah.transliteration}
        </Text>
        <Text style={[styles.headerMeta, { color: pageColors.textSecondary }]}>{currentPage}</Text>
        <Text style={[styles.headerMeta, styles.headerMetaRight, { color: pageColors.textSecondary }]} numberOfLines={1}>
          Juz {juz}
        </Text>
      </View>

      {/* Footer bar — a compact icon-only quick-bookmark toggle, plus separate
          "All Bookmarks" and "Search" buttons, sitting just above the native
          tab bar. Always visible, no immersive mode. */}
      <View
        style={[
          styles.footerBar,
          {
            bottom: tabBarH,
            height: FOOTER_CONTENT_H,
            backgroundColor: pageColors.surface,
            borderTopColor: pageColors.separator,
          },
        ]}
      >
        <FooterIconButton colors={pageColors} onPress={quickBookmark}>
          <SymbolView name={currentlyBookmarked ? 'bookmark.fill' : 'bookmark'} size={19} tintColor={pageColors.textPrimary} />
        </FooterIconButton>

        <FooterButton colors={pageColors} onPress={() => setBookmarkOpen(true)}>
          <SymbolView name="books.vertical.fill" size={18} tintColor={pageColors.textPrimary} />
          <Text style={[styles.footerButtonText, { color: pageColors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
            Bookmarks
          </Text>
        </FooterButton>

        <FooterButton
          colors={pageColors}
          onPress={() => {
            Haptics.selectionAsync();
            setPickerOpen(true);
          }}
        >
          <SymbolView name="magnifyingglass" size={18} tintColor={pageColors.textPrimary} />
          <Text style={[styles.footerButtonText, { color: pageColors.textPrimary }]} numberOfLines={1}>
            Search
          </Text>
        </FooterButton>
      </View>

      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={visibleSurahId}
        onSelect={selectSurah}
        onSelectVerse={goToVerse}
        onSelectPage={goToPage}
        palette={pageColors}
      />
      <BookmarkSheet
        visible={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        bookmarks={bookmarks}
        onSelect={selectBookmark}
        onRemove={removeBookmark}
        palette={pageColors}
      />
    </View>
  );
}

/** A fuller, flex-filling footer button (icon + label), not a small icon-only circle. */
function FooterButton({
  colors,
  onPress,
  onLongPress,
  children,
}: {
  colors: typeof readingPalette;
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const content = (
    <Pressable onPress={onPress} onLongPress={onLongPress} hitSlop={6} style={styles.footerButtonHit}>
      {children}
    </Pressable>
  );
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView interactive colorScheme="light" style={styles.footerButton}>
        {content}
      </LiquidGlassView>
    );
  }
  return <View style={[styles.footerButton, styles.footerButtonFallback, { borderColor: colors.separator }]}>{content}</View>;
}

/** Compact icon-only footer button (fixed square), for the quick-bookmark toggle. */
function FooterIconButton({ colors, onPress, children }: { colors: typeof readingPalette; onPress: () => void; children: React.ReactNode }) {
  const content = (
    <Pressable onPress={onPress} hitSlop={6} style={styles.footerButtonHit}>
      {children}
    </Pressable>
  );
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView interactive colorScheme="light" style={styles.footerIcon}>
        {content}
      </LiquidGlassView>
    );
  }
  return <View style={[styles.footerIcon, styles.footerButtonFallback, { borderColor: colors.separator }]}>{content}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSurah: { flex: 1, fontSize: 15, fontWeight: '600' },
  headerMeta: { fontSize: 13, fontVariant: ['tabular-nums'] },
  headerMetaRight: { flex: 1, textAlign: 'right' },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { flex: 1, height: 44, borderRadius: 14, overflow: 'hidden' },
  footerIcon: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
  footerButtonFallback: { backgroundColor: 'rgba(127,127,127,0.12)', borderWidth: StyleSheet.hairlineWidth },
  footerButtonHit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: '100%', paddingHorizontal: 10 },
  footerButtonText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
