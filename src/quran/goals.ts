// Reading goals and what counts towards them. A goal is what to read (some pages, some juz, a surah,
// or the whole Quran) and when (every day, on chosen days, by a date, or in your own time).
// Everything stays on the device.
import { getSurah } from '../data/surahs';
import { SURAH_PAGES, TOTAL_PAGES } from '../data/surahPages';

export type GoalTarget =
  | { kind: 'pages'; count: number }
  | { kind: 'juz'; count: number }
  | { kind: 'surah'; surah: number }
  | { kind: 'quran' };

export type GoalSchedule =
  /** The target each day. */
  | { kind: 'daily' }
  /** The target on these weekdays (0 is Sunday). */
  | { kind: 'days'; days: number[] }
  /** The target in all, by this date (yyyy-mm-dd), shared out over the days left. */
  | { kind: 'by'; date: string }
  /** The target in all, whenever. */
  | { kind: 'open' };

export interface Goal {
  id: string;
  target: GoalTarget;
  schedule: GoalSchedule;
  /** yyyy-mm-dd: reading from this day on counts towards a goal in all (by a date, own time). */
  startedOn: string;
  createdAt: number;
}

export type NewGoal = Pick<Goal, 'target' | 'schedule'>;

/** Pages read each day (a page counts after a little while on it), and surahs heard to the end. */
export interface ReadingLog {
  days: Record<string, number[]>;
  heard: Record<string, number[]>;
}

export const EMPTY_LOG: ReadingLog = { days: {}, heard: {} };

const JUZ_PAGES = 20;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** yyyy-mm-dd in local time. */
export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);
}

