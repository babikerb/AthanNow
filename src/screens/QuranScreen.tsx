import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { MushafReader } from '../components/MushafReader';
import { QuranReader, ReaderSection } from '../components/QuranReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getSurah } from '../data/surahs';
import { pageForSurah, surahForPage } from '../data/surahPages';
import { Bookmark, useBookmarks } from '../hooks/useBookmarks';
import { ACCENT } from '../theme/colors';
import { fetchChapterVerses } from '../utils/quran';
import { fetchMushafPage, pageForVerse } from '../utils/mushaf';

const LAST_SURAH = 114;

export default function QuranScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { quranScrollDirection, quranLineMode } = useSettings();
  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks();

  const isMushaf = quranScrollDirection === 'horizontal';

  const [selectedSurahId, setSelectedSurahId] = useState(1);
  const [visibleSurahId, setVisibleSurahId] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTarget, setPageTarget] = useState(1);

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

  useEffect(() => {
    if (isMushaf) return;
    return loadSelected(selectedSurahId);
  }, [selectedSurahId, isMushaf, loadSelected]);

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

  const currentlyBookmarked = isMushaf
    ? bookmarks.some((b) => b.page === currentPage)
    : isBookmarked(visibleSurahId, 1);

  // One tap sets/removes a bookmark at the current spot.
  const quickBookmark = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isMushaf) {
      try {
        const data = await fetchMushafPage(currentPage);
        const fw = data.lines.flatMap((l) => l.words).find((w) => w.verse_key);
        const [s, a] = fw?.verse_key ? fw.verse_key.split(':').map(Number) : [visibleSurahId, 1];
        toggleBookmark(s, a, getSurah(s)?.transliteration ?? '', currentPage);
      } catch {
        toggleBookmark(visibleSurahId, 1, headerSurah.transliteration, currentPage);
      }
    } else {
      toggleBookmark(visibleSurahId, 1, headerSurah.transliteration);
    }
  }, [isMushaf, currentPage, visibleSurahId, headerSurah, toggleBookmark]);

  const renderBody = () => {
    const topPad = insets.top + 64;
    if (isMushaf) {
      return (
        <MushafReader
          initialPage={pageTarget}
          topInset={topPad}
          bottomInset={insets.bottom + 50}
          colors={colors}
          dark={scheme === 'dark'}
          onPageChange={onMushafPageChange}
          isBookmarked={isBookmarked}
          onBookmarkVerse={bookmarkVerse}
        />
      );
    }
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.center}>
          <SymbolView name="wifi.slash" size={36} tintColor={colors.textTertiary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Couldn't load this surah. Check your connection and try again.
          </Text>
          <Pressable onPress={() => loadSelected(selectedSurahId)} style={[styles.retry, { backgroundColor: ACCENT }]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <QuranReader
        sections={sections}
        scrollDirection="vertical"
        lineMode={quranLineMode}
        topInset={topPad}
        bottomInset={insets.bottom}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleBookmark}
        onVisibleSurahChange={setVisibleSurahId}
        onRequestMore={onRequestMore}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      <GlassHeader insetTop={insets.top}>
        {/* Left element: bookmark (tap sets, long-press opens manager) */}
        <GlassCircle scheme={scheme} colors={colors}>
          <Pressable
            onPress={quickBookmark}
            onLongPress={() => setBookmarkOpen(true)}
            hitSlop={10}
            style={styles.circleHit}
          >
            <SymbolView name={currentlyBookmarked ? 'bookmark.fill' : 'bookmark'} size={19} tintColor={colors.textPrimary} />
          </Pressable>
        </GlassCircle>

        {/* Center title pill (tap to pick a surah) */}
        <Pressable
          style={styles.titleButton}
          onPress={() => {
            Haptics.selectionAsync();
            setPickerOpen(true);
          }}
        >
          <TitlePill scheme={scheme} colors={colors}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {headerSurah.transliteration}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              {isMushaf ? `Page ${currentPage}` : `${headerSurah.totalVerses} ayat`}
            </Text>
          </TitlePill>
        </Pressable>

        {/* Right element: search */}
        <GlassCircle scheme={scheme} colors={colors}>
          <Pressable
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
      </GlassHeader>

      {renderBody()}

      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={visibleSurahId}
        onSelect={selectSurah}
        onSelectVerse={goToVerse}
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

function TitlePill({ scheme, colors, children }: { scheme: 'light' | 'dark'; colors: any; children: React.ReactNode }) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView interactive colorScheme={scheme} style={styles.pill}>
        {children}
      </LiquidGlassView>
    );
  }
  return <View style={[styles.pill, styles.pillFallback, { borderColor: colors.separator }]}>{children}</View>;
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

function GlassHeader({ insetTop, children }: { insetTop: number; children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const content = <View style={[styles.headerInner, { paddingTop: insetTop + 8 }]}>{children}</View>;

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView effect="regular" colorScheme={scheme} style={styles.header}>
        {content}
      </LiquidGlassView>
    );
  }
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerInner: {
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
  titleButton: { flex: 1, alignItems: 'center' },
  pill: { borderRadius: 22, paddingHorizontal: 22, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 140 },
  pillFallback: { backgroundColor: 'rgba(127,127,127,0.12)', borderWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
