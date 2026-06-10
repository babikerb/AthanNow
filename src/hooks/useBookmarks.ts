import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'athannow.bookmarks.v1';

export interface Bookmark {
  surahId: number;
  ayah: number;
  /** Snapshot of context shown in the bookmark manager. */
  surahName: string;
  /** Mushaf page, when bookmarked from the page reader (enables jump-to-page). */
  page?: number;
  createdAt: number;
}

const keyOf = (surahId: number, ayah: number) => `${surahId}:${ayah}`;

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setBookmarks(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: Bookmark[]) => {
    setBookmarks(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isBookmarked = useCallback(
    (surahId: number, ayah: number) => bookmarks.some((b) => keyOf(b.surahId, b.ayah) === keyOf(surahId, ayah)),
    [bookmarks],
  );

  const toggleBookmark = useCallback(
    (surahId: number, ayah: number, surahName: string, page?: number) => {
      setBookmarks((prev) => {
        const exists = prev.some((b) => keyOf(b.surahId, b.ayah) === keyOf(surahId, ayah));
        const next = exists
          ? prev.filter((b) => keyOf(b.surahId, b.ayah) !== keyOf(surahId, ayah))
          : [{ surahId, ayah, surahName, page, createdAt: Date.now() }, ...prev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const removeBookmark = useCallback(
    (surahId: number, ayah: number) => {
      persist(bookmarks.filter((b) => keyOf(b.surahId, b.ayah) !== keyOf(surahId, ayah)));
    },
    [bookmarks, persist],
  );

  return { bookmarks, ready, isBookmarked, toggleBookmark, removeBookmark };
}
