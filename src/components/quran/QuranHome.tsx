import { SymbolView } from 'expo-symbols';
import { QuranReader } from 'quran-reader';
import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSurah } from '../../data/surahs';
import { surahForPage } from '../../data/surahPages';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { bookmarkColor, type Bookmark } from '../../hooks/useBookmarks';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { todaySummary, type Goal } from '../../quran/goals';
import { firstAyahOnPage } from '../../quran/pageLayout';
import type { QuranProgress } from '../../quran/useQuranProgress';
import { QURAN_FONT } from '../../recitation/format';
import { useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';
import { AddGoalItems } from './GoalsSheet';
import { GoalRings, ringColors } from './GoalRings';

const NO_PAGES: number[] = [];

/**
 * The Quran tab's first screen: where you left off, today's goals, and your bookmarks. One tap on
 * Continue and you're on the page.
 */
export function QuranHome({
  dark,
  lastPage,
  progress,
  bookmarks,
  onContinue,
  onOpenPage,
  onOpenGoals,
  onOpenGoal,
}: {
  dark: boolean;
  lastPage: number;
  progress: QuranProgress;
  bookmarks: Bookmark[];
  onContinue: () => void;
  onOpenPage: (page: number) => void;
  onOpenGoals: () => void;
  onOpenGoal: (goal: Goal) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const surah = getSurah(surahForPage(lastPage))!;
  const ayah = firstAyahOnPage(lastPage);
  const today = progress.statuses.filter((s) => s.today);
  const colors = ringColors(dark);
  const pill = dark ? { bg: '#E4E2FF', ink: '#17121F' } : { bg: '#4338CA', ink: '#FFFFFF' };
  const friday = new Date().getDay() === 5;
  const kahfGoal = progress.statuses.find((s) => s.goal.kind === 'surah' && s.goal.surah === 18);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.spacing.lg, paddingHorizontal: t.spacing.xl, paddingBottom: tabBar + t.spacing.xxxl }}
      contentInsetAdjustmentBehavior="never"
    >
      <Text variant="display" header>
        Salaam
      </Text>
      <Text variant="subhead" color="textSecondary" style={{ marginTop: t.spacing.xs }}>
        {todaySummary(progress.statuses)}
      </Text>

      {/* Where you left off: the page itself, then one tap back to it. */}
      <View style={{ marginTop: t.spacing.xl, borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.md }}>
        <PressableScale scaleTo={0.99} onPress={onContinue} accessibilityRole="button" accessibilityLabel={`Continue reading ${surah.transliteration}, page ${lastPage}`}>
          <View pointerEvents="none" style={{ height: 150, borderRadius: t.radii.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: dark ? '#111018' : '#F8F8FC' }}>
            <QuranReader
              style={{ flex: 1 }}
              preview
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

      <Listening onOpenPage={onOpenPage} lastPage={lastPage} />

      {friday && !(kahfGoal && kahfGoal.done) ? (
        <PressableScale scaleTo={0.99} onPress={() => onOpenPage(293)} accessibilityRole="button" accessibilityLabel="It's Friday. Read Al-Kahf" style={{ marginTop: t.spacing.md }}>
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

      {/* Today: a ring per goal due, and where each stands. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: t.spacing.xxl, marginBottom: t.spacing.sm }}>
        <Text variant="title2" header>
          Today
        </Text>
        {progress.goals.length ? (
          <PressableScale haptic="select" onPress={onOpenGoals} accessibilityRole="button" accessibilityLabel="All goals">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
              <Text variant="subhead" color="textSecondary" style={{ fontWeight: '600' }}>
                All Goals
              </Text>
              <SymbolView name="chevron.right" size={11} tintColor={t.c.textSecondary} />
            </View>
          </PressableScale>
        ) : null}
      </View>
      {progress.goals.length ? (
        <PressableScale scaleTo={0.99} onPress={onOpenGoals} accessibilityRole="button" accessibilityLabel="Today's goals" accessibilityHint="Opens all goals">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xl, borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.lg }}>
            <GoalRings progress={today.map((s) => s.progress)} size={112} dark={dark} />
            <View style={{ flex: 1, gap: t.spacing.sm }}>
              {(today.length ? today : progress.statuses).slice(0, 3).map((s, i) => (
                <View key={s.goal.id}>
                  <Text variant="caption" numberOfLines={1} style={{ color: today.length ? colors[i] : t.c.textSecondary, fontWeight: '600' }}>
                    {s.title}
                  </Text>
                  <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '700' }}>
                    {s.done ? 'Done' : s.detail}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </PressableScale>
      ) : (
        <View style={{ borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.lg, gap: t.spacing.md }}>
          <Text variant="subhead" color="textSecondary">
            A little each day goes a long way. Choose a few pages a day, a surah each night, or the whole Quran.
          </Text>
          <NativeMenu colorScheme={t.scheme} items={<AddGoalItems progress={progress} />}>
            <View style={{ height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.c.hairline, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }} accessibilityLabel="Add a goal">
              <SymbolView name="plus" size={14} tintColor={t.c.text} style={{ width: 16, height: 16 }} />
              <Text variant="body" style={{ fontWeight: '600' }}>
                Add a Goal
              </Text>
            </View>
          </NativeMenu>
        </View>
      )}

      {bookmarks.length ? (
        <>
          <Text variant="title2" header style={{ marginTop: t.spacing.xxl, marginBottom: t.spacing.sm }}>
            Bookmarks
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm }} style={{ marginHorizontal: -t.spacing.xl }}>
            <View style={{ width: t.spacing.xl - t.spacing.sm }} />
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
            <View style={{ width: t.spacing.xl - t.spacing.sm }} />
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

/** The recitation, when it's somewhere other than the page you were reading. */
function Listening({ lastPage, onOpenPage }: { lastPage: number; onOpenPage: (page: number) => void }) {
  const t = useTheme();
  const r = useRecitation();
  const { buffering } = useRecitationProgress();
  const surah = r.surahId ? getSurah(r.surahId) : undefined;
  if (!surah || surah.id === surahForPage(lastPage)) return null;
  return (
    <View style={{ marginTop: t.spacing.md, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, paddingLeft: t.spacing.lg, paddingRight: t.spacing.xs, minHeight: 64 }}>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {r.isPlaying ? 'Listening' : 'Continue listening'}
        </Text>
        <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }}>
          {surah.transliteration}, Ayah {r.ayahIndex + 1}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {r.reciter.name}
        </Text>
      </View>
      <PressableScale haptic="light" onPress={r.togglePlay} accessibilityRole="button" accessibilityLabel={r.isPlaying ? 'Pause' : 'Play'}>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {r.isPlaying && buffering ? (
            <ActivityIndicator color={t.c.text} />
          ) : (
            <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={20} tintColor={t.c.text} style={{ width: 24, height: 24 }} />
          )}
        </View>
      </PressableScale>
      <PressableScale haptic="select" onPress={() => onOpenPage(-1)} accessibilityRole="button" accessibilityLabel="Open the recitation in the reader">
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="book" size={18} tintColor={t.c.textSecondary} style={{ width: 22, height: 22 }} />
        </View>
      </PressableScale>
    </View>
  );
}
