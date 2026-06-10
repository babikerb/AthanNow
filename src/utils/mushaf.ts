import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';

/**
 * Real Madani Mushaf (604 pages) using the QCF v4 glyph dataset
 * (github.com/MohamadHajjRabee/quran-qcf4) over the jsDelivr CDN.
 *
 * Each page JSON describes its exact line layout: every line holds the words
 * that physically sit on that line of the printed Mushaf, so spatial memory is
 * preserved. Each word is a single glyph in that page's QCF font, addressed by a
 * Unicode codepoint (`code`). We render `String.fromCodePoint(code)` in the
 * page's font. Surah-header glyphs use the shared `QCF4_QBSML` font.
 */

const GH = 'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main';
const BISMILLAH_FONT = 'QCF4_QBSML';

export type LineType = 'word' | 'surah_header' | 'basmallah' | 'ayah';

export interface MushafWord {
  code: number;
  font: string;
  text: string;
  type: string;
  verse_key?: string;
  position?: number;
  sura?: number;
}

export interface MushafLine {
  line: number;
  words: MushafWord[];
}

export interface MushafSurahRef {
  id: number;
  name: string;
  name_arabic: string;
  verse_start: number;
  verse_end: number;
}

export interface MushafPageData {
  page: number;
  font: string;
  surahs: MushafSurahRef[];
  lines: MushafLine[];
}

/** jsDelivr URL for a QCF font family. QBSML has no `_W` suffix; page fonts do. */
export function fontUri(fontName: string): string {
  const file = fontName === BISMILLAH_FONT ? `${fontName}.ttf` : `${fontName}_W.ttf`;
  return `${GH}/fonts/${file}`;
}

const pageMemory = new Map<number, MushafPageData>();
const pad = (n: number) => String(n).padStart(3, '0');

export async function fetchMushafPage(page: number): Promise<MushafPageData> {
  if (pageMemory.has(page)) return pageMemory.get(page)!;

  const key = `athannow.mushaf.page.${page}.v1`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const data: MushafPageData = JSON.parse(cached);
      pageMemory.set(page, data);
      return data;
    }
  } catch {
    // ignore cache errors
  }

  const res = await fetch(`${GH}/pages/${pad(page)}.json`);
  if (!res.ok) throw new Error(`Failed to load mushaf page ${page}`);
  const data = (await res.json()) as MushafPageData;
  pageMemory.set(page, data);
  AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
  return data;
}

// ---- Font loading (on demand, ~2MB per font group, ~15 pages each) ----

const loaded = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

export function isFontLoaded(fontName: string): boolean {
  return loaded.has(fontName);
}

export function ensureFont(fontName: string): Promise<void> {
  if (loaded.has(fontName)) return Promise.resolve();
  const existing = inFlight.get(fontName);
  if (existing) return existing;

  const p = Font.loadAsync({ [fontName]: { uri: fontUri(fontName) } })
    .then(() => {
      loaded.add(fontName);
    })
    .finally(() => {
      inFlight.delete(fontName);
    });
  inFlight.set(fontName, p);
  return p;
}

/** Loads every font a page needs (its page font + the header/bismillah font). */
export async function ensurePageFonts(data: MushafPageData): Promise<void> {
  const names = new Set<string>([data.font]);
  data.lines.forEach((l) => l.words.forEach((w) => names.add(w.font)));
  await Promise.all([...names].map(ensureFont));
}

export function glyph(word: MushafWord): string {
  try {
    return String.fromCodePoint(word.code);
  } catch {
    return word.text ?? '';
  }
}

// ---- Verse -> page index (for "2:286" style search) ----

type VerseIndex = Record<string, { page: number }>;
let verseIndex: VerseIndex | null = null;
let verseIndexPromise: Promise<VerseIndex> | null = null;
const VERSE_INDEX_KEY = 'athannow.mushaf.verseindex.v1';

async function loadVerseIndex(): Promise<VerseIndex> {
  if (verseIndex) return verseIndex;
  if (!verseIndexPromise) {
    verseIndexPromise = (async () => {
      try {
        const cached = await AsyncStorage.getItem(VERSE_INDEX_KEY);
        if (cached) return JSON.parse(cached) as VerseIndex;
      } catch {
        // ignore
      }
      const res = await fetch(`${GH}/verses.json`);
      const json = (await res.json()) as VerseIndex;
      AsyncStorage.setItem(VERSE_INDEX_KEY, JSON.stringify(json)).catch(() => {});
      return json;
    })();
  }
  verseIndex = await verseIndexPromise;
  return verseIndex;
}

/** Resolve a "surah:ayah" key (e.g. "2:286") to its mushaf page number. */
export async function pageForVerse(verseKey: string): Promise<number | undefined> {
  const idx = await loadVerseIndex();
  return idx[verseKey]?.page;
}
