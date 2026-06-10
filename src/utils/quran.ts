import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Verse data comes from the quran-json CDN (jsDelivr) which serves Uthmani
 * Arabic text with no auth required. Chapters are cached on-device after first
 * fetch so reading works offline thereafter.
 */

export interface Verse {
  id: number; // ayah number within the surah
  text: string; // Uthmani Arabic
  transliteration: string;
}

const CDN = (chapterId: number) =>
  `https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/chapters/${chapterId}.json`;

const cacheKey = (chapterId: number) => `athannow.quran.chapter.${chapterId}.v1`;
const memory = new Map<number, Verse[]>();

export async function fetchChapterVerses(chapterId: number): Promise<Verse[]> {
  if (memory.has(chapterId)) return memory.get(chapterId)!;

  // Try on-device cache first.
  try {
    const cached = await AsyncStorage.getItem(cacheKey(chapterId));
    if (cached) {
      const verses: Verse[] = JSON.parse(cached);
      memory.set(chapterId, verses);
      return verses;
    }
  } catch {
    // ignore cache read errors
  }

  const res = await fetch(CDN(chapterId));
  if (!res.ok) throw new Error(`Failed to load surah ${chapterId}`);
  const json = (await res.json()) as { verses: Verse[] };
  const verses = json.verses;

  memory.set(chapterId, verses);
  AsyncStorage.setItem(cacheKey(chapterId), JSON.stringify(verses)).catch(() => {});
  return verses;
}

/** Eastern-Arabic numeral rendering for ayah-end markers. */
export function toArabicNumber(n: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('');
}
