import { DatePicker, Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SURAHS } from '../../data/surahs';
import { TOTAL_PAGES } from '../../data/surahPages';
import { PressableScale } from '../../design/PressableScale';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { Sheet, SheetIconButton } from '../Sheet';
import { dayKey, fromKey, GOAL_SUGGESTIONS, goalTitle, surahPages, type GoalSchedule, type GoalTarget, type NewGoal } from '../../quran/goals';
import { TapTarget } from '../recitation/TapTarget';

type What = GoalTarget['kind'];
type When = GoalSchedule['kind'];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function inDays(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * A new goal, built from its parts: what to read (pages, juz, a surah, the whole Quran), how much,
 * and when (every day, on chosen days, by a date, or in your own time).
 */
export function GoalEditor({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (goal: NewGoal) => void }) {
  const t = useTheme();
  const [what, setWhat] = useState<What>('pages');
  const [count, setCount] = useState(2);
  const [surah, setSurah] = useState(67);
  const [when, setWhen] = useState<When>('daily');
  const [days, setDays] = useState<number[]>([5]);
  const [by, setBy] = useState<Date>(inDays(29));

  // Fresh each time it opens.
  useEffect(() => {
    if (!visible) return;
    setWhat('pages');
    setCount(2);
    setSurah(67);
    setWhen('daily');
    setDays([5]);
    setBy(inDays(29));
  }, [visible]);

  // The whole Quran is a goal in all: by a date or in your own time.
  useEffect(() => {
    if (what === 'quran' && (when === 'daily' || when === 'days')) setWhen('by');
  }, [what, when]);

  const max = what === 'juz' ? 30 : TOTAL_PAGES;
  const goal = useMemo<NewGoal>(() => {
    const target: GoalTarget = what === 'pages' ? { kind: 'pages', count } : what === 'juz' ? { kind: 'juz', count } : what === 'surah' ? { kind: 'surah', surah } : { kind: 'quran' };
    const schedule: GoalSchedule = when === 'days' ? { kind: 'days', days } : when === 'by' ? { kind: 'by', date: dayKey(by) } : { kind: when };
    return { target, schedule };
  }, [what, count, surah, when, days, by]);

  const valid = when !== 'days' || days.length > 0;
  const pagesInAll = what === 'pages' ? count : what === 'juz' ? count * 20 : what === 'surah' ? surahPages(surah).length : TOTAL_PAGES;
  const daysLeft = Math.max(1, Math.round((fromKey(dayKey(by)).getTime() - fromKey(dayKey()).getTime()) / 86400000) + 1);
  const explain =
    when === 'by'
      ? `About ${Math.ceil(pagesInAll / daysLeft)} ${Math.ceil(pagesInAll / daysLeft) === 1 ? 'page' : 'pages'} a day for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`
      : when === 'open'
        ? 'No due dates. Your progress builds as you read.'
        : when === 'days'
          ? days.length
            ? `Due on ${[...days].sort().map((d) => DAY_NAMES[d]).join(', ')}.`
            : 'Choose at least one day.'
          : 'Due every day.';

  const card = { borderRadius: t.radii.card, borderCurve: 'continuous' as const, backgroundColor: t.c.surface1, padding: t.spacing.lg };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New goal"
      headerRight={
        <SheetIconButton
          name="checkmark"
          label="Add goal"
          tint="accent"
          disabled={!valid}
          onPress={() => {
            onAdd(goal);
            onClose();
          }}
        />
      }
    >
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.xxxl * 2 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -t.spacing.xl, marginTop: t.spacing.md }} contentContainerStyle={{ gap: t.spacing.sm, paddingHorizontal: t.spacing.xl }}>
            {GOAL_SUGGESTIONS.map((s) => (
              <PressableScale
                key={s.label}
                haptic="select"
                onPress={() => {
                  const g = s.goal();
                  setWhat(g.target.kind);
                  if (g.target.kind === 'pages' || g.target.kind === 'juz') setCount(g.target.count);
                  if (g.target.kind === 'surah') setSurah(g.target.surah);
                  setWhen(g.schedule.kind);
                  if (g.schedule.kind === 'days') setDays(g.schedule.days);
                  if (g.schedule.kind === 'by') setBy(fromKey(g.schedule.date));
                }}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <View style={{ height: 36, paddingHorizontal: t.spacing.md, borderRadius: 18, borderWidth: 1, borderColor: t.c.hairline, justifyContent: 'center' }}>
                  <Text variant="subhead">{s.label}</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>

          <Text variant="footnote" color="textSecondary" header style={{ marginTop: t.spacing.xxl, marginBottom: t.spacing.sm, paddingHorizontal: t.spacing.xs }}>
            Read
          </Text>
          <View style={[card, { gap: t.spacing.lg }]}>
            <SegmentedControl<What>
              options={[
                { value: 'pages', label: 'Pages' },
                { value: 'juz', label: 'Juz' },
                { value: 'surah', label: 'Surah' },
                { value: 'quran', label: 'Quran' },
              ]}
              value={what}
              onChange={(v) => {
                setWhat(v);
                if (v === 'juz') setCount((c) => Math.min(c, 30));
              }}
            />
            {what === 'pages' || what === 'juz' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TapTarget haptic="select" disabled={count <= 1} onPress={() => setCount((c) => Math.max(1, c - 1))} accessibilityRole="button" accessibilityLabel="Fewer" style={{ borderRadius: 22, backgroundColor: t.c.surface2 }}>
                  <SymbolView name="minus" size={16} tintColor={count <= 1 ? t.c.glyphQuiet : t.c.text} />
                </TapTarget>
                <View accessible accessibilityRole="adjustable" accessibilityLabel={`${count} ${what === 'juz' ? 'juz' : count === 1 ? 'page' : 'pages'}`} style={{ alignItems: 'center' }}>
                  <Text variant="title1" style={{ fontVariant: ['tabular-nums'] }}>
                    {count}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {what === 'juz' ? 'juz' : count === 1 ? 'page' : 'pages'}
                  </Text>
                </View>
                <TapTarget haptic="select" disabled={count >= max} onPress={() => setCount((c) => Math.min(max, c + 1))} accessibilityRole="button" accessibilityLabel="More" style={{ borderRadius: 22, backgroundColor: t.c.surface2 }}>
                  <SymbolView name="plus" size={16} tintColor={count >= max ? t.c.glyphQuiet : t.c.text} />
                </TapTarget>
              </View>
            ) : what === 'surah' ? (
              <Host matchContents={{ vertical: true }} colorScheme={t.scheme} style={{ minHeight: 44 }}>
                <Picker label="Surah" selection={surah} onSelectionChange={(v: number) => setSurah(v)} modifiers={[pickerStyle('menu')]}>
                  {SURAHS.map((s) => (
                    <SwiftText key={s.id} modifiers={[tag(s.id)]}>
                      {`${s.id}. ${s.transliteration}`}
                    </SwiftText>
                  ))}
                </Picker>
              </Host>
            ) : (
              <Text variant="subhead" color="textSecondary">
                All 604 pages, from Al-Fatihah to An-Nas.
              </Text>
            )}
          </View>

          <Text variant="footnote" color="textSecondary" header style={{ marginTop: t.spacing.xxl, marginBottom: t.spacing.sm, paddingHorizontal: t.spacing.xs }}>
            When
          </Text>
          <View style={[card, { gap: t.spacing.lg }]}>
            <SegmentedControl<When>
              options={
                what === 'quran'
                  ? [
                      { value: 'by', label: 'By a date' },
                      { value: 'open', label: 'Any time' },
                    ]
                  : [
                      { value: 'daily', label: 'Every day' },
                      { value: 'days', label: 'Some days' },
                      { value: 'by', label: 'By a date' },
                      { value: 'open', label: 'Any time' },
                    ]
              }
              value={when}
              onChange={setWhen}
            />
            {when === 'days' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {DAY_LETTERS.map((letter, d) => {
                  const on = days.includes(d);
                  return (
                    <TapTarget
                      key={d}
                      size={40}
                      haptic="select"
                      onPress={() => setDays((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d]))}
                      accessibilityRole="button"
                      accessibilityLabel={DAY_NAMES[d]}
                      accessibilityState={{ selected: on }}
                      style={{ borderRadius: 20, backgroundColor: on ? t.c.accent : t.c.surface2 }}
                    >
                      <Text variant="subhead" style={{ fontWeight: '600', color: on ? t.c.onAccent : t.c.text }}>
                        {letter}
                      </Text>
                    </TapTarget>
                  );
                })}
              </View>
            ) : null}
            {when === 'by' ? (
              <Host matchContents={{ vertical: true }} colorScheme={t.scheme} style={{ minHeight: 44 }}>
                <DatePicker title="Finish by" selection={by} displayedComponents={['date']} range={{ start: inDays(1) }} onDateChange={setBy} />
              </Host>
            ) : null}
            <Text variant="footnote" color="textSecondary">
              {explain}
            </Text>
          </View>

          <View style={[card, { marginTop: t.spacing.xxl, alignItems: 'center' }]}>
            <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Your goal
            </Text>
            <Text variant="title3" style={{ textAlign: 'center', marginTop: 2 }}>
              {goalTitle(goal)}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Sheet>
  );
}
