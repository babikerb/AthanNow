import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type LockScreenTrackControlsEvents = {
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onPlay: () => void;
  onPause: () => void;
  onToggle: () => void;
  onSeek: (event: { position: number }) => void;
};

export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  /** Seconds. What the lock screen's bar shows, which needn't be the player's item. */
  duration: number;
  elapsed: number;
  /** 0 when paused. iOS advances the bar from this between updates. */
  rate: number;
}

export type RemoteCommand = { type: 'next' | 'previous' | 'play' | 'pause' | 'toggle' } | { type: 'seek'; position: number };

declare class LockScreenTrackControlsModuleType extends NativeModule<LockScreenTrackControlsEvents> {
  enable(): void;
  disable(): void;
  setNowPlaying(info: NowPlaying): void;
  clearNowPlaying(): void;
}

// iOS only. Optional so a build made before this module was added (or Expo Go) runs without lock
// screen controls instead of crashing at import.
const nativeModule: LockScreenTrackControlsModuleType | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<LockScreenTrackControlsModuleType>('LockScreenTrackControls') : null;

/** Turns on the lock screen and Control Center commands. Safe to call more than once. */
export function enableRemoteCommands(): void {
  nativeModule?.enable();
}

/** Turns the commands off and clears the now playing info. */
export function disableRemoteCommands(): void {
  nativeModule?.disable();
}

export function setNowPlaying(info: NowPlaying): void {
  nativeModule?.setNowPlaying?.(info);
}

export function clearNowPlaying(): void {
  nativeModule?.clearNowPlaying?.();
}

/** Subscribes to every lock screen command. Returns an unsubscribe function. */
export function addRemoteCommandListener(listener: (command: RemoteCommand) => void): () => void {
  if (!nativeModule) return () => {};
  const subs = [
    nativeModule.addListener('onNextTrack', () => listener({ type: 'next' })),
    nativeModule.addListener('onPreviousTrack', () => listener({ type: 'previous' })),
    nativeModule.addListener('onPlay', () => listener({ type: 'play' })),
    nativeModule.addListener('onPause', () => listener({ type: 'pause' })),
    nativeModule.addListener('onToggle', () => listener({ type: 'toggle' })),
    nativeModule.addListener('onSeek', ({ position }) => listener({ type: 'seek', position })),
  ];
  return () => subs.forEach((s) => s.remove());
}
