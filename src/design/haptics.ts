import * as Haptics from 'expo-haptics';

/** Haptics map from BRAND.md section 7. Fire-and-forget; never throws. */
const run = (fn: () => Promise<void>) => {
  fn().catch(() => {});
};

export const haptic = {
  /** Tab change, chip, segmented, toggle. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Primary button, sheet open. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Qibla aligned. */
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Location set, settings saved. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Permission denied, error. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

export type HapticKind = keyof typeof haptic | 'none';
export const fire = (kind: HapticKind) => {
  if (kind !== 'none') haptic[kind]();
};
