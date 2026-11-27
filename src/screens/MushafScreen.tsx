import {
  Button as MenuButton,
  Divider as MenuDivider,
  Toggle as MenuToggle,
} from "@expo/ui/swift-ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { setStatusBarHidden, setStatusBarStyle } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { QuranReader, type ReaderAction, type WordRef } from "quran-reader";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  Easing,
  LayoutAnimation,
  PanResponder,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookmarkSheet } from "../components/BookmarkSheet";
import { GoalsSheet } from "../components/quran/GoalsSheet";
import { MeaningSheet } from "../components/quran/MeaningSheet";
import { QuranHome } from "../components/quran/QuranHome";
import { NativeMenu } from "../components/NativeMenu";
import { PagePlayer } from "../components/quran/PagePlayer";
import { PageScroller } from "../components/quran/PageScroller";
import { EdgeFade } from "../components/quran/EdgeFade";
import { SurahPickerSheet } from "../components/SurahPickerSheet";
import { getSurah, SURAHS } from "../data/surahs";
import { pageForSurah, surahForPage, TOTAL_PAGES } from "../data/surahPages";
import { haptic } from "../design/haptics";
import { PressableScale } from "../design/PressableScale";
import { Text } from "../design/Text";
import { useTheme } from "../design/theme";
import { useDisplaySettings, type Display } from "../quran/display";
import { ReaderSettingsSheet } from "../components/quran/ReaderSettingsSheet";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  Bookmark,
  BOOKMARK_COLORS,
  BookmarkColor,
  useBookmarks,
} from "../hooks/useBookmarks";
import { setImmersive } from "../navigation/immersive";
import { surahPages, type Goal } from "../quran/goals";
import {
  firstAyahOnPage,
  pageForAyah,
  surahsOnPage,
  type AyahRef,
} from "../quran/pageLayout";
import { useQuranProgress } from "../quran/useQuranProgress";
import {
  useRecitation,
  useRecitationProgress,
} from "../recitation/RecitationProvider";
import { darkPalette, lightPalette } from "../theme/colors";
import { juzForPage } from "../utils/mushaf";

const LAST_PAGE_KEY = "athannow.quran.lastpage.v1";
const LAST_COLOR_KEY = "athannow.quran.lastcolor.v1";
// The reader's own light or dark page, separate from the app's appearance. Unset follows iOS.
const DARK_KEY = "athannow.quran.reader.dark.v1";

const TITLES = SURAHS.map((s) => s.transliteration);
// The top bar (44 high, 4 below the status bar) and the player (56 high, 8 above the home
// indicator); the page sits between them with the same gap above and below. The page strip under
// the player overlaps the foot of the page on purpose: the page stays as large as it can be, and a
// tap to focus clears the controls away to show all of it.
const TOP_BAR = 4 + 44;
const PLAYER = 8 + 56;
const PAGE_GAP = 18;
// A page counts as read after this long on it.
const READ_AFTER_MS = 12000;

/**
 * The Quran tab: the mushaf set word by word (modules/quran-reader), pinch to zoom from the printed
 * page into large flowing text. While a recitation plays, the words recited so far turn indigo and
 * the word being recited sits under glass. Press and hold a word for its native menu.
 */
export default function MushafScreen() {
  const display = useDisplaySettings();
  return <Reader display={display} />;
}

