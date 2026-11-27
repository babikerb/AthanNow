// Reading goals and what counts towards them. Everything stays on the device.
import { getSurah } from '../data/surahs';
import { SURAH_PAGES, TOTAL_PAGES } from '../data/surahPages';

export type Goal =
  /** A number of pages every day. */
  | { id: string; kind: 'pages'; pages: number; createdAt: number }
  /** A surah every day, every night, or every Friday. */
  | { id: string; kind: 'surah'; surah: number; when: 'day' | 'night' | 'friday'; createdAt: number }
  /** The whole Quran, by a number of days from the start, or in your own time. */
  | { id: string; kind: 'khatm'; days: number | null; startedOn: string; createdAt: number };

/** Pages read each day (a page counts after a little while on it), and surahs heard to the end. */
export interface ReadingLog {
  days: Record<string, number[]>;
  heard: Record<string, number[]>;
}

export const EMPTY_LOG: ReadingLog = { days: {}, heard: {} };

/** yyyy-mm-dd in local time. */
export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(fromKey: string, to: Date): number {
  const [y, m, d] = fromKey.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function surahPages(surah: number): number[] {
  const [a, b] = SURAH_PAGES[surah] ?? [1, 1];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function goalTitle(g: Goal): string {
  if (g.kind === 'pages') return g.pages === 1 ? 'A Page Each Day' : g.pages === 20 ? 'A Juz Each Day' : `${g.pages} Pages Each Day`;
  if (g.kind === 'surah') {
    const name = getSurah(g.surah)?.transliteration ?? `Surah ${g.surah}`;
    return `${name} ${g.when === 'night' ? 'Each Night' : g.when === 'friday' ? 'Each Friday' : 'Each Day'}`;
  }
  return g.days ? `The Quran in ${g.days} Days` : 'Finish the Quran';
}

export interface GoalStatus {
  goal: Goal;
  title: string;
  /** Due today: it counts towards today's rings. */
  today: boolean;
  done: boolean;
  /** 0..1 towards today (or, in your own time, towards the whole). */
  progress: number;
  /** "Done for today", "1 of 2 pages", "Due tonight", "42% of the Quran". */
  detail: string;
}

export function goalStatus(g: Goal, log: ReadingLog, now = new Date()): GoalStatus {
  const today = dayKey(now);
  const read = new Set(log.days[today] ?? []);
  const title = goalTitle(g);

  if (g.kind === 'pages') {
    const n = Math.min(read.size, g.pages);
    const done = n >= g.pages;
    return { goal: g, title, today: true, done, progress: n / g.pages, detail: done ? 'Done for today' : `${n} of ${g.pages} ${g.pages === 1 ? 'page' : 'pages'}` };
  }

  if (g.kind === 'surah') {
    const due = g.when !== 'friday' || now.getDay() === 5;
    const pages = surahPages(g.surah);
    const heard = (log.heard[today] ?? []).includes(g.surah);
    const covered = heard ? pages.length : pages.filter((p) => read.has(p)).length;
    const done = covered >= pages.length;
    const detail = !due ? 'Next Friday' : done ? 'Done for today' : covered > 0 ? `${covered} of ${pages.length} pages` : g.when === 'night' ? 'Due tonight' : 'Due today';
    return { goal: g, title, today: due, done: due && done, progress: due ? covered / pages.length : 0, detail };
  }

  // The whole Quran: every page read since the goal began, counted once.
  const since = new Set<number>();
  let beforeToday = 0;
  for (const [key, pages] of Object.entries(log.days)) {
    if (key < g.startedOn) continue;
    for (const p of pages) {
      if (!since.has(p)) {
        since.add(p);
        if (key < today) beforeToday += 1;
      }
    }
  }
  const total = since.size;
  if (!g.days) {
    const done = total >= TOTAL_PAGES;
    return { goal: g, title, today: false, done, progress: total / TOTAL_PAGES, detail: done ? 'Finished' : `${Math.floor((total / TOTAL_PAGES) * 100)}% of the Quran` };
  }
  const left = Math.max(1, g.days - daysBetween(g.startedOn, now));
  const target = Math.max(1, Math.ceil((TOTAL_PAGES - beforeToday) / left));
  const n = Math.min(target, total - beforeToday);
  const done = n >= target || total >= TOTAL_PAGES;
  return {
    goal: g,
    title,
    today: total < TOTAL_PAGES,
    done,
    progress: Math.max(0, n) / target,
    detail: total >= TOTAL_PAGES ? 'Finished' : done ? 'Done for today' : `${Math.max(0, n)} of ${target} pages today`,
  };
}

/** Goals to offer, as the native menu lists them. */
export const GOAL_TEMPLATES: { section: string; items: { label: string; make: () => Omit<Goal, 'id' | 'createdAt'> }[] }[] = [
  {
    section: 'Every day',
    items: [
      { label: 'A Page Each Day', make: () => ({ kind: 'pages', pages: 1 }) },
      { label: '2 Pages Each Day', make: () => ({ kind: 'pages', pages: 2 }) },
      { label: '5 Pages Each Day', make: () => ({ kind: 'pages', pages: 5 }) },
      { label: 'A Juz Each Day', make: () => ({ kind: 'pages', pages: 20 }) },
    ],
  },
  {
    section: 'A surah',
    items: [
      { label: 'Al-Mulk Each Night', make: () => ({ kind: 'surah', surah: 67, when: 'night' }) },
      { label: "Al-Waqi'ah Each Night", make: () => ({ kind: 'surah', surah: 56, when: 'night' }) },
      { label: 'Ya-Sin Each Day', make: () => ({ kind: 'surah', surah: 36, when: 'day' }) },
      { label: 'Al-Kahf Each Friday', make: () => ({ kind: 'surah', surah: 18, when: 'friday' }) },
    ],
  },
  {
    section: 'The whole Quran',
    items: [
      { label: 'In 30 Days', make: () => ({ kind: 'khatm', days: 30, startedOn: dayKey() }) },
      { label: 'In 60 Days', make: () => ({ kind: 'khatm', days: 60, startedOn: dayKey() }) },
      { label: 'In Your Own Time', make: () => ({ kind: 'khatm', days: null, startedOn: dayKey() }) },
    ],
  },
];

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
