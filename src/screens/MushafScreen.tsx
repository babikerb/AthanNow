import { Button as MenuButton, Divider as MenuDivider, Toggle as MenuToggle } from '@expo/ui/swift-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { setStatusBarHidden, setStatusBarStyle } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { QuranReader, type ReaderAction, type WordRef } from 'quran-reader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { GoalsSheet } from '../components/quran/GoalsSheet';
import { QuranHome } from '../components/quran/QuranHome';
import { NativeMenu } from '../components/NativeMenu';
import { PagePlayer } from '../components/quran/PagePlayer';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { getSurah, SURAHS } from '../data/surahs';
import { pageForSurah, surahForPage, TOTAL_PAGES } from '../data/surahPages';
import { haptic } from '../design/haptics';
import { PressableScale } from '../design/PressableScale';
import { Text } from '../design/Text';
import { ThemeProvider, useTheme } from '../design/theme';
import { Bookmark, BOOKMARK_COLORS, BookmarkColor, useBookmarks } from '../hooks/useBookmarks';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { setImmersive } from '../navigation/immersive';
import { surahPages, type Goal } from '../quran/goals';
import { firstAyahOnPage, pageForAyah, type AyahRef } from '../quran/pageLayout';
import { useQuranProgress } from '../quran/useQuranProgress';
import { useRecitation, useRecitationProgress } from '../recitation/RecitationProvider';
import { darkPalette, lightPalette } from '../theme/colors';
import { juzForPage } from '../utils/mushaf';

const LAST_PAGE_KEY = 'athannow.quran.lastpage.v1';
const LAST_COLOR_KEY = 'athannow.quran.lastcolor.v1';
// The reader's own light or dark page, separate from the app's appearance. Unset follows iOS.
const DARK_KEY = 'athannow.quran.reader.dark.v1';

const TITLES = SURAHS.map((s) => s.transliteration);
const TOP_BAR = 52;
const PLAYER = 64;
// A page counts as read after this long on it.
const READ_AFTER_MS = 12000;

/**
 * The Quran tab: the mushaf set word by word (modules/quran-reader), pinch to zoom from the printed
 * page into large flowing text. While a recitation plays, the words recited so far turn indigo and
 * the word being recited sits under glass. Press and hold a word for its native menu.
 */
