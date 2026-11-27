// Where each ayah sits on the printed Madani pages (files.quran.app width_1024 images, 1024 x 1656),
// from quran.com's ayahinfo_1024 database: each line's band, and each ayah's run along a line.
// Lets the reader find the ayah under a finger and draw the playing ayah's highlight.

/** [line, top, bottom] in source pixels. */
type Line = [number, number, number];
/** [surah, ayah, line, left, right] in source pixels, in reading order. */
type Run = [number, number, number, number, number];
interface PageBoxes {
  l: Line[];
  a: Run[];
}

// Required rather than imported, so TypeScript doesn't type all 360 KB of it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PAGES: PageBoxes[] = require('../data/ayahBoxes.json');

export interface AyahRef {
  surah: number;
  ayah: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxes = (page: number): PageBoxes | undefined => PAGES[page - 1];

/** The first ayah printed on a page (where playing "from the top of the page" starts). */
export function firstAyahOnPage(page: number): AyahRef | null {
  const run = boxes(page)?.a[0];
  return run ? { surah: run[0], ayah: run[1] } : null;
}

let pageIndex: Map<string, number> | null = null;

/** The page an ayah starts on. */
export function pageForAyah(surah: number, ayah: number): number | undefined {
  if (!pageIndex) {
    pageIndex = new Map();
    PAGES.forEach((p, i) => {
      for (const [s, a] of p.a) {
        const key = `${s}:${a}`;
        if (!pageIndex!.has(key)) pageIndex!.set(key, i + 1);
      }
    });
  }
  return pageIndex.get(`${surah}:${ayah}`);
}

// Highlights reach a little past the ink above and below, and are the same height on every line.
const PAD_Y = 8;
const PAD_X = 6;

function lineBand(p: PageBoxes, line: number): [number, number] | null {
  const l = p.l.find((x) => x[0] === line);
  return l ? [l[1] - PAD_Y, l[2] + PAD_Y] : null;
}

/** The rectangles an ayah covers on a page, one per line, in source pixels. */
export function ayahRects(page: number, ref: AyahRef): Rect[] {
  const p = boxes(page);
  if (!p) return [];
  const out: Rect[] = [];
  for (const [s, a, line, x0, x1] of p.a) {
    if (s !== ref.surah || a !== ref.ayah) continue;
    const band = lineBand(p, line);
    if (band) out.push({ x: x0 - PAD_X, y: band[0], w: x1 - x0 + PAD_X * 2, h: band[1] - band[0] });
  }
  return out;
}

/** The ayah under a point given in source pixels, or null away from the text. */
export function ayahAt(page: number, x: number, y: number): AyahRef | null {
  const p = boxes(page);
  if (!p || !p.l.length) return null;
  // The nearest line, if the point is within reach of it.
  let best: Line | null = null;
  let dist = Infinity;
  for (const l of p.l) {
    const d = y < l[1] ? l[1] - y : y > l[2] ? y - l[2] : 0;
    if (d < dist) {
      dist = d;
      best = l;
    }
  }
  if (!best || dist > 40) return null;
  const runs = p.a.filter((r) => r[2] === best![0]);
  let hit: Run | null = null;
  let gap = Infinity;
  for (const r of runs) {
    const d = x < r[3] ? r[3] - x : x > r[4] ? x - r[4] : 0;
    if (d < gap) {
      gap = d;
      hit = r;
    }
  }
  return hit && gap < 60 ? { surah: hit[0], ayah: hit[1] } : null;
}
