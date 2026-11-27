import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reciter } from './reciters';

/** One continuous recording of a surah, and where each ayah starts and ends in it (ms). */
export interface SurahAudio {
  url: string;
  /** [from, to] per ayah, in order. The Bismillah, where recited, is part of ayah 1. */
  ayahs: [number, number][];
  /** Per ayah, when each word starts (ms), by word number from 1. Empty where the timing has none. */
  words: number[][];
}

const KEY = 'athannow.recitation.surah.v2.';
const memory = new Map<string, SurahAudio>();

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface Response_ {
  audio_files?: { audio_url: string; verse_timings?: { verse_key: string; timestamp_from: number; timestamp_to: number; segments?: number[][] }[] }[];
}

/**
 * The recording and its ayah timings, from quran.com's audio API. The timings are kept on the
 * device after the first load; the audio streams, and iOS keeps what it has played.
 */
export async function loadSurahAudio(reciter: Reciter, surahId: number): Promise<SurahAudio> {
  const id = `${reciter.qdc}:${surahId}`;
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
  const res = await fetchWithTimeout(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciter.qdc}/audio_files?chapter=${surahId}&segments=true`);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const file = ((await res.json()) as Response_).audio_files?.[0];
  if (!file?.audio_url || !file.verse_timings?.length) throw new Error('no audio');
  const sorted = [...file.verse_timings].sort((a, b) => Number(a.verse_key.split(':')[1]) - Number(b.verse_key.split(':')[1]));
  const ayahs = sorted.map((v) => [v.timestamp_from, v.timestamp_to] as [number, number]);
  // Segments are [word, from, to] (word from 1); kept as each word's start, indexed by word - 1.
  const words = sorted.map((v) => {
    const starts: number[] = [];
    for (const seg of v.segments ?? []) {
      if (seg.length < 3) continue;
      const n = Math.round(seg[0]);
      if (n >= 1 && starts[n - 1] == null) starts[n - 1] = Math.round(seg[seg.length - 2]);
    }
    return starts;
  });
  const audio = { url: file.audio_url, ayahs, words };
  memory.set(id, audio);
  AsyncStorage.setItem(KEY + id, JSON.stringify(audio)).catch(() => {});
  return audio;
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

/** The word (from 1) being recited at `ms` in ayah `index`, or 0 without word timing. */
export function wordAt(audio: SurahAudio, index: number, ms: number): number {
  const starts = audio.words[index];
  if (!starts?.length) return 0;
  let word = 1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] != null && starts[i] <= ms) word = i + 1;
  }
  return word;
}
