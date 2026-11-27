import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reciter } from './reciters';

/** One continuous recording of a surah, and where each ayah starts and ends in it (ms). */
export interface SurahAudio {
  url: string;
  /** [from, to] per ayah, in order. The Bismillah, where recited, is part of ayah 1. */
  ayahs: [number, number][];
}

const KEY = 'athannow.recitation.surah.v1.';
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
  audio_files?: { audio_url: string; verse_timings?: { verse_key: string; timestamp_from: number; timestamp_to: number }[] }[];
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
  const res = await fetchWithTimeout(`https://api.qurancdn.com/api/qdc/audio/reciters/${reciter.qdc}/audio_files?chapter=${surahId}&segments=false`);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const file = ((await res.json()) as Response_).audio_files?.[0];
  if (!file?.audio_url || !file.verse_timings?.length) throw new Error('no audio');
  const ayahs = [...file.verse_timings]
    .sort((a, b) => Number(a.verse_key.split(':')[1]) - Number(b.verse_key.split(':')[1]))
    .map((v) => [v.timestamp_from, v.timestamp_to] as [number, number]);
  const audio = { url: file.audio_url, ayahs };
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
