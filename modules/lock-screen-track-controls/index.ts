import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type LockScreenTrackControlsEvents = {
  onNextTrack: () => void;
  onPreviousTrack: () => void;
};

declare class LockScreenTrackControlsModuleType extends NativeModule<LockScreenTrackControlsEvents> {
  enable(): void;
  disable(): void;
}

// iOS only. Optional so a build made before this module was added (or Expo Go) runs without the
// next/previous buttons instead of crashing at import.
const nativeModule: LockScreenTrackControlsModuleType | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<LockScreenTrackControlsModuleType>('LockScreenTrackControls') : null;

/** Enables the lock screen / Control Center's "next track" and "previous
 * track" buttons. No-op on non-iOS platforms. Safe to call more than once —
 * the native side is idempotent. */
export function enableTrackCommands(): void {
  nativeModule?.enable();
}

/** Disables the buttons added by {@link enableTrackCommands}. */
export function disableTrackCommands(): void {
  nativeModule?.disable();
}

/** Subscribes to "next track" presses. Returns an unsubscribe function.
 * Never fires on non-iOS platforms. */
export function addNextTrackListener(listener: () => void): () => void {
  if (!nativeModule) return () => {};
  const subscription = nativeModule.addListener('onNextTrack', listener);
  return () => subscription.remove();
}

/** Subscribes to "previous track" presses. Returns an unsubscribe function.
 * Never fires on non-iOS platforms. */
export function addPreviousTrackListener(listener: () => void): () => void {
  if (!nativeModule) return () => {};
  const subscription = nativeModule.addListener('onPreviousTrack', listener);
  return () => subscription.remove();
}
