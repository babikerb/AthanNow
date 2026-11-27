import { Host } from '@expo/ui/swift-ui';
import { requireNativeView } from 'expo';
import { requireOptionalNativeModule } from 'expo-modules-core';
import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

export type ReaderAction = 'meaning' | 'play' | 'repeat' | 'bookmark' | 'unbookmark';

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
  /** Ayahs being explained (the Meaning sheet), from and to as surah * 1000 + ayah: a soft tint. */
  focusFrom?: number;
  focusTo?: number;
  /** Mushaf (the printed page), Translation (each ayah with its meaning) or Word by word. */
  view?: ReaderView;
  pageColor?: PageColor;
  textTone?: TextTone;
  /** The flowing text's size, 1 being the page's own. */
  textScale?: number;
  showTranslit?: boolean;
  /** The app's colours (#RRGGBB): the page's background, its text, and the accent for what's recited. */
  backgroundHex?: string;
  inkHex?: string;
  accentHex?: string;
  /** The colour recited words turn (the accent is the highlight on the word being recited). */
  recitedHex?: string;
  /** Pinching in the flowing views asks for a new text size. */
  onTextScale?: (scale: number) => void;
}

export type ReaderView = 'mushaf' | 'translation' | 'words';
export type PageColor = 'night' | 'charcoal' | 'sepia' | 'paper';
export type TextTone = 'standard' | 'soft' | 'warm';

type NativeProps = Omit<QuranReaderProps, 'current' | 'from' | 'onPageChange' | 'onTap' | 'onAction' | 'onZoomChange' | 'onTextScale'> & {
  onTextScale: (e: { nativeEvent: { scale: number } }) => void;
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
const NativeModule = Platform.OS === 'ios' ? requireOptionalNativeModule<{ ayah: (surah: number, ayah: number) => { arabic: string; translation: string } }>('QuranReader') : null;

/** An ayah's text (KFGQPC Hafs) and its Saheeh International translation, from the bundled data. */
export function ayahText(surah: number, ayah: number): { arabic: string; translation: string } {
  try {
    return NativeModule?.ayah(surah, ayah) ?? { arabic: '', translation: '' };
  } catch {
    return { arabic: '', translation: '' };
  }
}

/** The font the reader registers for KFGQPC Hafs text, usable from React Native once the reader has loaded. */
export const HAFS_FONT = 'KFGQPCHAFSUthmanicScript-Regula';

/** The native mushaf (modules/quran-reader/ios). iOS only. */
export function QuranReader({ current, from, onPageChange, onTap, onAction, onZoomChange, onTextScale, style, ...rest }: QuranReaderProps) {
  if (!NativeReader) return <View style={style} />;
  const cur = current ?? null;
  const start = from ?? cur;
  // A SwiftUI view mounts inside @expo/ui's Host, which hosts it in the React Native tree. The Host
  // ignores the safe area: the reader gets its insets from the screen instead.
  return (
    <Host style={style} ignoreSafeArea="all">
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
        onTextScale={(e) => onTextScale?.(e.nativeEvent.scale)}
      />
    </Host>
  );
}

// Optional: a build from before the AirPlay view simply goes without the button.
const NativeAirPlay: React.ComponentType<{ tintHex: string; style?: StyleProp<ViewStyle> }> | null = (() => {
  if (Platform.OS !== 'ios') return null;
  try {
    const views = (globalThis as { expo?: { getViewConfig?: (m: string, v?: string) => unknown } }).expo?.getViewConfig?.('QuranReader', 'AirPlayView');
    if (views === null) return null;
    return requireNativeView('QuranReader', 'AirPlayView');
  } catch {
    return null;
  }
})();

/** Apple's AirPlay picker, as a 44 point button. */
export function AirPlayButton({ tint, style }: { tint: string; style?: StyleProp<ViewStyle> }) {
  if (!NativeAirPlay) return null;
  return (
    <Host style={[{ width: 44, height: 44 }, style]}>
      <NativeAirPlay tintHex={tint} />
    </Host>
  );
}