export function surahPages(surah: number): number[] {
  const [a, b] = SURAH_PAGES[surah] ?? [1, 1];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** The pages a target asks for, as a count of pages (a surah's or the Quran's pages in full). */
function targetPages(t: GoalTarget): number {
  if (t.kind === 'pages') return t.count;
  if (t.kind === 'juz') return t.count * JUZ_PAGES;
  if (t.kind === 'surah') return surahPages(t.surah).length;
  return TOTAL_PAGES;
}

function amount(t: GoalTarget): string {
  if (t.kind === 'pages') return t.count === 1 ? 'A Page' : `${t.count} Pages`;
  if (t.kind === 'juz') return t.count === 1 ? 'A Juz' : `${t.count} Juz`;
  if (t.kind === 'surah') return getSurah(t.surah)?.transliteration ?? `Surah ${t.surah}`;
  return 'The Quran';
}

export function shortDate(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dayList(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Each Day';
  if (sorted.length === 5 && sorted.every((d) => d >= 1 && d <= 5)) return 'On Weekdays';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'On Weekends';
  if (sorted.length === 1) return `Each ${WEEKDAYS[sorted[0]]}`;
  return `On ${sorted.map((d) => WEEKDAYS_SHORT[d]).join(', ')}`;
}

export function goalTitle(g: Pick<Goal, 'target' | 'schedule'>): string {
  const what = amount(g.target);
  switch (g.schedule.kind) {
    case 'daily':
      return `${what} Each Day`;
    case 'days':
      return `${what} ${dayList(g.schedule.days)}`;
    case 'by':
      return `${g.target.kind === 'quran' ? 'Finish the Quran' : what} by ${shortDate(g.schedule.date)}`;
    default:
      return g.target.kind === 'quran' ? 'Finish the Quran' : g.target.kind === 'surah' ? `Read ${what}` : `Read ${what}`;
  }
}

export interface GoalStatus {
  goal: Goal;
  title: string;
  /** Due today: it counts towards today's rings. */
  today: boolean;
  done: boolean;
  /** 0..1 towards today (or, in your own time, towards the whole). */
  progress: number;
  /** "Done for today", "1 of 2 pages", "Next on Friday", "42% read". */
  detail: string;
}

/** Pages of a target covered by a set of read pages (and, for a surah, hearing it in full). */
function covered(t: GoalTarget, read: Set<number>, heard: Set<number>): number {
  if (t.kind === 'surah') {
    const pages = surahPages(t.surah);
    return heard.has(t.surah) ? pages.length : pages.filter((p) => read.has(p)).length;
  }
  return read.size;
}

function nextDue(days: number[], from: Date): string {
  for (let i = 1; i <= 7; i++) {
    const d = (from.getDay() + i) % 7;
    if (days.includes(d)) return i === 1 ? 'Due tomorrow' : `Next on ${WEEKDAYS[d]}`;
  }
  return 'Not scheduled';
}

export function goalStatus(g: Goal, log: ReadingLog, now = new Date()): GoalStatus {
  const today = dayKey(now);
  const title = goalTitle(g);
  const need = targetPages(g.target);
  const unit = (n: number) => (n === 1 ? 'page' : 'pages');

  // Each day (or on chosen days): today's reading against the target.
  if (g.schedule.kind === 'daily' || g.schedule.kind === 'days') {
    const due = g.schedule.kind === 'daily' || g.schedule.days.includes(now.getDay());
    if (!due) return { goal: g, title, today: false, done: false, progress: 0, detail: nextDue(g.schedule.kind === 'days' ? g.schedule.days : [], now) };
    const n = Math.min(need, covered(g.target, new Set(log.days[today] ?? []), new Set(log.heard[today] ?? [])));
    const done = n >= need;
    return { goal: g, title, today: true, done, progress: n / need, detail: done ? 'Done for today' : `${n} of ${need} ${unit(need)}` };
  }

  // In all: every page read since the goal began, counted once.
  const all = new Set<number>();
  const allHeard = new Set<number>();
  const before = new Set<number>();
  const beforeHeard = new Set<number>();
  for (const [key, pages] of Object.entries(log.days)) {
    if (key < g.startedOn) continue;
    for (const p of pages) {
      all.add(p);
      if (key < today) before.add(p);
    }
  }
  for (const [key, surahs] of Object.entries(log.heard)) {
    if (key < g.startedOn) continue;
    for (const s of surahs) {
      allHeard.add(s);
      if (key < today) beforeHeard.add(s);
    }
  }
  const total = Math.min(need, covered(g.target, all, allHeard));
  if (total >= need) return { goal: g, title, today: false, done: true, progress: 1, detail: 'Finished' };

  if (g.schedule.kind === 'open') {
    return { goal: g, title, today: false, done: false, progress: total / need, detail: `${Math.floor((total / need) * 100)}% read` };
  }

  // By a date: what's left at the start of today, shared out over the days left (today included).
  const left = Math.max(1, daysBetween(today, g.schedule.date) + 1);
  const doneBefore = Math.min(need, covered(g.target, before, beforeHeard));
  const todayTarget = Math.max(1, Math.ceil((need - doneBefore) / left));
  const todayRead = Math.max(0, total - doneBefore);
  const done = todayRead >= todayTarget;
  const overdue = daysBetween(today, g.schedule.date) < 0;
  return {
    goal: g,
    title,
    today: true,
    done,
    progress: Math.min(1, todayRead / todayTarget),
    detail: overdue ? `${need - total} ${unit(need - total)} left` : done ? 'Done for today' : `${Math.min(todayRead, todayTarget)} of ${todayTarget} ${unit(todayTarget)} today`,
  };
}

/** A quick start in the goal editor; each fills it in, and can be changed before adding. */
export const GOAL_SUGGESTIONS: { label: string; goal: () => NewGoal }[] = [
  { label: 'A page a day', goal: () => ({ target: { kind: 'pages', count: 1 }, schedule: { kind: 'daily' } }) },
  { label: 'Al-Mulk each night', goal: () => ({ target: { kind: 'surah', surah: 67 }, schedule: { kind: 'daily' } }) },
  { label: 'Al-Kahf on Fridays', goal: () => ({ target: { kind: 'surah', surah: 18 }, schedule: { kind: 'days', days: [5] } }) },
  {
    label: 'The Quran in 30 days',
    goal: () => {
      const d = new Date();
      d.setDate(d.getDate() + 29);
      return { target: { kind: 'quran' }, schedule: { kind: 'by', date: dayKey(d) } };
    },
  },
];

/** Goals saved before goals were built from parts, in today's shape. */
export function upgradeGoal(raw: unknown): Goal | null {
  const g = raw as Record<string, unknown>;
  if (!g || typeof g !== 'object') return null;
  if (g.target && g.schedule) return g as unknown as Goal;
  const base = { id: String(g.id ?? Date.now()), createdAt: Number(g.createdAt ?? Date.now()) };
  const started = typeof g.startedOn === 'string' ? g.startedOn : dayKey(new Date(base.createdAt));
  if (g.kind === 'pages') return { ...base, startedOn: started, target: { kind: 'pages', count: Number(g.pages) || 1 }, schedule: { kind: 'daily' } };
  if (g.kind === 'surah') {
    return { ...base, startedOn: started, target: { kind: 'surah', surah: Number(g.surah) || 1 }, schedule: g.when === 'friday' ? { kind: 'days', days: [5] } : { kind: 'daily' } };
  }
  if (g.kind === 'khatm') {
    if (!g.days) return { ...base, startedOn: started, target: { kind: 'quran' }, schedule: { kind: 'open' } };
    const end = fromKey(started);
    end.setDate(end.getDate() + Number(g.days) - 1);
    return { ...base, startedOn: started, target: { kind: 'quran' }, schedule: { kind: 'by', date: dayKey(end) } };
  }
  return null;
}

/** The line under the greeting: what's done, then what's still open. */
export function todaySummary(statuses: GoalStatus[]): string {
  const due = statuses.filter((s) => s.today);
  if (!statuses.length) return 'Set a goal to keep the Quran close each day.';
  if (!due.length) return 'Nothing due today. Read in your own time.';
  const done = due.filter((s) => s.done);
  const open = due.filter((s) => !s.done);
  if (!open.length) return 'Everything for today is done.';
  const lead = done.length ? `${done.map((s) => s.title).join(' and ')} ${done.length === 1 ? 'is' : 'are'} done. ` : '';
  return `${lead}${open[0].title} is still open.`;
}

/** "One to Go Today", "All Done Today". */
export function todayHeadline(statuses: GoalStatus[]): string {
  const open = statuses.filter((s) => s.today && !s.done).length;
  if (!statuses.some((s) => s.today)) return 'Your Goals';
  if (open === 0) return 'All Done Today';
  const words = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  return `${words[open] ?? open} to Go Today`;
}
