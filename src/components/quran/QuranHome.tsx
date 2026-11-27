import { SymbolView } from 'expo-symbols';
import { QuranReader, type PageColor, type TextTone } from 'quran-reader';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSurah } from '../../data/surahs';
import { surahForPage } from '../../data/surahPages';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { bookmarkColor, type Bookmark } from '../../hooks/useBookmarks';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { firstAyahOnPage } from '../../quran/pageLayout';
import type { QuranProgress } from '../../quran/useQuranProgress';
import { QURAN_FONT } from '../../recitation/format';
import { GoalRings } from './GoalRings';
import { PagePlayer } from './PagePlayer';

const NO_PAGES: number[] = [];

/** Hadith on reciting and listening to the Quran, shown in turn on the home. */
const HADITH: { text: string; source: string }[] = [
  {
    text: 'The person who recites the Qur’an and masters it by heart will be with the noble righteous scribes in Heaven.',
    source: 'Sahih al-Bukhari 4937',
  },
  {
    text: 'The person who exerts himself to learn the Qur’an by heart and recites it with great difficulty will have a double reward.',
    source: 'Sahih al-Bukhari 4937',
  },
  { text: 'Whoever recites a verse will have a light on the Day of Resurrection.', source: 'Musnad Ahmad 8494' },
  { text: 'Whoever listens to a verse from the Book of Allah Almighty will have a multiplied reward.', source: 'Musnad Ahmad 8494' },
];
const HADITH_MS = 6000;

/**
 * The Quran tab's home: the title with goals at its right, a hadith on reciting and listening, and
 * where you left off (the page, one tap back to it, and the player), then bookmarks.
 */
