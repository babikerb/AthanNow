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

/**
 * Word lookup for the mushaf: `verseKey` -> array of words (split from the full
 * Uthmani text, which includes waqf marks). Lets the qcf4 page layout render the
 * richer quran-json orthography. Cached via fetchChapterVerses.
 */
const wordMapMemory = new Map<number, Record<string, string[]>>();

export async function fetchChapterWordMap(chapterId: number): Promise<Record<string, string[]>> {
  if (wordMapMemory.has(chapterId)) return wordMapMemory.get(chapterId)!;
  const verses = await fetchChapterVerses(chapterId);
  const map: Record<string, string[]> = {};
  for (const v of verses) {
    map[`${chapterId}:${v.id}`] = v.text.trim().split(/\s+/);
  }
  wordMapMemory.set(chapterId, map);
  return map;
}

/* ------------------------------------------------------------------ *
 * Full-text Arabic ayah search.
 * Loads the whole mushaf once (same quran-json CDN, ~1.5 MB, cached), builds a
 * diacritic-normalized index, and matches typed Arabic against it.
 * ------------------------------------------------------------------ */

export interface AyahHit {
  surahId: number;
  ayah: number;
  key: string;
  text: string;
  surahName: string;
}

const ALL_CDN = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran.json';
const ALL_KEY = 'athannow.quran.all.v1';

interface IndexedAyah extends AyahHit {
  norm: string;
}
let ayahIndex: IndexedAyah[] | null = null;
let indexPromise: Promise<IndexedAyah[]> | null = null;

// Strip harakat, Quranic annotation signs, superscript alef and tatweel, and fold
// alef/ya/ta-marbuta variants so the user can type plain Arabic without marks.
function normalizeArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildIndex(): Promise<IndexedAyah[]> {
  if (ayahIndex) return ayahIndex;
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    let chapters: any[] | null = null;
    try {
      const cached = await AsyncStorage.getItem(ALL_KEY);
      if (cached) chapters = JSON.parse(cached);
    } catch {
      // ignore
    }
    if (!chapters) {
      const res = await fetch(ALL_CDN);
      if (!res.ok) throw new Error('Failed to load Quran corpus');
      chapters = (await res.json()) as any[];
      AsyncStorage.setItem(ALL_KEY, JSON.stringify(chapters)).catch(() => {});
    }
    const out: IndexedAyah[] = [];
    for (const ch of chapters) {
      for (const v of ch.verses) {
        out.push({
          surahId: ch.id,
          ayah: v.id,
          key: `${ch.id}:${v.id}`,
          text: v.text,
          surahName: ch.transliteration,
          norm: normalizeArabic(v.text),
        });
      }
    }
    ayahIndex = out;
    return out;
  })();
  return indexPromise;
}

export async function searchAyat(query: string, limit = 25): Promise<AyahHit[]> {
  const q = normalizeArabic(query);
  if (q.length < 2) return [];
  const index = await buildIndex();
  const hits: AyahHit[] = [];
  for (const a of index) {
    if (a.norm.includes(q)) {
      hits.push({ surahId: a.surahId, ayah: a.ayah, key: a.key, text: a.text, surahName: a.surahName });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

/** Eastern-Arabic numeral rendering for ayah-end markers. */
export function toArabicNumber(n: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('');
}
