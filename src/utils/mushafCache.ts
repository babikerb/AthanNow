import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

import { TOTAL_PAGES } from '../data/surahPages';

// Official King Fahd "Madani" (15-line Hafs) printed page images: black ink on a
// transparent background, so the reader paints the paper colour behind and tints the ink.
const pad3 = (n: number) => String(n).padStart(3, '0');
export const pageUrl = (page: number) => `https://files.quran.app/hafs/madani/width_1024/page${pad3(page)}.png`;

const OFFLINE_KEY = 'athannow.quran.offline.v1';

/** Warm the disk cache for the pages either side of the one being read. */
export function prefetchAround(page: number, radius = 3) {
  const urls: string[] = [];
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= TOTAL_PAGES && p !== page) urls.push(pageUrl(p));
  }
  Image.prefetch(urls, 'disk').catch(() => {});
}

export async function isOfflineDownloaded(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFFLINE_KEY).catch(() => null)) === '1';
}

/**
 * Download every page into the disk cache, in batches so progress is visible and a
 * dropped connection loses at most one batch. Resolves true only if every batch landed.
 */
export async function downloadAllPages(onProgress: (done: number, total: number) => void, signal?: { cancelled: boolean }): Promise<boolean> {
  const BATCH = 12;
  let ok = true;
  for (let start = 1; start <= TOTAL_PAGES; start += BATCH) {
    if (signal?.cancelled) return false;
    const urls = [];
    for (let p = start; p < start + BATCH && p <= TOTAL_PAGES; p++) urls.push(pageUrl(p));
    const landed = await Image.prefetch(urls, 'disk').catch(() => false);
    ok = ok && landed;
    onProgress(Math.min(start + BATCH - 1, TOTAL_PAGES), TOTAL_PAGES);
  }
  if (ok) await AsyncStorage.setItem(OFFLINE_KEY, '1').catch(() => {});
  return ok;
}
