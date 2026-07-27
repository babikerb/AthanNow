import AsyncStorage from '@react-native-async-storage/async-storage';

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
