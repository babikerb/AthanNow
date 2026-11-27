// Where the 604 Madani pages start (the first word printed on each, which can be partway through an
// ayah), from the reader's word data (scripts/build-mushaf-words.py). Enough to find the page an
// ayah begins on and where a page begins.

export interface AyahRef {
  surah: number;
  ayah: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const STARTS: [number, number, number][] = require('../data/mushafIndex.json').pageStarts;

const order = (surah: number, ayah: number, word: number) => surah * 1_000_000 + ayah * 1000 + word;

/** The ayah at the top of a page (where playing "from the top of the page" starts). */
export function firstAyahOnPage(page: number): AyahRef | null {
  const s = STARTS[page - 1];
  return s ? { surah: s[0], ayah: s[1] } : null;
}

/** The page an ayah starts on. */
export function pageForAyah(surah: number, ayah: number): number {
  const target = order(surah, ayah, 1);
  let lo = 0;
  let hi = STARTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (order(STARTS[mid][0], STARTS[mid][1], STARTS[mid][2]) <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
