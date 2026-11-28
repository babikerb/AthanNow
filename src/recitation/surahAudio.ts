import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reciter } from './reciters';

/** One continuous recording of a surah, and where each ayah starts and ends in it (ms). */
export interface SurahAudio {
  url: string;
  /** [from, to] per ayah, in order. The Bismillah, where recited, is part of ayah 1. */
  ayahs: [number, number][];
  /** Where ayah 1 itself begins (ms), when the recording opens with the Bismillah inside ayah 1. */
  intro?: number;
  /** Per ayah, when each word starts (ms), by word number from 1. Empty where the timing has none. */
  words: number[][];
  /** Per ayah, where its last word ends (ms), where the timing has words. */
  lastWordEnd?: number[];
}

const KEY = 'athannow.recitation.surah.v4.';
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
  const id = reciter.mp3quran ? `mp3q${reciter.mp3quran.read}:${surahId}` : `${reciter.qdc}:${surahId}`;
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
  if (reciter.mp3quran) {
    const audio = await loadMp3Quran(reciter.mp3quran, surahId);
    memory.set(id, audio);
    AsyncStorage.setItem(KEY + id, JSON.stringify(audio)).catch(() => {});
    return audio;
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
  const lastWordEnd = sorted.map((v) => {
    const segs = (v.segments ?? []).filter((seg) => seg.length >= 3);
    return segs.length ? Math.round(segs[segs.length - 1][segs[segs.length - 1].length - 1]) : v.timestamp_to;
  });
  const audio = { url: file.audio_url, ayahs, words, lastWordEnd };
  memory.set(id, audio);
  AsyncStorage.setItem(KEY + id, JSON.stringify(audio)).catch(() => {});
  return audio;
}

/**
 * mp3quran.net: the surah's recording from the reciter's folder, and each ayah's timing. Ayah 1 is
 * taken from the very start, so the isti'adha and Bismillah before it play with it.
 */
async function loadMp3Quran(source: { read: number; folder: string }, surahId: number): Promise<SurahAudio> {
  const res = await fetchWithTimeout(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${surahId}&read=${source.read}`);
  if (!res.ok) throw new Error(`timing ${res.status}`);
  const rows = ((await res.json()) as { ayah: number; start_time: number; end_time: number }[]).filter((r) => r.ayah >= 1).sort((a, b) => a.ayah - b.ayah);
  if (!rows.length) throw new Error('no timing');
  const ayahs = rows.map((r, i) => [i === 0 ? 0 : r.start_time, r.end_time] as [number, number]);
  return { url: `${source.folder}${String(surahId).padStart(3, '0')}.mp3`, ayahs, intro: rows[0].start_time, words: rows.map(() => []) };
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
