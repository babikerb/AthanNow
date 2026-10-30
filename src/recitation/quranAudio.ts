import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reciter } from './reciters';

export interface Ayah {
  /** Position in the whole Quran (1 to 6236), which also names its audio file. */
  number: number;
  numberInSurah: number;
  arabic: string;
  translation: string;
}

/** [firstWord, endWord (exclusive), startMs, endMs]. One segment can cover two fast-spoken words. */
export type WordSegment = [number, number, number, number];

const TEXT_KEY = 'athannow.recitation.text.v1.';
const TIMING_KEY = 'athannow.recitation.timing.v1.';

/** Each reciter's own recording of one ayah. The Bismillah before a surah is Al-Fatihah 1 (ayah 1 overall). */
export function ayahAudioUrl(reciter: Reciter, ayahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.edition}/${ayahNumber}.mp3`;
}

const textCache = new Map<number, Ayah[]>();

interface EditionResponse {
  data: { ayahs: { number: number; numberInSurah: number; text: string }[] }[];
}

/**
 * Arabic (Uthmani) and Sahih International text for a surah. Kept on disk after the first load, so
 * a surah opened once reads offline and switching reciters never waits on the network for text.
 */
export async function loadSurahText(surahId: number): Promise<Ayah[]> {
  const hit = textCache.get(surahId);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(TEXT_KEY + surahId);
    if (raw) {
      const ayahs = JSON.parse(raw) as Ayah[];
      if (ayahs.length) {
        textCache.set(surahId, ayahs);
        return ayahs;
      }
    }
  } catch {
    // fall through to the network
  }
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,en.sahih`);
  if (!res.ok) throw new Error(`surah ${surahId}: ${res.status}`);
  const json = (await res.json()) as EditionResponse;
  const [arabic, english] = json.data;
  const ayahs: Ayah[] = arabic.ayahs.map((a, i) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    arabic: a.text,
    translation: english?.ayahs[i]?.text ?? '',
  }));
  textCache.set(surahId, ayahs);
  AsyncStorage.setItem(TEXT_KEY + surahId, JSON.stringify(ayahs)).catch(() => {});
  return ayahs;
}

const timingCache = new Map<string, Map<number, WordSegment[]> | null>();

/**
 * Word timing for a surah (numberInSurah -> segments), from QUL alignment data converted for
 * Tilawah. Null when the reciter has none or it can't be fetched: the player then simply doesn't
 * highlight words.
 */
export async function loadWordTiming(surahId: number, reciter: Reciter): Promise<Map<number, WordSegment[]> | null> {
  if (!reciter.wordTiming) return null;
  const key = `${reciter.edition}:${surahId}`;
  if (timingCache.has(key)) return timingCache.get(key) ?? null;
  const parse = (data: { ayah: number; segments: WordSegment[] }[]) => new Map(data.map((a) => [a.ayah, a.segments]));
  try {
    const raw = await AsyncStorage.getItem(TIMING_KEY + key);
    if (raw) {
      const map = parse(JSON.parse(raw));
      timingCache.set(key, map);
      return map;
    }
  } catch {
    // fall through to the network
  }
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/babikerb/tilawah@master/wordtiming/${reciter.edition}/${surahId}.json`);
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    const map = parse(JSON.parse(text));
    timingCache.set(key, map);
    AsyncStorage.setItem(TIMING_KEY + key, text).catch(() => {});
    return map;
  } catch {
    // Not cached as a miss for good: the next launch tries again.
    return null;
  }
}

/**
 * Splits Uthmani text into the words the timing data counts. Pause marks (U+06D6 to U+06ED) are
 * written as their own tokens but aren't spoken, so each is merged into the word before it (or,
 * at the very start of an ayah, the word after it). Splitting on spaces alone shifts every index
 * after the first mark: Ayat al-Kursi has 58 tokens but 50 timed words.
 */
export function splitAyahWords(text: string): string[] {
  const words: string[] = [];
  let leading = '';
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const markOnly = [...token].every((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x06d6 && code <= 0x06ed;
    });
    if (!markOnly) {
      words.push(leading + token);
      leading = '';
    } else if (words.length) words[words.length - 1] += ' ' + token;
    else leading += token + ' ';
  }
  if (leading) words.push(leading.trim());
  return words;
}

/** The written Bismillah opens ayah 1 of every surah except Al-Fatihah (where it is ayah 1) and At-Tawbah. */
export const hasBismillah = (surahId: number) => surahId !== 1 && surahId !== 9;
export const BISMILLAH_WORDS = 4;