export function QuranHome({
  dark,
  lastPage,
  progress,
  bookmarks,
  onContinue,
  onOpenPage,
  onOpenGoals,
  onPlayPage,
  onMeaning,
  pageColor,
  textTone,
}: {
  dark: boolean;
  pageColor: PageColor;
  textTone: TextTone;
  lastPage: number;
  progress: QuranProgress;
  bookmarks: Bookmark[];
  onContinue: () => void;
  onOpenPage: (page: number) => void;
  onOpenGoals: () => void;
  /** Plays from the top of the last page read. */
  onPlayPage: () => void;
  onMeaning: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? t.spacing.lg : t.spacing.xl;
  const surah = getSurah(surahForPage(lastPage))!;
  const ayah = firstAyahOnPage(lastPage);
  const today = progress.statuses.filter((s) => s.today);
  const open = today.filter((s) => !s.done).length;
  const pill = dark ? { bg: '#E4E2FF', ink: '#17121F' } : { bg: '#4338CA', ink: '#FFFFFF' };
  const friday = new Date().getDay() === 5;
  const kahfGoal = progress.statuses.find((s) => s.goal.target.kind === 'surah' && s.goal.target.surah === 18);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {/* The title and its one action, as on Calendar and Settings. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.spacing.md,
          paddingTop: insets.top + t.spacing.sm,
          paddingBottom: t.spacing.sm,
          paddingHorizontal: gutter,
          backgroundColor: t.c.bg,
        }}
      >
        <Text variant="title1" header maxFontSizeMultiplier={1.3} numberOfLines={1}>
          Quran
        </Text>
        <PressableScale
          haptic="select"
          onPress={onOpenGoals}
          accessibilityRole="button"
          accessibilityLabel={progress.goals.length ? `Goals, ${open ? `${open} to go today` : 'all done today'}` : 'Goals'}
          accessibilityHint="Opens your reading goals"
        >
          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: t.spacing.md, borderRadius: t.radii.control, backgroundColor: t.c.surface2 }}>
            {today.length ? (
              <GoalRings progress={today.map((s) => s.progress)} size={24} stroke={3.5} dark={dark} />
            ) : (
              <SymbolView name="target" size={17} tintColor={t.c.text} style={{ width: 20, height: 20 }} />
            )}
            <Text variant="subhead" style={{ fontWeight: '600' }}>
              Goals
            </Text>
          </View>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: t.spacing.sm, paddingBottom: tabBar + t.spacing.xxxl }} contentInsetAdjustmentBehavior="never">
        <HadithCard />

        <Text variant="title2" header style={{ marginTop: t.spacing.xxl, marginBottom: t.spacing.sm }}>
          Continue where you left off
        </Text>
        <View style={{ borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.md }}>
          <PressableScale scaleTo={0.99} onPress={onContinue} accessibilityRole="button" accessibilityLabel={`Continue reading ${surah.transliteration}, page ${lastPage}`}>
            <View pointerEvents="none" style={{ height: 150, borderRadius: t.radii.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: { night: '#000000', charcoal: '#1C1C1F', sepia: '#F4ECD8', paper: '#F8F8FC' }[pageColor] }}>
              <QuranReader
                style={{ flex: 1 }}
                preview
                pageColor={pageColor}
                textTone={textTone}
                page={lastPage}
                pageNonce={lastPage}
                dark={dark}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md, paddingHorizontal: t.spacing.xs, marginTop: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="title3" numberOfLines={1}>
                {surah.transliteration}
              </Text>
              <Text variant="footnote" color="textSecondary">
                Ayah {ayah?.ayah ?? 1}, Page {lastPage}
              </Text>
            </View>
            <Text style={{ fontFamily: QURAN_FONT, fontSize: 26, lineHeight: 48, color: t.c.text }}>{surah.arabicName}</Text>
          </View>
          <PressableScale haptic="light" onPress={onContinue} accessibilityRole="button" accessibilityLabel="Continue" style={{ marginTop: t.spacing.sm }}>
            <View style={{ height: 50, borderRadius: 25, backgroundColor: pill.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="body" style={{ color: pill.ink, fontWeight: '600' }}>
                Continue
              </Text>
            </View>
          </PressableScale>
        </View>
        <View style={{ marginTop: t.spacing.sm }}>
          <PagePlayer onPlayPage={onPlayPage} onMeaning={onMeaning} />
        </View>

        {friday && !(kahfGoal && kahfGoal.done) ? (
          <PressableScale scaleTo={0.99} onPress={() => onOpenPage(293)} accessibilityRole="button" accessibilityLabel="It's Friday. Read Al-Kahf" style={{ marginTop: t.spacing.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  It’s Friday
                </Text>
                <Text variant="headline">Al-Kahf</Text>
              </View>
              <Text style={{ fontFamily: QURAN_FONT, fontSize: 24, lineHeight: 44, color: t.c.text }}>الكهف</Text>
              <SymbolView name="chevron.right" size={13} tintColor={t.c.glyphQuiet} />
            </View>
          </PressableScale>
        ) : null}

        {bookmarks.length ? (
          <>
            <Text variant="title2" header style={{ marginTop: t.spacing.xxl, marginBottom: t.spacing.sm }}>
              Bookmarks
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm, paddingHorizontal: gutter }} style={{ marginHorizontal: -gutter }}>
              {bookmarks.slice(0, 12).map((b) => (
                <PressableScale key={`${b.page}-${b.createdAt}`} scaleTo={0.97} onPress={() => b.page && onOpenPage(b.page)} accessibilityRole="button" accessibilityLabel={`${b.surahName}, page ${b.page}`}>
                  <View style={{ minWidth: 120, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.md, gap: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bookmarkColor(b) }} />
                    <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }}>
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

/** One hadith at a time, fading to the next every few seconds; tap for the next. Still under Reduce Motion. */
function HadithCard() {
  const t = useTheme();
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const go = (next: number) => {
    if (t.reduceMotion) {
      setIndex(next);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setIndex(next);
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    if (t.reduceMotion) return;
    const id = setInterval(() => go((index + 1) % HADITH.length), HADITH_MS);
    return () => clearInterval(id);
  }, [index, t.reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = HADITH[index];
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={() => go((index + 1) % HADITH.length)}
      accessibilityRole="button"
      accessibilityLabel={`${h.text} ${h.source}`}
      accessibilityHint="Shows the next hadith"
    >
      <View style={{ borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.lg, minHeight: 150 }}>
        <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
          The Prophet ﷺ said
        </Text>
        <Animated.View style={{ opacity: fade, flex: 1, justifyContent: 'space-between' }}>
          <Text variant="headline" style={{ marginTop: t.spacing.sm, lineHeight: 26 }}>
            “{h.text}”
          </Text>
          <Text variant="footnote" color="textSecondary" style={{ marginTop: t.spacing.md }}>
            {h.source}
          </Text>
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: t.spacing.md }}>
          {HADITH.map((_, i) => (
            <View key={i} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? t.c.text : t.c.hairline }} />
          ))}
        </View>
      </View>
    </PressableScale>
  );
}
