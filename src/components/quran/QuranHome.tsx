import { SymbolView } from "expo-symbols";
import { QuranReader } from "quran-reader";
import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getSurah } from "../../data/surahs";
import { surahForPage } from "../../data/surahPages";
import { PressableScale } from "../../design/PressableScale";
import { Text } from "../../design/Text";
import { useTheme } from "../../design/theme";
import { bookmarkColor, type Bookmark } from "../../hooks/useBookmarks";
import { useTabBarHeight } from "../../hooks/useTabBarHeight";
import { firstAyahOnPage, pageForAyah, surahsOnPage } from "../../quran/pageLayout";
import type { QuranProgress } from "../../quran/useQuranProgress";
import { QURAN_FONT } from "../../recitation/format";
import { useRecitation, useRecitationProgress } from "../../recitation/RecitationProvider";
import { GoalRings } from "./GoalRings";

const NO_PAGES: number[] = [];

/** Hadith on reciting and listening to the Quran, shown in turn on the home. */
const HADITH: { text: string; source: string }[] = [
  {
    text: "The person who recites the Qur’an and masters it by heart will be with the noble righteous scribes in Heaven.",
    source: "Sahih al-Bukhari 4937",
  },
  {
    text: "The person who exerts himself to learn the Qur’an by heart and recites it with great difficulty will have a double reward.",
    source: "Sahih al-Bukhari 4937",
  },
  {
    text: "Whoever recites a verse will have a light on the Day of Resurrection.",
    source: "Musnad Ahmad 8494",
  },
  {
    text: "Whoever listens to a verse from the Book of Allah Almighty will have a multiplied reward.",
    source: "Musnad Ahmad 8494",
  },
];
const HADITH_MS = 6000;
// The longest hadith sets the card's height.
const LONGEST = HADITH.reduce((best, h, i) => (h.text.length > HADITH[best].text.length ? i : best), 0);

/**
 * The Quran tab's home: the title with goals at its right, a hadith on reciting and listening, and
 * where you left off (the page, and one tap back to it), then bookmarks.
 */
