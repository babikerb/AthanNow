import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dayKey, EMPTY_LOG, goalStatus, upgradeGoal, type Goal, type GoalStatus, type NewGoal, type ReadingLog } from './goals';

const GOALS_KEY = 'athannow.quran.goals.v1';
const LOG_KEY = 'athannow.quran.reading.v1';
// Days of reading kept: enough for a long khatm goal, small enough to stay quick.
const KEEP_DAYS = 400;

export interface QuranProgress {
  goals: Goal[];
  statuses: GoalStatus[];
  addGoal: (goal: NewGoal) => void;
  removeGoal: (id: string) => void;
  /** A page has been read for a while today. */
  markRead: (page: number) => void;
  /** A surah's recitation reached its end today. */
  markHeard: (surah: number) => void;
}

/** Goals and the reading towards them, saved on the device. */
export function useQuranProgress(): QuranProgress {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [log, setLog] = useState<ReadingLog>(EMPTY_LOG);
  const [ready, setReady] = useState(false);
  // The date rolls over while the app is open, so statuses are worked out against a clock that ticks.
  const [today, setToday] = useState(dayKey());

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(GOALS_KEY), AsyncStorage.getItem(LOG_KEY)])
      .then(([g, l]) => {
        if (g) setGoals((JSON.parse(g) as unknown[]).map(upgradeGoal).filter((x): x is Goal => !!x));
        if (l) setLog({ ...EMPTY_LOG, ...JSON.parse(l) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const id = setInterval(() => setToday(dayKey()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals)).catch(() => {});
  }, [goals, ready]);

  // Written a moment after the last change, so turning pages doesn't write on every one.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => AsyncStorage.setItem(LOG_KEY, JSON.stringify(log)).catch(() => {}), 800);
  }, [log, ready]);

  const trim = (days: Record<string, number[]>) => {
    const keys = Object.keys(days).sort();
    if (keys.length <= KEEP_DAYS) return days;
    const out: Record<string, number[]> = {};
    for (const k of keys.slice(-KEEP_DAYS)) out[k] = days[k];
    return out;
  };

  const markRead = useCallback((page: number) => {
    const key = dayKey();
    setLog((l) => {
      const list = l.days[key] ?? [];
      if (list.includes(page)) return l;
      return { ...l, days: trim({ ...l.days, [key]: [...list, page] }) };
    });
  }, []);

  const markHeard = useCallback((surah: number) => {
    const key = dayKey();
    setLog((l) => {
      const list = l.heard[key] ?? [];
      if (list.includes(surah)) return l;
      return { ...l, heard: trim({ ...l.heard, [key]: [...list, surah] }) };
    });
  }, []);

  const addGoal = useCallback((goal: NewGoal) => {
    setGoals((gs) => [...gs, { ...goal, id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, startedOn: dayKey(), createdAt: Date.now() }]);
  }, []);
  const removeGoal = useCallback((id: string) => setGoals((gs) => gs.filter((g) => g.id !== id)), []);

  const statuses = useMemo(() => goals.map((g) => goalStatus(g, log)), [goals, log, today]); // eslint-disable-line react-hooks/exhaustive-deps

  return { goals, statuses, addGoal, removeGoal, markRead, markHeard };
}
