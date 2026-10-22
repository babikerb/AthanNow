import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'athannow.bookmarks.v1';

/** Bookmark colours, tuned to read as ribbon ink on the paper palette. */
export const BOOKMARK_COLORS = {
  red: '#B4533F',
  amber: '#C08A2E',
  green: '#4F8562',
  blue: '#3E6B98',
  violet: '#7458A0',
} as const;
export type BookmarkColor = keyof typeof BOOKMARK_COLORS;
export const BOOKMARK_COLOR_NAMES: Record<BookmarkColor, string> = {
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet',
};

export interface Bookmark {
  surahId: number;
  ayah: number;
  /** Snapshot of context shown in the bookmark manager. */
  surahName: string;
  /** Mushaf page: the unit the reader bookmarks. Older saves may lack it. */
  page?: number;
  /** Older saves have no colour; they show as red. */
  color?: BookmarkColor;
  createdAt: number;
}

export function bookmarkColor(b: Bookmark): string {
  return BOOKMARK_COLORS[b.color ?? 'red'];
}

const sameSpot = (a: Bookmark, b: { page?: number; surahId: number; ayah: number }) =>
  a.page != null && b.page != null ? a.page === b.page : a.surahId === b.surahId && a.ayah === b.ayah;

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setBookmarks(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((fn: (prev: Bookmark[]) => Bookmark[]) => {
    setBookmarks((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** Set (or recolour) the bookmark on a page. */
  const setPageBookmark = useCallback(
    (spot: { page: number; surahId: number; ayah: number; surahName: string }, color: BookmarkColor) => {
      update((prev) => [{ ...spot, color, createdAt: Date.now() }, ...prev.filter((b) => !sameSpot(b, spot))]);
    },
    [update],
  );

  const removeBookmark = useCallback(
    (target: Bookmark) => update((prev) => prev.filter((b) => !sameSpot(b, target))),
    [update],
  );

  const bookmarkForPage = useCallback((page: number) => bookmarks.find((b) => b.page === page), [bookmarks]);

  return { bookmarks, ready, bookmarkForPage, setPageBookmark, removeBookmark };
}