export function QuranHome({
  dark,
  lastPage,
  progress,
  bookmarks,
  onContinue,
  onOpenPage,
  onOpenGoals,
}: {
  dark: boolean;
  lastPage: number;
  progress: QuranProgress;
  bookmarks: Bookmark[];
  onContinue: () => void;
  onOpenPage: (page: number) => void;
  onOpenGoals: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? t.spacing.lg : t.spacing.xl;
  const today = progress.statuses.filter((s) => s.today);
  const open = today.filter((s) => !s.done).length;
  const friday = new Date().getDay() === 5;
  const kahfGoal = progress.statuses.find(
    (s) => s.goal.target.kind === "surah" && s.goal.target.surah === 18,
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {/* The title and its one action, as on Calendar and Settings. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: t.spacing.md,
          paddingTop: insets.top + t.spacing.sm,
          paddingBottom: t.spacing.sm,
          paddingHorizontal: gutter,
          backgroundColor: t.c.bg,
        }}
      >
        <Text
          variant="title1"
          header
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
        >
          Quran
        </Text>
        <PressableScale
          haptic="select"
          onPress={onOpenGoals}
          accessibilityRole="button"
          accessibilityLabel={
            progress.goals.length
              ? `Goals, ${open ? `${open} to go today` : "all done today"}`
              : "Goals"
          }
          accessibilityHint="Opens your reading goals"
        >
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: t.spacing.md,
              borderRadius: t.radii.control,
              backgroundColor: t.c.surface2,
            }}
          >
            {today.length ? (
              <GoalRings
                progress={today.map((s) => s.progress)}
                size={24}
                stroke={3.5}
                dark={dark}
              />
            ) : (
              <SymbolView
                name="target"
                size={17}
                tintColor={t.c.text}
                style={{ width: 20, height: 20 }}
              />
            )}
            <Text variant="subhead" style={{ fontWeight: "600" }}>
              Goals
            </Text>
          </View>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: t.spacing.xs,
          paddingBottom: tabBar + t.spacing.lg,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        <HadithCard />

        <ContinueCard dark={dark} lastPage={lastPage} onContinue={onContinue} onOpenPage={onOpenPage} />

        {friday && !(kahfGoal && kahfGoal.done) ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => onOpenPage(293)}
            accessibilityRole="button"
            accessibilityLabel="It's Friday. Read Al-Kahf"
            style={{ marginTop: t.spacing.md }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.spacing.md,
                borderRadius: t.radii.card,
                borderCurve: "continuous",
                backgroundColor: t.c.surface1,
                paddingHorizontal: t.spacing.lg,
                paddingVertical: t.spacing.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={{ textTransform: "uppercase", letterSpacing: 0.8 }}
                >
                  It’s Friday
                </Text>
                <Text variant="headline">Al-Kahf</Text>
              </View>
              <Text
                style={{
                  fontFamily: QURAN_FONT,
                  fontSize: 24,
                  lineHeight: 44,
                  color: t.c.text,
                }}
              >
                الكهف
              </Text>
              <SymbolView
                name="chevron.right"
                size={13}
                tintColor={t.c.glyphQuiet}
              />
            </View>
          </PressableScale>
        ) : null}

        {bookmarks.length ? (
          <>
            <Text
              variant="headline"
              header
              style={{ marginTop: t.spacing.lg, marginBottom: t.spacing.sm }}
            >
              Bookmarks
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: t.spacing.sm,
                paddingHorizontal: gutter,
              }}
              style={{ marginHorizontal: -gutter }}
            >
              {bookmarks.slice(0, 12).map((b) => (
                <PressableScale
                  key={`${b.page}-${b.createdAt}`}
                  scaleTo={0.97}
                  onPress={() => b.page && onOpenPage(b.page)}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.surahName}, page ${b.page}`}
                >
                  <View
                    style={{
                      minWidth: 112,
                      borderRadius: t.radii.card,
                      borderCurve: "continuous",
                      backgroundColor: t.c.surface1,
                      paddingHorizontal: t.spacing.md,
                      paddingVertical: t.spacing.sm,
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: bookmarkColor(b),
                      }}
                    />
                    <Text
                      variant="subhead"
                      numberOfLines={1}
                      style={{ fontWeight: "600" }}
                    >
                      {b.surahName}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Page {b.page}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Where you left off: the last page read, and one tap back to it. While a recitation is playing it
 * becomes Listening now: the page being recited, its word lit as it goes, a way back to it, and pause.
 */
function ContinueCard({ dark, lastPage, onContinue, onOpenPage }: { dark: boolean; lastPage: number; onContinue: () => void; onOpenPage: (page: number) => void }) {
  const t = useTheme();
  const r = useRecitation();
  const { word } = useRecitationProgress();
  const listening = !!r.surahId && r.isPlaying;
  const page = listening ? pageForAyah(r.surahId!, r.ayahIndex + 1) : lastPage;
  const surah = getSurah(listening ? r.surahId! : (surahsOnPage(page).slice(-1)[0] ?? surahForPage(page)))!;
  const ayah = listening ? r.ayahIndex + 1 : (firstAyahOnPage(page)?.ayah ?? 1);
  const open = () => (listening ? onOpenPage(page) : onContinue());
  const current = listening ? { surah: r.surahId!, ayah: r.ayahIndex + 1, word: Math.max(word, r.reciter.qdc ? 1 : 0) } : null;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: t.spacing.lg, marginBottom: t.spacing.sm }}>
        {listening ? <SymbolView name="waveform" size={15} tintColor={t.c.accent} /> : null}
        <Text variant="headline" header>
          {listening ? "Listening now" : "Continue where you left off"}
        </Text>
      </View>
      <View style={{ borderRadius: t.radii.feature, borderCurve: "continuous", backgroundColor: t.c.surface1, padding: t.spacing.sm }}>
        <PressableScale scaleTo={0.99} onPress={open} accessibilityRole="button" accessibilityLabel={listening ? `Back to the recitation, ${surah.transliteration}, ayah ${ayah}` : `Continue reading ${surah.transliteration}, page ${page}`}>
          <View pointerEvents="none" style={{ height: 112, borderRadius: t.radii.card, borderCurve: "continuous", overflow: "hidden", backgroundColor: t.c.bg }}>
            <QuranReader
              style={{ flex: 1 }}
              preview
              backgroundHex={t.c.bg}
              inkHex={t.c.text}
              accentHex={t.c.accent}
              recitedHex={t.c.info}
              page={page}
              pageNonce={page}
              dark={dark}
              current={current}
              bismillahSurah={listening && r.inBismillah ? r.surahId! : 0}
              follow={false}
              topInset={0}
              bottomInset={0}
              surahTitles={[]}
              bookmarkedPages={NO_PAGES}
              onPageChange={() => {}}
              onTap={() => {}}
              onAction={() => {}}
            />
          </View>
        </PressableScale>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.md, paddingHorizontal: t.spacing.md, paddingTop: t.spacing.md, paddingBottom: t.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="headline" numberOfLines={1}>
              {surah.transliteration}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {listening ? `Ayah ${ayah}, ${r.reciter.name}` : `Ayah ${ayah}, Page ${page}`}
            </Text>
          </View>
          <Text style={{ fontFamily: QURAN_FONT, fontSize: 22, lineHeight: 40, color: t.c.text }}>{surah.arabicName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
          <PressableScale haptic="light" onPress={open} accessibilityRole="button" accessibilityLabel={listening ? "Back to the recitation" : "Continue"} style={{ flex: 1 }}>
            <View style={{ height: 44, borderRadius: 22, backgroundColor: t.c.accent, alignItems: "center", justifyContent: "center" }}>
              <Text variant="body" style={{ color: t.c.onAccent, fontWeight: "600" }}>
                {listening ? "Back to the recitation" : "Continue"}
              </Text>
            </View>
          </PressableScale>
          {listening ? (
            <PressableScale haptic="light" onPress={r.togglePlay} accessibilityRole="button" accessibilityLabel="Pause">
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.c.surface2, alignItems: "center", justifyContent: "center" }}>
                <SymbolView name="pause.fill" size={17} tintColor={t.c.text} style={{ width: 22, height: 22 }} />
              </View>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </>
  );
}

/** One hadith at a time, fading to the next every few seconds. Still under Reduce Motion. */
function HadithCard() {
  const t = useTheme();
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (t.reduceMotion) return;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setIndex((n) => (n + 1) % HADITH.length);
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    }, HADITH_MS);
    return () => clearInterval(id);
  }, [t.reduceMotion, fade]);

  const h = HADITH[index];
  return (
    <View
      accessible
      accessibilityLabel={`The Prophet said: ${h.text} ${h.source}`}
      style={{
        borderRadius: t.radii.feature,
        borderCurve: "continuous",
        backgroundColor: t.c.surface1,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md,
      }}
    >
      <Text variant="caption" color="textSecondary" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
        The Prophet ﷺ said
      </Text>
      {/* Every hadith is laid out in the same place, the longest setting the card's height, so the
          card never changes size as they turn; only the current one shows, centred between the
          heading and its source, which keeps to the card's foot. */}
      <View style={{ marginVertical: t.spacing.sm }}>
        {HADITH.map((x, i) => (
          <Animated.View
            key={i}
            importantForAccessibility="no"
            style={[
              { opacity: i === index ? fade : 0, justifyContent: "center" },
              i === LONGEST ? null : { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
            ]}
          >
            <Text variant="body" style={{ lineHeight: 22, fontWeight: "600" }}>
              “{x.text}”
            </Text>
          </Animated.View>
        ))}
      </View>
      <Animated.View style={{ opacity: fade }} importantForAccessibility="no">
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {h.source}
        </Text>
      </Animated.View>
    </View>
  );
}
