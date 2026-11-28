import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSurah } from '../data/surahs';
import type { Reciter } from './reciters';

/** One continuous recording of a surah, and where each ayah starts and ends in it (ms). */
export interface SurahAudio {
  url: string;
  /** [from, to] per ayah, in order. Where the recording opens with its own Bismillah (and
   *  isti'adha), ayah 1 runs from the very start to take them in. */
  ayahs: [number, number][];
  /** Where ayah 1 itself begins (ms), when the recording opens with its own Bismillah. */
  intro?: number;
  /** Per ayah, when each word starts (ms), by word number from 1. Empty where the timing has none. */
  words: number[][];
  /** Per ayah, every word in the order recited, as [word, start ms]: a word the reciter goes back
   *  to appears again. Empty where the timing has none. */
  seq?: [number, number][][];
  /** Per ayah, where its last recited word ends (ms), where the timing has words. */
  lastWordEnd?: number[];
}

const KEY = 'athannow.recitation.surah.v6.';
const memory = new Map<string, SurahAudio>();
// A recording whose ayah 1 starts this far in opens with its own Bismillah.
const OWN_BISMILLAH_MS = 1500;

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** An ayah's timing as the sources give it: its span, and its word segments [word, from, to]. */
interface Timing {
  ayah: number;
  from: number;
  to: number;
  segments: number[][];
}

/** The recording from its ayah timings: spans, word starts, the recited order, and the opening. */
function build(url: string, timings: Timing[]): SurahAudio {
  const sorted = [...timings].sort((a, b) => a.ayah - b.ayah);
  const ayahs = sorted.map((v) => [v.from, v.to] as [number, number]);
  const segs = sorted.map((v) => v.segments.filter((s) => s.length >= 3 && Number.isFinite(s[0])));
  const words = segs.map((list) => {
    const starts: number[] = [];
    for (const s of list) {
      const n = Math.round(s[0]);
      if (n >= 1 && starts[n - 1] == null) starts[n - 1] = Math.round(s[s.length - 2]);
    }
    return starts;
  });
  const seq = segs.map((list) => list.map((s) => [Math.round(s[0]), Math.round(s[s.length - 2])] as [number, number]));
  const lastWordEnd = segs.map((list, i) => (list.length ? Math.round(list[list.length - 1][list[list.length - 1].length - 1]) : ayahs[i][1]));
  const audio: SurahAudio = { url, ayahs, words, seq, lastWordEnd };
  // Its own Bismillah before ayah 1: ayah 1 takes it in, and is lit as the Bismillah until it begins.
  if (ayahs.length && ayahs[0][0] > OWN_BISMILLAH_MS) {
    audio.intro = ayahs[0][0];
    ayahs[0] = [0, ayahs[0][1]];
  }
  return audio;
}

/** quran.com's recording of a surah and its ayah and word timings. */
async function loadQdc(reciter: number, surahId: number): Promise<SurahAudio> {
  const res = await fetchWithTimeout(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciter}/audio_files?chapter=${surahId}&segments=true`);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const file = ((await res.json()) as {
    audio_files?: { audio_url: string; verse_timings?: { verse_key: string; timestamp_from: number; timestamp_to: number; segments?: number[][] }[] }[];
  }).audio_files?.[0];
  if (!file?.audio_url || !file.verse_timings?.length) throw new Error('no audio');
  return build(
    file.audio_url,
    file.verse_timings.map((v) => ({ ayah: Number(v.verse_key.split(':')[1]), from: v.timestamp_from, to: v.timestamp_to, segments: v.segments ?? [] })),
  );
}

/**
 * The Quranic Universal Library's recording of a surah with its word segments (its public API, the
 * one its own player uses): reciters quran.com doesn't carry, timed word by word.
 */
async function loadQul(recitation: number, surahId: number): Promise<SurahAudio> {
  const count = getSurah(surahId)?.totalVerses ?? 300;
  const res = await fetchWithTimeout(`https://qul.tarteel.ai/api/v1/audio/surah_segments/${recitation}?surah=${surahId}&per_page=${count}`);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const d = (await res.json()) as { audio?: { url?: string }; segments?: Record<string, { time_from: number; time_to: number; segments?: number[][] }> };
  const url = d.audio?.url?.replace(/([^:])\/\/+/g, '$1/');
  if (!url || !d.segments) throw new Error('no audio');
  return build(
    url,
    Object.entries(d.segments).map(([key, v]) => ({ ayah: Number(key.split(':')[1]), from: v.time_from, to: v.time_to, segments: v.segments ?? [] })),
  );
}

/**
 * The recording and its timings: from quran.com, or from the Quranic Universal Library. The timings
 * are kept on the device after the first load; the audio streams, and iOS keeps what it has played.
 */
export async function loadSurahAudio(reciter: Reciter, surahId: number): Promise<SurahAudio> {
  const id = reciter.qul ? `qul${reciter.qul}:${surahId}` : `${reciter.qdc}:${surahId}`;
  const hit = memory.get(id);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(KEY + id);
    if (raw) {
      const saved = JSON.parse(raw) as SurahAudio;
      memory.set(id, saved);
      return saved;
    }
  } catch {
    // fetch it instead
  }
  const audio = reciter.qul ? await loadQul(reciter.qul, surahId) : await loadQdc(reciter.qdc ?? 7, surahId);
  memory.set(id, audio);
  AsyncStorage.setItem(KEY + id, JSON.stringify(audio)).catch(() => {});
  return audio;
}

/** Surahs recited with a Bismillah of their own before ayah 1 (Al-Fatihah's is its first ayah; At-Tawbah has none). */
export function opensWithBismillah(surahId: number): boolean {
  return surahId !== 1 && surahId !== 9;
}

/** The ayah index playing at `ms`. */
export function ayahIndexAt(audio: SurahAudio, ms: number): number {
  const a = audio.ayahs;
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (a[mid][0] <= ms) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The word (from 1) being recited at `ms` in ayah `index`, or 0 without word timing. It never
 *  steps back: where the reciter goes back to repeat words, it holds on the furthest word reached
 *  until they pass it. */
export function wordAt(audio: SurahAudio, index: number, ms: number): number {
  const seq = audio.seq?.[index];
  if (seq?.length) {
    let word = seq[0][0];
    for (const [w, start] of seq) {
      if (start > ms) break;
      if (w > word) word = w;
    }
    return word;
  }
  const starts = audio.words[index];
  if (!starts?.length) return 0;
  let word = 1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] != null && starts[i] <= ms) word = i + 1;
  }
  return word;
}
