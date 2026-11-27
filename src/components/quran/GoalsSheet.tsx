import { Button as MenuButton, Section as MenuSection } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { GOAL_TEMPLATES, todayHeadline, todaySummary, type Goal, type GoalStatus } from '../../quran/goals';
import type { QuranProgress } from '../../quran/useQuranProgress';
import { NativeMenu } from '../NativeMenu';
import { GoalRings, ringColors } from './GoalRings';

/** The native menu of goals to add. */
export function AddGoalItems({ progress }: { progress: QuranProgress }) {
  return (
    <>
      {GOAL_TEMPLATES.map((group) => (
        <MenuSection key={group.section} title={group.section}>
          {group.items.map((item) => (
            <MenuButton key={item.label} label={item.label} onPress={() => progress.addGoal(item.make())} />
          ))}
        </MenuSection>
      ))}
    </>
  );
}

function GoalRow({ status, color, onOpen, onRemove, last }: { status: GoalStatus; color?: string; onOpen: () => void; onRemove: () => void; last: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.hairline }}>
      <PressableScale
        scaleTo={0.99}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${status.title}, ${status.detail}`}
        accessibilityHint="Opens it in the reader"
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm, paddingLeft: t.spacing.lg }}>
          {status.done ? (
            <SymbolView name="checkmark.circle.fill" size={24} tintColor={color ?? t.c.text} style={{ width: 26, height: 26 }} />
          ) : (
            <View style={{ width: 22, height: 22, margin: 2, borderRadius: 11, borderWidth: 2, borderColor: color ?? t.c.glyphQuiet }} />
          )}
          <View style={{ flex: 1 }}>
            <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
              {status.title}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {status.detail}
            </Text>
          </View>
        </View>
      </PressableScale>
      <NativeMenu
        colorScheme={t.scheme}
        items={
          <>
            <MenuButton label="Open in the reader" systemImage="book" onPress={onOpen} />
            <MenuButton label="Remove goal" systemImage="trash" role="destructive" onPress={onRemove} />
          </>
        }
      >
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Options for ${status.title}`}>
          <SymbolView name="ellipsis" size={15} tintColor={t.c.textSecondary} style={{ width: 20, height: 20 }} />
        </View>
      </NativeMenu>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.xxl }}>
      <Text variant="footnote" color="textSecondary" header style={{ paddingHorizontal: t.spacing.xs, marginBottom: t.spacing.sm }}>
        {title}
      </Text>
      <View style={{ borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** All goals: today's rings large, what each needs, and goals kept in your own time. */
export function GoalsSheet({ visible, onClose, progress, dark, onOpenGoal }: { visible: boolean; onClose: () => void; progress: QuranProgress; dark: boolean; onOpenGoal: (goal: Goal) => void }) {
  const t = useTheme();
  const today = progress.statuses.filter((s) => s.today);
  const later = progress.statuses.filter((s) => !s.today);
  const colors = ringColors(dark);

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
          <NativeMenu colorScheme={t.scheme} items={<AddGoalItems progress={progress} />}>
            <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel="Add a goal">
              <SymbolView name="plus" size={15} tintColor={t.c.accentText} style={{ width: 18, height: 18 }} />
              <Text variant="body" color="accentText" style={{ fontWeight: '600' }}>
                Add Goal
              </Text>
            </View>
          </NativeMenu>
          <PressableScale haptic="select" onPress={onClose} accessibilityRole="button" accessibilityLabel="Done">
            <View style={{ height: 44, justifyContent: 'center' }}>
              <Text variant="body" style={{ fontWeight: '600' }}>
                Done
              </Text>
            </View>
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.xxxl * 2 }}>
          <Text variant="title1" header style={{ marginTop: t.spacing.md }}>
            {todayHeadline(progress.statuses)}
          </Text>
          <Text variant="subhead" color="textSecondary" style={{ marginTop: t.spacing.xs }}>
            {todaySummary(progress.statuses)}
          </Text>

          {today.length ? (
            <View style={{ alignItems: 'center', marginTop: t.spacing.xxl }}>
              <GoalRings progress={today.map((s) => s.progress)} size={200} dark={dark} />
            </View>
          ) : null}

          {today.length ? (
            <Group title="Today">
              {today.map((s, i) => (
                <GoalRow
                  key={s.goal.id}
                  status={s}
                  color={i < 4 ? colors[i] : undefined}
                  last={i === today.length - 1}
                  onOpen={() => onOpenGoal(s.goal)}
                  onRemove={() => progress.removeGoal(s.goal.id)}
                />
              ))}
            </Group>
          ) : null}

          {later.length ? (
            <Group title="In Your Own Time">
              {later.map((s, i) => (
                <GoalRow key={s.goal.id} status={s} last={i === later.length - 1} onOpen={() => onOpenGoal(s.goal)} onRemove={() => progress.removeGoal(s.goal.id)} />
              ))}
            </Group>
          ) : null}

          {!progress.goals.length ? (
            <View style={{ alignItems: 'center', marginTop: t.spacing.xxxl, gap: t.spacing.sm }}>
              <SymbolView name="target" size={30} tintColor={t.c.glyphQuiet} />
              <Text variant="headline" style={{ textAlign: 'center' }}>
                No goals yet
              </Text>
              <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
                Add Goal above: a few pages a day, a surah each night, or the whole Quran.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
