import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarHidden } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { Button as MenuButton, Divider as MenuDivider, Section as MenuSection } from '@expo/ui/swift-ui';

import { MushafPager, type Highlight, type MenuFor, type MushafPagerHandle } from '../components/quran/MushafPager';
import { PagePlayer } from '../components/quran/PagePlayer';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { getSurah } from '../data/surahs';
import { pageForSurah, surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { haptic } from '../design/haptics';
import { PressableScale } from '../design/PressableScale';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { textStyle } from '../design/tokens';
import { Bookmark, BOOKMARK_COLORS, BookmarkColor, bookmarkColor, useBookmarks } from '../hooks/useBookmarks';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { setImmersive } from '../navigation/immersive';
import { firstAyahOnPage, pageForAyah, type AyahRef } from '../quran/pageLayout';
import { useRecitation } from '../recitation/RecitationProvider';
import { readingPalette } from '../theme/colors';
import { juzForPage } from '../utils/mushaf';

const LAST_PAGE_KEY = 'athannow.quran.lastpage.v1';
const LAST_COLOR_KEY = 'athannow.quran.lastcolor.v1';

// The running head (surah, juz) and the page number at the foot, around the printed page. The
// controls float over the page and hide with a tap, so the page never moves.
const HEAD_H = 26;
const FOOT_H = 26;

// The playing ayah, warm gold behind the ink.
const PLAYING = 'rgba(184, 134, 11, 0.2)';

/**
 * The Quran tab: the printed mushaf, page by page, with the recitation over it. Play starts at the top
 * of the page; press and hold an ayah for the native menu, to play from it or repeat it. The playing ayah is lit and the pages turn with
 * the recitation.
 */
export default function MushafScreen() {
  const t = useTheme();
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const colors = readingPalette;
  useFocusedStatusBar('dark');
  const { bookmarks, bookmarkForPage, setPageBookmark, removeBookmark } = useBookmarks();

  const pager = useRef<MushafPagerHandle>(null);
  const [initialPage, setInitialPage] = useState(1);
  const [page, setPage] = useState(1);
  const [restored, setRestored] = useState(false);
  const [lastColor, setLastColor] = useState<BookmarkColor>('red');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(LAST_PAGE_KEY), AsyncStorage.getItem(LAST_COLOR_KEY)])
      .then(([pageRaw, colorRaw]) => {
        if (cancelled) return;
        const n = Number(pageRaw);
        if (Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) {
          setInitialPage(n);
          setPage(n);
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
    if (restored) AsyncStorage.setItem(LAST_PAGE_KEY, String(page)).catch(() => {});
  }, [page, restored]);

  // ---- Controls: tap the page to hide them (and the tab bar) for reading ----
  const [hidden, setHidden] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: hidden ? 0 : 1, duration: t.reduceMotion ? 0 : 200, useNativeDriver: true }).start();
    setImmersive(hidden);
    setStatusBarHidden(hidden, t.reduceMotion ? 'none' : 'fade');
  }, [hidden, fade, t.reduceMotion]);
  useFocusEffect(
    useCallback(() => {
      setImmersive(hidden);
      setStatusBarHidden(hidden, 'none');
      return () => {
        setImmersive(false);
        setStatusBarHidden(false, 'none');
      };
    }, [hidden]),
  );

  const onTap = useCallback(() => setHidden((h) => !h), []);

  const jumpTo = useCallback((p: number, animated = false) => {
    pager.current?.goTo(p, animated);
    setPage(p);
    setHidden(false);
  }, []);

  // ---- The recitation on the page ----
  const playing: AyahRef | null = r.surahId && !r.inBismillah ? { surah: r.surahId, ayah: r.ayahIndex + 1 } : null;
  const playingPage = r.surahId ? pageForAyah(r.surahId, r.inBismillah ? 1 : r.ayahIndex + 1) : undefined;

  // The pages turn with the recitation while the reader is on the page being recited; after they turn
  // away to read elsewhere, the recitation goes on without pulling them back.
  const followed = useRef<number | undefined>(undefined);
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    const before = followed.current;
    followed.current = playingPage;
    if (!playingPage || !r.isPlaying || playingPage === pageRef.current) return;
    if (before === pageRef.current) {
      pager.current?.goTo(playingPage, !t.reduceMotion);
      setPage(playingPage);
    }
  }, [playingPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const playFrom = useCallback(
    (ref: AyahRef, onPage: number) => {
      haptic.light();
      followed.current = onPage;
      r.playSurah(ref.surah, ref.ayah - 1);
    },
    [r],
  );

  const playPage = useCallback(() => {
    const first = firstAyahOnPage(pageRef.current);
    if (first) playFrom(first, pageRef.current);
  }, [playFrom]);

  const highlights = useMemo<Highlight[]>(() => (playing ? [{ ref: playing, color: PLAYING }] : []), [playing?.surah, playing?.ayah]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Bookmarks ----
  const pageMark = bookmarkForPage(page);
  const markPage = useCallback(
    (spot: { page: number; surahId: number; ayah: number }, color: BookmarkColor = lastColor) => {
      haptic.success();
      setLastColor(color);
      AsyncStorage.setItem(LAST_COLOR_KEY, color).catch(() => {});
      setPageBookmark({ ...spot, surahName: getSurah(spot.surahId)?.transliteration ?? '' }, color);
    },
    [lastColor, setPageBookmark],
  );
  const togglePageMark = useCallback(() => {
    if (pageMark) {
      haptic.light();
      removeBookmark(pageMark);
      return;
    }
    const first = firstAyahOnPage(page);
    markPage({ page, surahId: first?.surah ?? surahForPage(page), ayah: first?.ayah ?? 1 });
  }, [pageMark, page, removeBookmark, markPage]);

  // The native press-and-hold menu on a page: the held ayah's actions, then the page's.
  const menuFor = useCallback<MenuFor>(
    (p, ayah) => {
      const mark = bookmarkForPage(p);
      const first = firstAyahOnPage(p);
      const name = ayah ? getSurah(ayah.surah)?.transliteration : undefined;
      return (
        <>
          {ayah ? (
            <MenuSection title={`${name}, Ayah ${ayah.ayah}`}>
              <MenuButton
                label="Play from here"
                systemImage="play.fill"
                onPress={() => {
                  if (r.repeat === 'ayah') r.setRepeat('off');
                  playFrom(ayah, p);
                }}
              />
              <MenuButton
                label="Repeat this ayah"
                systemImage="repeat.1"
                onPress={() => {
                  r.setRepeat('ayah');
                  playFrom(ayah, p);
                }}
              />
            </MenuSection>
          ) : first ? (
            <MenuButton label="Play from the top of the page" systemImage="play.fill" onPress={() => playFrom(first, p)} />
          ) : null}
          <MenuDivider />
          {mark ? (
            <MenuButton label="Remove bookmark" systemImage="bookmark.slash" role="destructive" onPress={() => removeBookmark(mark)} />
          ) : (
            <MenuButton
              label="Bookmark this page"
              systemImage="bookmark"
              onPress={() => markPage({ page: p, surahId: ayah?.surah ?? first?.surah ?? surahForPage(p), ayah: ayah?.ayah ?? first?.ayah ?? 1 })}
            />
          )}
        </>
      );
    },
    [bookmarkForPage, playFrom, r, removeBookmark, markPage],
  );
  const menuKey = `${bookmarks.length}:${bookmarks[0]?.page ?? 0}:${r.repeat}`;

  const surah = getSurah(surahForPage(page))!;
  const juz = juzForPage(page);
  const topInset = insets.top + HEAD_H;
  const bottomInset = insets.bottom + FOOT_H;
  const pointer = hidden ? 'none' : 'box-none';

  const pill = {
    backgroundColor: t.c.surface1,
    borderWidth: 1,
    borderColor: t.c.hairline,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {restored ? (
        <MushafPager
          ref={pager}
          initialPage={initialPage}
          topInset={topInset}
          bottomInset={bottomInset}
          colors={colors}
          highlights={highlights}
          menuKey={menuKey}
          menuFor={menuFor}
          onPageChange={setPage}
          onTap={onTap}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textTertiary} />
        </View>
      )}

      {/* Running head and page number, like a printed mushaf. */}
      <View
        pointerEvents="none"
        style={[styles.head, { top: insets.top, height: HEAD_H }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${surah.transliteration}, Juz ${juz}, page ${page}`}
      >
        <RNText style={[styles.headText, { color: colors.textSecondary }]} numberOfLines={1}>
          {surah.transliteration}
        </RNText>
        <RNText style={[styles.headText, { color: colors.textSecondary }]}>Juz {juz}</RNText>
      </View>
      <View pointerEvents="none" style={[styles.foot, { bottom: insets.bottom, height: FOOT_H }]}>
        <RNText style={[styles.headText, { color: colors.textSecondary, fontVariant: ['tabular-nums'] }]}>{page}</RNText>
      </View>

      {/* Top controls: bookmarks, the surah (opens the index and search), this page's bookmark. */}
      <Animated.View pointerEvents={pointer} style={[styles.topRow, { top: insets.top + 2, opacity: fade }]}>
        <RoundButton name="list.bullet" label="Bookmarks" onPress={() => setBookmarksOpen(true)} style={pill} />
        <PressableScale
          haptic="select"
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${surah.transliteration}, Juz ${juz}, page ${page}`}
          accessibilityHint="Opens the surah index and search"
          style={[pill, { flex: 1, maxWidth: 280, height: 44, borderRadius: 22 }]}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: t.spacing.md }}>
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600', flexShrink: 1 }} maxFontSizeMultiplier={1.3}>
              {surah.transliteration}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              Page {page}
            </Text>
            <SymbolView name="chevron.down" size={11} tintColor={t.c.textSecondary} />
          </View>
        </PressableScale>
        <RoundButton
          name={pageMark ? 'bookmark.fill' : 'bookmark'}
          label={pageMark ? 'Remove this page’s bookmark' : 'Bookmark this page'}
          tint={pageMark ? bookmarkColor(pageMark) : undefined}
          onPress={togglePageMark}
          onLongPress={() => setBookmarksOpen(true)}
          style={pill}
        />
      </Animated.View>

      {/* The player, just above the tab bar. */}
      <Animated.View pointerEvents={pointer} style={{ position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: tabBar + t.spacing.sm, opacity: fade }}>
        <PagePlayer onPlayPage={playPage} />
      </Animated.View>


      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={surah.id}
        onSelect={(id) => jumpTo(pageForSurah(id))}
        onSelectVerse={(key) => {
          const [s, a] = key.split(':').map(Number);
          jumpTo(pageForAyah(s, a) ?? pageForSurah(s));
        }}
        onSelectPage={(p) => jumpTo(p)}
        palette={colors}
      />
      <BookmarkSheet
        visible={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelect={(b: Bookmark) => jumpTo(b.page ?? pageForAyah(b.surahId, b.ayah) ?? pageForSurah(b.surahId))}
        onRemove={removeBookmark}
        palette={colors}
      />
    </View>
  );
}

function RoundButton({
  name,
  label,
  onPress,
  onLongPress,
  tint,
  style,
}: {
  name: SFSymbol;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  tint?: string;
  style: object;
}) {
  const t = useTheme();
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[style, { width: 44, height: 44, borderRadius: 22 }]}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name={name} size={17} tintColor={tint ?? t.c.text} style={{ width: 22, height: 22 }} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  foot: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  headText: { ...textStyle('caption'), flexShrink: 1 },
  topRow: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
