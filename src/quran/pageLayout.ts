// Where the 604 Madani pages start (the first ayah printed on each), from the reader's word data
// (scripts/build-mushaf-words.py). Enough to find any ayah's page and where a page begins.

export interface AyahRef {
  surah: number;
  ayah: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const STARTS: [number, number][] = require('../data/mushafIndex.json').pageStarts;

const order = (surah: number, ayah: number) => surah * 1000 + ayah;

/** The first ayah printed on a page (where playing "from the top of the page" starts). */
export function firstAyahOnPage(page: number): AyahRef | null {
  const s = STARTS[page - 1];
  return s ? { surah: s[0], ayah: s[1] } : null;
}

/** The page an ayah starts on. */
export function pageForAyah(surah: number, ayah: number): number {
  const target = order(surah, ayah);
  let lo = 0;
  let hi = STARTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (order(STARTS[mid][0], STARTS[mid][1]) <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
