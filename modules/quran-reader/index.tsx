import { requireNativeView } from 'expo';
import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

export type ReaderAction = 'play' | 'repeat' | 'bookmark' | 'unbookmark';

export interface WordRef {
  surah: number;
  ayah: number;
  /** From 1 within the ayah. */
  word: number;
}

export interface QuranReaderProps {
  style?: StyleProp<ViewStyle>;
  /** The page to show. Applied on first show and whenever `pageNonce` changes. */
  page: number;
  pageNonce: number;
  dark: boolean;
  /** While audio plays: the word being recited (under the glass) and where the recitation began. */
  current?: WordRef | null;
  from?: WordRef | null;
  /** Zoomed in, keep the recited word in view. */
  follow: boolean;
  topInset: number;
  bottomInset: number;
  surahTitles: string[];
  bookmarkedPages: number[];
  onPageChange: (page: number) => void;
  onTap: () => void;
  onAction: (action: ReaderAction, surah: number, ayah: number, page: number) => void;
  onZoomChange?: (zoomed: boolean) => void;
  /** A still snapshot of the page's opening lines, with no gestures or menus. */
  preview?: boolean;
}

type NativeProps = Omit<QuranReaderProps, 'current' | 'from' | 'onPageChange' | 'onTap' | 'onAction' | 'onZoomChange'> & {
  highlighting: boolean;
  curSurah: number;
  curAyah: number;
  curWord: number;
  fromSurah: number;
  fromAyah: number;
  fromWord: number;
  onPageChange: (e: { nativeEvent: { page: number } }) => void;
  onTap: () => void;
  onAction: (e: { nativeEvent: { action: ReaderAction; surah: number; ayah: number; page: number } }) => void;
  onZoomChange: (e: { nativeEvent: { zoomed: boolean } }) => void;
};

const NativeReader: React.ComponentType<NativeProps> | null = Platform.OS === 'ios' ? requireNativeView('QuranReader') : null;

/** The native mushaf (modules/quran-reader/ios). iOS only. */
export function QuranReader({ current, from, onPageChange, onTap, onAction, onZoomChange, ...rest }: QuranReaderProps) {
  if (!NativeReader) return <View style={rest.style} />;
  const cur = current ?? null;
  const start = from ?? cur;
  return (
    <NativeReader
      {...rest}
      highlighting={!!cur}
      curSurah={cur?.surah ?? 0}
      curAyah={cur?.ayah ?? 0}
      curWord={cur?.word ?? 0}
      fromSurah={start?.surah ?? 0}
      fromAyah={start?.ayah ?? 0}
      fromWord={start?.word ?? 0}
      onPageChange={(e) => onPageChange(e.nativeEvent.page)}
      onTap={() => onTap()}
      onAction={(e) => onAction(e.nativeEvent.action, e.nativeEvent.surah, e.nativeEvent.ayah, e.nativeEvent.page)}
      onZoomChange={(e) => onZoomChange?.(e.nativeEvent.zoomed)}
    />
  );
}