function Reader({ display }: { display: Display }) {
  const [displayOpen, setDisplayOpen] = useState(false);
  // Pinched into flowing text (the page layout only; the others always flow).
  const [zoomed, setZoomed] = useState(false);
  const t = useTheme();
  // The mushaf follows the app's appearance and accent, like every other tab.
  const appDark = t.scheme === "dark";
  const dark = appDark;
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const { bookmarks, bookmarkForPage, setPageBookmark, removeBookmark } =
    useBookmarks();

  const [page, setPage] = useState(1);
  const [target, setTarget] = useState({ page: 1, nonce: 0 });
  const [restored, setRestored] = useState(false);
  const [lastColor, setLastColor] = useState<BookmarkColor>("red");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const progress = useQuranProgress();
  // The tab is its home (Continue, goals). The mushaf is a page of its own pushed over it, with the
  // tab bar hidden until the reader goes back.
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  readingRef.current = reading;
  const { width } = useWindowDimensions();
  // 0 with the reader on screen, 1 with it off to the right.
  const push = useRef(new Animated.Value(1)).current;
  // Tapping the page focuses it: the tab bar's already away, so the top bar widens and the player
  // becomes a small capsule (and back). The page stays put.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(LAST_PAGE_KEY),
      AsyncStorage.getItem(LAST_COLOR_KEY),
    ])
      .then(([pageRaw, colorRaw]) => {
        if (cancelled) return;
        const n = Number(pageRaw);
        if (Number.isFinite(n) && n >= 1 && n <= TOTAL_PAGES) {
          setPage(n);
          setTarget({ page: n, nonce: 1 });
        }
        if (colorRaw && colorRaw in BOOKMARK_COLORS)
          setLastColor(colorRaw as BookmarkColor);
      })
      .catch(() => {})
      .finally(() => !cancelled && setRestored(true));
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (restored)
      AsyncStorage.setItem(LAST_PAGE_KEY, String(page)).catch(() => {});
  }, [page, restored]);

  const openReader = useCallback(() => {
    if (readingRef.current) return;
    readingRef.current = true;
    setReading(true);
    setHidden(false);
    setImmersive(true);
    push.setValue(1);
    Animated.timing(push, {
      toValue: 0,
      duration: t.reduceMotion ? 0 : 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [push, t.reduceMotion]);

  const closeReader = useCallback(() => {
    if (!readingRef.current) return;
    setImmersive(false);
    Animated.timing(push, {
      toValue: 1,
      duration: t.reduceMotion ? 0 : 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      readingRef.current = false;
      setReading(false);
    });
  }, [push, t.reduceMotion]);

  const jumpTo = useCallback(
    (p: number) => {
      setPage(p);
      setTarget((x) => ({ page: p, nonce: x.nonce + 1 }));
      openReader();
    },
    [openReader],
  );
  /** A jump the reader chose: the index, a bookmark, the page strip. */
  const leapTo = useCallback(
    (p: number) => {
      jumpTo(p);
    },
    [jumpTo],
  );

  // Swiping in from the left edge goes back, as on any pushed page.
  const edge = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => g.dx > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) =>
          push.setValue(Math.max(0, Math.min(1, g.dx / width))),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > width * 0.33 || g.vx > 0.6) closeReader();
          else
            Animated.spring(push, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 0,
            }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(push, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 0,
          }).start(),
      }),
    [push, width, closeReader],
  );

  // Tapping the Quran tab while reading goes back to its home.
  const navigation = useNavigation();
  const focused = useIsFocused();
  useEffect(() => {
    const off = (
      navigation as unknown as {
        addListener: (e: string, f: () => void) => () => void;
      }
    ).addListener("tabPress", () => {
      if (focused) closeReader();
    });
    return off;
  }, [navigation, focused, closeReader]);

  // The screen stays on while the mushaf is open (if chosen), and sleeps as usual elsewhere.
  useEffect(() => {
    if (!reading || !focused || !display.keepAwake) return;
    activateKeepAwakeAsync("quran-reader").catch(() => {});
    return () => {
      deactivateKeepAwake("quran-reader");
    };
  }, [reading, focused, display.keepAwake]);

  // A page counts towards today once it has been open a little while, with the app in front.
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setActive(s === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!reading || !focused || !active) return;
    const id = setTimeout(() => progress.markRead(page), READ_AFTER_MS);
    return () => clearTimeout(id);
  }, [page, reading, focused, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // The tab bar is hidden while the mushaf is open, and back when leaving the tab.
  useFocusEffect(
    useCallback(() => {
      setStatusBarHidden(false, "none");
      setImmersive(readingRef.current);
      return () => {
        setImmersive(false);
      };
    }, []),
  );
  useEffect(() => {
    if (focused)
      setStatusBarStyle((reading ? dark : appDark) ? "light" : "dark", true);
  }, [focused, reading, dark, appDark]);

  // ---- Playback on the page ----
  const playingPage = r.surahId
    ? pageForAyah(r.surahId, r.ayahIndex + 1)
    : undefined;
  const [from, setFrom] = useState<WordRef | null>(null);
  // While a recitation plays the reader stays with it: pressing play, or the recitation moving on
  // to an ayah on another page, brings the reader back to the page being recited.
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (
      !reading ||
      !playingPage ||
      !r.isPlaying ||
      playingPage === pageRef.current
    )
      return;
    jumpTo(playingPage);
    // Every new ayah, not only a new page: reading elsewhere, the next ayah brings you back.
  }, [r.surahId, r.ayahIndex, r.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!r.surahId) setFrom(null);
  }, [r.surahId]);
  // Zooming in during a recitation goes to the word being recited. The reader's own jump can come
  // before the zoomed view has laid out, so the page is asked for again once it has (twice, as the
  // heights settle); the reader then centres the recited word.
  const playingRef = useRef<number | undefined>(undefined);
  playingRef.current = r.isPlaying ? playingPage : undefined;
  const zoomTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onZoomChange = useCallback(
    (z: boolean) => {
      setZoomed(z);
      zoomTimers.current.forEach(clearTimeout);
      zoomTimers.current = [];
      if (!z || !playingRef.current) return;
      for (const ms of [450, 1100]) {
        zoomTimers.current.push(
          setTimeout(() => {
            const p = playingRef.current;
            if (p) jumpTo(p);
          }, ms),
        );
      }
    },
    [jumpTo],
  );
  useEffect(() => () => zoomTimers.current.forEach(clearTimeout), []);
  // A surah heard to its last ayah counts as read today.
  useEffect(() => {
    const s = r.surahId ? getSurah(r.surahId) : undefined;
    if (s && r.isPlaying && r.ayahIndex >= s.totalVerses - 1)
      progress.markHeard(s.id);
  }, [r.surahId, r.ayahIndex, r.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const openGoal = useCallback(
    (goal: Goal) => {
      setGoalsOpen(false);
      if (goal.target.kind === "surah")
        jumpTo(surahPages(goal.target.surah)[0]);
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
    if (r.repeat === "ayah") r.setRepeat("off");
    playFrom(first, pageRef.current);
  }, [playFrom, r]);

  // ---- Bookmarks ----
  const markPage = useCallback(
    (spot: { page: number; surahId: number; ayah: number }) => {
      haptic.success();
      AsyncStorage.setItem(LAST_COLOR_KEY, lastColor).catch(() => {});
      setPageBookmark(
        { ...spot, surahName: getSurah(spot.surahId)?.transliteration ?? "" },
        lastColor,
      );
    },
    [lastColor, setPageBookmark],
  );
  const bookmarkedPages = useMemo(
    () => bookmarks.map((b) => b.page).filter((p): p is number => p != null),
    [bookmarks],
  );
  const pageMark = bookmarkForPage(page);

  // ---- Meaning: the held ayah's explanation, its passage tinted on the page ----
  const [meaningAyah, setMeaningAyah] = useState<AyahRef | null>(null);
  const [focus, setFocus] = useState<{ from: number; to: number } | null>(null);
  const onPassage = useCallback(
    (first: AyahRef, last: AyahRef) => {
      setFocus({
        from: first.surah * 1000 + first.ayah,
        to: last.surah * 1000 + last.ayah,
      });
      // Reading on to a passage on another page turns the page to it.
      const p = pageForAyah(first.surah, first.ayah);
      if (p !== pageRef.current) jumpTo(p);
    },
    [jumpTo],
  );
  const closeMeaning = useCallback(() => {
    setMeaningAyah(null);
    setFocus(null);
  }, []);

  const onAction = useCallback(
    (action: ReaderAction, surah: number, ayah: number, onPage: number) => {
      if (action === "meaning") {
        haptic.select();
        setMeaningAyah({ surah, ayah });
      } else if (action === "play") {
        if (r.repeat === "ayah") r.setRepeat("off");
        playFrom({ surah, ayah }, onPage);
      } else if (action === "repeat") {
        r.setRepeat("ayah");
        playFrom({ surah, ayah }, onPage);
      } else if (action === "bookmark") {
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

  // A page that ends one surah and begins another is named for the one that begins.
  const surah = getSurah(
    surahsOnPage(page).slice(-1)[0] ?? surahForPage(page),
  )!;
  const juz = juzForPage(page);
  // The page fills the space between the top bar and the player, an equal gap from each. It keeps
  // that place when the controls hide.
  const topInset = insets.top + TOP_BAR + PAGE_GAP;
  const bottomInset = insets.bottom + PLAYER + PAGE_GAP;
  const capsule = {
    backgroundColor: dark ? "rgba(26, 27, 31, 0.94)" : "rgba(255, 253, 248, 0.94)",
    borderWidth: 1,
    borderColor: t.c.hairline,
  };

  const pageMenu = (
    <>
      <MenuButton
        label="Reading settings"
        systemImage="textformat.size"
        onPress={() => setDisplayOpen(true)}
      />
      <MenuDivider />
      {pageMark ? (
        <MenuButton
          label="Remove bookmark"
          systemImage="bookmark.slash"
          role="destructive"
          onPress={() => removeBookmark(pageMark)}
        />
      ) : (
        <MenuButton
          label="Bookmark this page"
          systemImage="bookmark"
          onPress={() => {
            const first = firstAyahOnPage(page);
            markPage({
              page,
              surahId: first?.surah ?? surah.id,
              ayah: first?.ayah ?? 1,
            });
          }}
        />
      )}
      <MenuButton
        label="Bookmarks"
        systemImage="list.bullet"
        onPress={() => setBookmarksOpen(true)}
      />
    </>
  );
  // Every surah on the page, as the mushaf's running head names them: "An-Nur and Al-Furqan".
  const pageTitle = surah.transliteration;

  const sheets = (
    <>
      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={surah.id}
        onSelect={(id) => leapTo(pageForSurah(id))}
        onSelectVerse={(key) => {
          const [s, a] = key.split(":").map(Number);
          leapTo(pageForAyah(s, a));
        }}
        onSelectPage={leapTo}
        palette={dark ? darkPalette : lightPalette}
      />
      <BookmarkSheet
        visible={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelect={(b: Bookmark) =>
          leapTo(b.page ?? pageForAyah(b.surahId, b.ayah))
        }
        onRemove={removeBookmark}
        palette={dark ? darkPalette : lightPalette}
      />
      <GoalsSheet
        visible={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        progress={progress}
        dark={appDark}
        onOpenGoal={openGoal}
      />
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <QuranHome
        dark={appDark}
        lastPage={page}
        progress={progress}
        bookmarks={bookmarks}
        onContinue={() => jumpTo(page)}
        onOpenPage={jumpTo}
        onOpenGoals={() => setGoalsOpen(true)}
      />
      {reading ? (
        <>
          {(
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: t.c.bg,
                    transform: [
                      {
                        translateX: push.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, width],
                        }),
                      },
                    ],
                  },
                ]}
              >
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
                    focus={focus}
                    display={display}
                    onZoomChange={onZoomChange}
                    colors={{ bg: t.c.bg, text: t.c.text, accent: t.c.accent, recited: t.c.info }}
                    onPageChange={setPage}
                    onTap={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.create(240, "easeInEaseOut", "opacity"),
                      );
                      setHidden((h) => !h);
                    }}
                    onAction={onAction}
                  />
                ) : null}

                {/* Flowing text fades out under the bars instead of running behind them. */}
                {display.view !== "mushaf" || zoomed ? (
                  <>
                    <EdgeFade edge="top" color={t.c.bg} height={insets.top + TOP_BAR + 36} solid={insets.top + TOP_BAR - 4} />
                    <EdgeFade edge="bottom" color={t.c.bg} height={insets.bottom + (hidden ? 110 : 170)} solid={insets.bottom + (hidden ? 70 : 128)} />
                  </>
                ) : null}

                {/* Surah (or surahs), juz and page; tap for the index and search. Focused, it widens to the
              full width and the back and options buttons step aside. */}
                <View
                  pointerEvents="box-none"
                  style={{
                    position: "absolute",
                    top: insets.top + 4,
                    left: t.spacing.md,
                    right: t.spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: t.spacing.sm,
                  }}
                >
                  {!hidden ? (
                    <PressableScale
                      haptic="select"
                      onPress={closeReader}
                      accessibilityRole="button"
                      accessibilityLabel="Quran home"
                      style={[
                        capsule,
                        { width: 44, height: 44, borderRadius: 22 },
                      ]}
                    >
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <SymbolView
                          name="chevron.backward"
                          size={16}
                          tintColor={t.c.text}
                          style={{ width: 20, height: 20 }}
                        />
                      </View>
                    </PressableScale>
                  ) : null}
                  <PressableScale
                    haptic="select"
                    onPress={() => setPickerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${pageTitle}, Juz ${juz}, page ${page}`}
                    accessibilityHint="Opens the surah index and search"
                    style={[capsule, { flex: 1, height: 44, borderRadius: 22 }]}
                  >
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: t.spacing.lg,
                        gap: t.spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text
                            variant="subhead"
                            numberOfLines={1}
                            style={{ fontWeight: "600", flexShrink: 1 }}
                            maxFontSizeMultiplier={1.3}
                          >
                            {pageTitle}
                          </Text>
                          <SymbolView
                            name="chevron.down"
                            size={11}
                            tintColor={t.c.textSecondary}
                          />
                        </View>
                        <Text
                          variant="caption"
                          color="textSecondary"
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.3}
                        >
                          Juz {juz}
                        </Text>
                      </View>
                      <Text
                        variant="subhead"
                        color="textSecondary"
                        numberOfLines={1}
                        style={{ fontVariant: ["tabular-nums"] }}
                        maxFontSizeMultiplier={1.3}
                      >
                        {hidden ? `Page ${page}` : page}
                      </Text>
                    </View>
                  </PressableScale>
                  {!hidden ? (
                    <NativeMenu
                      width={44}
                      height={44}
                      colorScheme={dark ? "dark" : "light"}
                      items={pageMenu}
                    >
                      <View
                        style={[
                          capsule,
                          {
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                        accessibilityLabel="Page options"
                      >
                        <SymbolView
                          name="ellipsis"
                          size={17}
                          tintColor={t.c.text}
                          style={{ width: 22, height: 22 }}
                        />
                      </View>
                    </NativeMenu>
                  ) : null}
                </View>

                {/* The player over the foot of the page; focused, a small capsule of search, the page's
              options and play. */}
                {!hidden ? (
                  <View
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      left: t.spacing.md,
                      right: t.spacing.md,
                      bottom: insets.bottom + t.spacing.sm,
                      gap: t.spacing.sm,
                    }}
                  >
                    <PagePlayer
                      onPlayPage={playPage}
                      onMeaning={() =>
                        r.surahId &&
                        setMeaningAyah({
                          surah: r.surahId,
                          ayah: r.ayahIndex + 1,
                        })
                      }
                    />
                    {/* Every page as a strip, and search. */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
                      <View style={[capsule, { flex: 1, height: 56, borderRadius: 28, overflow: "hidden" }]}>
                        <PageScroller page={page} onPage={leapTo} />
                      </View>
                      <PressableScale haptic="select" onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Search">
                        <View style={[capsule, { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" }]}>
                          <SymbolView name="magnifyingglass" size={19} tintColor={t.c.text} style={{ width: 24, height: 24 }} />
                        </View>
                      </PressableScale>
                    </View>
                  </View>
                ) : (
                  // Focused: the page almost alone. The reading settings at the left, play at the right.
                  <View
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      left: t.spacing.lg,
                      right: t.spacing.lg,
                      bottom: insets.bottom + t.spacing.sm,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <PressableScale haptic="select" onPress={() => setDisplayOpen(true)} accessibilityRole="button" accessibilityLabel="Reading settings">
                      <View style={[capsule, { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }]}>
                        <SymbolView name="textformat.size" size={19} tintColor={t.c.text} style={{ width: 26, height: 26 }} />
                      </View>
                    </PressableScale>
                    <PressableScale
                      haptic="light"
                      onPress={() => (r.surahId ? r.togglePlay() : playPage())}
                      accessibilityRole="button"
                      accessibilityLabel={r.isPlaying ? "Pause" : "Play from this page"}
                    >
                      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: t.c.accent, alignItems: "center", justifyContent: "center" }}>
                        <SymbolView
                          name={r.isPlaying ? "pause.fill" : "play.fill"}
                          size={22}
                          tintColor={t.c.onAccent}
                          style={{ width: 26, height: 26, marginLeft: r.isPlaying ? 0 : 3 }}
                        />
                      </View>
                    </PressableScale>
                  </View>
                )}

                {/* The left edge: swipe in to go back. */}
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: insets.top + 56,
                    bottom: 0,
                    width: 22,
                  }}
                  {...edge.panHandlers}
                />
              </Animated.View>
          )}
        </>
      ) : null}
      {sheets}
      <MeaningSheet
        ayah={meaningAyah}
        onClose={closeMeaning}
        onPassage={onPassage}
      />
      <ReaderSettingsSheet open={displayOpen} onClose={() => setDisplayOpen(false)} display={display} />
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
  focus: { from: number; to: number } | null;
  display: Display;
  onZoomChange: (zoomed: boolean) => void;
  colors: { bg: string; text: string; accent: string; recited: string };
  onPageChange: (page: number) => void;
  onTap: () => void;
  onAction: (
    action: ReaderAction,
    surah: number,
    ayah: number,
    page: number,
  ) => void;
}) {
  const r = useRecitation();
  const { word } = useRecitationProgress();
  // The word being recited. While it isn't known (the recording still loading, or a recitation
  // paused from an earlier session), it stays on the last word recited in this ayah, or the ayah's
  // first: one highlight, where it left off. Reciters timed only by the ayah light the ayah instead.
  const last = useRef({ key: "", word: 0 });
  const key = `${r.surahId}:${r.ayahIndex}`;
  let shown = word;
  if (word > 0) last.current = { key, word };
  else if (r.reciter.qdc)
    shown = last.current.key === key ? last.current.word : 1;
  const current: WordRef | null = r.surahId
    ? { surah: r.surahId, ayah: r.ayahIndex + 1, word: shown }
    : null;
  // The recited run starts where play began, or earlier if the recitation has gone back before it.
  const order = (w: WordRef) => w.surah * 1_000_000 + w.ayah * 1000 + w.word;
  const from =
    current && props.from && order(props.from) <= order(current)
      ? props.from
      : current
        ? { ...current, word: 1 }
        : null;
  return (
    <QuranReader
      style={{ flex: 1 }}
      page={props.page}
      pageNonce={props.nonce}
      dark={props.dark}
      current={current}
      from={from}
      bismillahSurah={r.inBismillah && r.surahId ? r.surahId : 0}
      follow={props.follow}
      topInset={props.topInset}
      bottomInset={props.bottomInset}
      surahTitles={TITLES}
      bookmarkedPages={props.bookmarkedPages}
      focusFrom={props.focus?.from ?? 0}
      focusTo={props.focus?.to ?? 0}
      view={props.display.view}
      backgroundHex={props.colors.bg}
      inkHex={props.colors.text}
      accentHex={props.colors.accent}
      recitedHex={props.colors.recited}
      textScale={props.display.textScale}
      showTranslit={props.display.translit}
      onTextScale={(scale) => props.display.set({ textScale: scale })}
      onZoomChange={props.onZoomChange}
      onPageChange={props.onPageChange}
      onTap={props.onTap}
      onAction={props.onAction}
    />
  );
}
