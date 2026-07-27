/**
 * Shared three-state permission classification (plan §4.2a), used by both the
 * location and notification onboarding-priming screens.
 *
 * iOS's permission-request APIs are not idempotent the way a naive "tap to
 * ask" button implies: calling the request function again after the user has
 * already denied it does NOT re-show the OS dialog — it silently resolves
 * with the existing `denied` status and zero UI. The only way to give the
 * user a path to grant it after that point is `Linking.openSettings()`. So
 * every permission-aware screen has to branch on three states, not the
 * binary "ask vs. already asked" a first pass tends to assume.
 */
export type PermissionUIState = 'checking' | 'undetermined' | 'granted' | 'denied-permanent';

export function classifyPermission(status: string, canAskAgain: boolean): Exclude<PermissionUIState, 'checking'> {
  if (status === 'granted') return 'granted';
  if (status === 'denied' && !canAskAgain) return 'denied-permanent';
  // Covers 'undetermined' and the (iOS-rare) 'denied' + canAskAgain=true case
  // — both are still askable, so the request function will surface a dialog.
  return 'undetermined';
}