export default function MushafScreen() {
  const system = useColorScheme();
  const [darkChoice, setDarkChoice] = useState<boolean | null>(null);
  const dark = darkChoice ?? system === 'dark';

  useEffect(() => {
    AsyncStorage.getItem(DARK_KEY)
      .then((v) => v != null && setDarkChoice(v === '1'))
      .catch(() => {});
  }, []);
  const chooseDark = useCallback((on: boolean) => {
    setDarkChoice(on);
    AsyncStorage.setItem(DARK_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  // The controls take the reader's light or dark, not the app's.
  return (
    <ThemeProvider preference={dark ? 'dark' : 'light'}>
      <Reader dark={dark} onDark={chooseDark} />
    </ThemeProvider>
  );
}

function Reader({ dark, onDark }: { dark: boolean; onDark: (on: boolean) => void }) {
  const t = useTheme();
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const { bookmarks, bookmarkForPage, setPageBookmark, removeBookmark } = useBookmarks();

  const [page, setPage] = useState(1);
  const [target, setTarget] = useState({ page: 1, nonce: 0 });
  const [restored, setRestored] = useState(false);
  const [lastColor, setLastColor] = useState<BookmarkColor>('red');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const progress = useQuranProgress();
  // The tab opens on its home (Continue, goals); Continue opens the page and the tab stays there.
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(LAST_PAGE_KEY), AsyncStorage.getItem(LAST_COLOR_KEY)])
      .then(([pageRaw, colorRaw]) => {
        if (cancelled) return;
        const n = Number(pageRaw);
        if (Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) {
          setPage(n);
          setTarget({ page: n, nonce: 1 });
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

  const jumpTo = useCallback((p: number) => {
    setPage(p);
    setTarget((x) => ({ page: p, nonce: x.nonce + 1 }));
    setReading(true);
  }, []);

  // Tapping the Quran tab while reading goes back to its home.
  const navigation = useNavigation();
  const focused = useIsFocused();
  useEffect(() => {
    const off = (navigation as unknown as { addListener: (e: string, f: () => void) => () => void }).addListener('tabPress', () => {
      if (focused) setReading(false);
    });
    return off;
  }, [navigation, focused]);

  // A page counts towards today once it has been open a little while, with the app in front.
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!reading || !focused || !active) return;
    const id = setTimeout(() => progress.markRead(page), READ_AFTER_MS);
    return () => clearTimeout(id);
  }, [page, reading, focused, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Controls: tap the page to hide them and the tab bar ----
  const [hidden, setHidden] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: hidden ? 0 : 1, duration: t.reduceMotion ? 0 : 220, useNativeDriver: true }).start();
    setImmersive(hidden);
    setStatusBarHidden(hidden, t.reduceMotion ? 'none' : 'fade');
  }, [hidden, fade, t.reduceMotion]);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(dark ? 'light' : 'dark', true);
      setImmersive(hidden);
      setStatusBarHidden(hidden, 'none');
      return () => {
        setImmersive(false);
        setStatusBarHidden(false, 'none');
      };
    }, [hidden, dark]),
  );

  // ---- Playback on the page ----
  const playingPage = r.surahId ? pageForAyah(r.surahId, r.ayahIndex + 1) : undefined;
  const [from, setFrom] = useState<WordRef | null>(null);
  // While a recitation plays the reader stays with it: pressing play, or the recitation moving on
  // to an ayah on another page, brings the reader back to the page being recited.
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (!reading || !playingPage || !r.isPlaying || playingPage === pageRef.current) return;
    jumpTo(playingPage);
  }, [playingPage, r.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!r.surahId) setFrom(null);
  }, [r.surahId]);
  // A surah heard to its last ayah counts as read today.
  useEffect(() => {
    const s = r.surahId ? getSurah(r.surahId) : undefined;
    if (s && r.isPlaying && r.ayahIndex >= s.totalVerses - 1) progress.markHeard(s.id);
  }, [r.surahId, r.ayahIndex, r.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const openGoal = useCallback(
    (goal: Goal) => {
      setGoalsOpen(false);
      if (goal.kind === 'surah') jumpTo(surahPages(goal.surah)[0]);
      else jumpTo(pageRef.current);
    },
    [jumpTo],
  );

  const playFrom = useCallback(
    (ref: AyahRef, onPage: number) => {
      haptic.light();
      setFrom({ surah: ref.surah, ayah: ref.ayah, word: 1 });
      r.playSurah(ref.surah, ref.ayah - 1);
    },
    [r],
  );
  const playPage = useCallback(() => {
    const first = firstAyahOnPage(pageRef.current);
    if (!first) return;
    if (r.repeat === 'ayah') r.setRepeat('off');
    playFrom(first, pageRef.current);
  }, [playFrom, r]);

  // ---- Bookmarks ----
  const markPage = useCallback(
    (spot: { page: number; surahId: number; ayah: number }) => {
      haptic.success();
      AsyncStorage.setItem(LAST_COLOR_KEY, lastColor).catch(() => {});
      setPageBookmark({ ...spot, surahName: getSurah(spot.surahId)?.transliteration ?? '' }, lastColor);
    },
    [lastColor, setPageBookmark],
  );
  const bookmarkedPages = useMemo(() => bookmarks.map((b) => b.page).filter((p): p is number => p != null), [bookmarks]);
  const pageMark = bookmarkForPage(page);

  const onAction = useCallback(
    (action: ReaderAction, surah: number, ayah: number, onPage: number) => {
      if (action === 'play') {
        if (r.repeat === 'ayah') r.setRepeat('off');
        playFrom({ surah, ayah }, onPage);
      } else if (action === 'repeat') {
        r.setRepeat('ayah');
        playFrom({ surah, ayah }, onPage);
      } else if (action === 'bookmark') {
        markPage({ page: onPage, surahId: surah, ayah });
      } else {
        const mark = bookmarkForPage(onPage);
        if (mark) {
          haptic.light();
          removeBookmark(mark);
        }
      }
    },
    [r, playFrom, markPage, bookmarkForPage, removeBookmark],
  );

  const surah = getSurah(surahForPage(page))!;
  const juz = juzForPage(page);
  const topInset = insets.top + TOP_BAR;
  const bottomInset = tabBar + PLAYER + t.spacing.sm;
  const pointer = hidden ? 'none' : 'box-none';
  const capsule = {
    backgroundColor: dark ? 'rgba(30, 28, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(29, 27, 38, 0.08)',
  };

  const sheets = (
    <>
      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={surah.id}
        onSelect={(id) => jumpTo(pageForSurah(id))}
        onSelectVerse={(key) => {
          const [s, a] = key.split(':').map(Number);
          jumpTo(pageForAyah(s, a));
        }}
        onSelectPage={jumpTo}
        palette={dark ? darkPalette : lightPalette}
      />
      <BookmarkSheet
        visible={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelect={(b: Bookmark) => jumpTo(b.page ?? pageForAyah(b.surahId, b.ayah))}
        onRemove={removeBookmark}
        palette={dark ? darkPalette : lightPalette}
      />
      <GoalsSheet visible={goalsOpen} onClose={() => setGoalsOpen(false)} progress={progress} dark={dark} onOpenGoal={openGoal} />
    </>
  );

  if (!reading) {
    return (
      <View style={{ flex: 1 }}>
        <QuranHome
          dark={dark}
          lastPage={page}
          progress={progress}
          bookmarks={bookmarks}
          onContinue={() => jumpTo(page)}
          onOpenPage={jumpTo}
          onOpenGoals={() => setGoalsOpen(true)}
          onOpenGoal={openGoal}
        />
        {sheets}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#111018' : '#F8F8FC' }}>
      {restored ? (
        <ReaderSurface
          dark={dark}
          page={target.page}
          nonce={target.nonce}
          from={from}
          follow={!!playingPage && r.isPlaying}
          topInset={topInset}
          bottomInset={bottomInset}
          bookmarkedPages={bookmarkedPages}
          onPageChange={setPage}
          onTap={() => setHidden((h) => !h)}
          onAction={onAction}
        />
      ) : null}

      {/* Surah, juz and page; tap for the index and search. The menu holds the page's options. */}
      <Animated.View
        pointerEvents={pointer}
        style={{ position: 'absolute', top: insets.top + 4, left: t.spacing.md, right: t.spacing.md, flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, opacity: fade }}
      >
        <PressableScale
          haptic="select"
          onPress={() => setReading(false)}
          accessibilityRole="button"
          accessibilityLabel="Quran home"
          style={[capsule, { width: 44, height: 44, borderRadius: 22 }]}
        >
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name="chevron.backward" size={16} tintColor={t.c.text} style={{ width: 20, height: 20 }} />
          </View>
        </PressableScale>
        <PressableScale
          haptic="select"
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${surah.transliteration}, Juz ${juz}, page ${page}`}
          accessibilityHint="Opens the surah index and search"
          style={[capsule, { flex: 1, height: 44, borderRadius: 22 }]}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.lg, gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.3}>
                {surah.transliteration}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                Juz {juz}
              </Text>
            </View>
            <Text variant="subhead" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }} maxFontSizeMultiplier={1.3}>
              {page}
            </Text>
          </View>
        </PressableScale>
        <NativeMenu
          width={44}
          height={44}
          colorScheme={dark ? 'dark' : 'light'}
          items={
            <>
              <MenuToggle label="Dark page" systemImage="moon" isOn={dark} onIsOnChange={onDark} />
              <MenuDivider />
              {pageMark ? (
                <MenuButton label="Remove bookmark" systemImage="bookmark.slash" role="destructive" onPress={() => removeBookmark(pageMark)} />
              ) : (
                <MenuButton
                  label="Bookmark this page"
                  systemImage="bookmark"
                  onPress={() => {
                    const first = firstAyahOnPage(page);
                    markPage({ page, surahId: first?.surah ?? surah.id, ayah: first?.ayah ?? 1 });
                  }}
                />
              )}
              <MenuButton label="Bookmarks" systemImage="list.bullet" onPress={() => setBookmarksOpen(true)} />
            </>
          }
        >
          <View style={[capsule, { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel="Page options">
            <SymbolView name="ellipsis" size={17} tintColor={t.c.text} style={{ width: 22, height: 22 }} />
          </View>
        </NativeMenu>
      </Animated.View>

      {/* The player, just above the tab bar. */}
      <Animated.View pointerEvents={pointer} style={{ position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: tabBar + t.spacing.sm, opacity: fade }}>
        <PagePlayer onPlayPage={playPage} />
      </Animated.View>

      {sheets}
    </View>
  );
}

/** The native reader, kept apart so the word-by-word progress re-renders only it. */
function ReaderSurface(props: {
  dark: boolean;
  page: number;
  nonce: number;
  from: WordRef | null;
  follow: boolean;
  topInset: number;
  bottomInset: number;
  bookmarkedPages: number[];
  onPageChange: (page: number) => void;
  onTap: () => void;
  onAction: (action: ReaderAction, surah: number, ayah: number, page: number) => void;
}) {
  const r = useRecitation();
  const { word } = useRecitationProgress();
  const current: WordRef | null = r.surahId ? { surah: r.surahId, ayah: r.ayahIndex + 1, word: Math.max(1, word) } : null;
  // The recited run starts where play began, or earlier if the recitation has gone back before it.
  const order = (w: WordRef) => w.surah * 1_000_000 + w.ayah * 1000 + w.word;
  const from = current && props.from && order(props.from) <= order(current) ? props.from : current ? { ...current, word: 1 } : null;
  return (
    <QuranReader
      style={{ flex: 1 }}
      page={props.page}
      pageNonce={props.nonce}
      dark={props.dark}
      current={current}
      from={from}
      follow={props.follow}
      topInset={props.topInset}
      bottomInset={props.bottomInset}
      surahTitles={TITLES}
      bookmarkedPages={props.bookmarkedPages}
      onPageChange={props.onPageChange}
      onTap={props.onTap}
      onAction={props.onAction}
    />
  );
}
