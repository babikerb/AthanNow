import { Verse } from './quran';

/**
 * Page model for the horizontal ("Pages") Quran reader.
 *
 * True glyph-perfect mushaf layout needs per-line word data we don't have, so we
 * approximate: estimate how many lines each ayah occupies, then fill each page up
 * to the target line count, ALWAYS breaking at an ayah boundary. This satisfies the
 * key requirement that a 15-line page ends on the end of an ayah. The 13-line mode
 * uses a larger font / fewer lines, matching common 13-line mushafs (no hard
 * end-of-ayah constraint there).
 */

export interface Page {
  verses: Verse[];
  /** True for the very first page, which also renders the surah header + bismillah. */
  withHeader: boolean;
}

export interface LineMetrics {
  linesPerPage: number;
  charsPerLine: number;
  fontSize: number;
  lineHeight: number;
  /** Lines reserved on the first page for the surah header + bismillah. */
  headerLines: number;
}

export function getLineMetrics(lineMode: '15' | '13'): LineMetrics {
  if (lineMode === '13') {
    return { linesPerPage: 13, charsPerLine: 24, fontSize: 27, lineHeight: 56, headerLines: 4 };
  }
  return { linesPerPage: 15, charsPerLine: 28, fontSize: 23, lineHeight: 48, headerLines: 4 };
}

function estimateLines(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

export function paginate(verses: Verse[], metrics: LineMetrics): Page[] {
  const { linesPerPage, charsPerLine, headerLines } = metrics;
  const pages: Page[] = [];
  let current: Verse[] = [];
  let usedLines = headerLines; // first page carries the header
  let isFirstPage = true;

  for (const verse of verses) {
    const verseLines = estimateLines(verse.text, charsPerLine);
    // Break only at an ayah boundary (never mid-ayah) once the page is full.
    if (current.length > 0 && usedLines + verseLines > linesPerPage) {
      pages.push({ verses: current, withHeader: isFirstPage });
      isFirstPage = false;
      current = [];
      usedLines = 0;
    }
    current.push(verse);
    usedLines += verseLines;
  }

  if (current.length > 0) {
    pages.push({ verses: current, withHeader: isFirstPage });
  }
  return pages;
}
