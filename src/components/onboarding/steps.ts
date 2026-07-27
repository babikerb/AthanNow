/**
 * Ordered step config for the merged onboarding experience.
 *
 * This is the single source of truth for what the flow does and in what
 * order — it replaces two previously-separate lists that used to live in
 * `OnboardingFlow.tsx` (the six-screen welcome sequence) and
 * `OnboardingTour.tsx` (the four-step coach-mark tour). `OnboardingOverlay`
 * walks this array; each entry says which real tab must be visible, which
 * registered `useOnboardingTarget` id (if any) to spotlight, and which step
 * component renders it.
 */

export type OnboardingMode = 'initial' | 'replay';

export type OnboardingStepConfig =
  /** Minimal opening beat — logo, wordmark, tagline, "Continue". No real tab
   *  or target involved. */
  | { kind: 'intro' }
  /** Three-state permission priming (location or notifications), reusing
   *  `permissionState.ts`'s ask/granted/denied-permanent branching. Only the
   *  location step has a real element to spotlight while it primes — there's
   *  no notification-specific UI to point at, so that one centers over the
   *  dimmed tab instead (same "no target -> center" rule the old Spotlight
   *  used). */
  | { kind: 'permission'; permission: 'location' | 'notifications'; tab: string; targetId?: string; round?: boolean }
  /** Calculation-method smart default + picker. Deliberately not targeted at
   *  the real Settings row for this method (that row lives inside a
   *  `ScrollView` whose scroll position isn't guaranteed at this point in the
   *  flow — cross-tab `measureInWindow` targeting is proven reliable for
   *  fixed, always-visible elements like the countdown/list/compass, not for
   *  an off-screen row inside a scrollable list). Centers over the dimmed
   *  Athan tab instead, same as the notifications step. */
  | { kind: 'calcMethod'; tab: string }
  /** Pure real-UI highlight — direct continuation of the former standalone
   *  coach-mark tour's steps, now inline in the same flow. */
  | { kind: 'spotlight'; tab: string; targetId: string; round?: boolean; title: string; body: string }
  /** Widget introduction. No in-app element to highlight (the widget lives on
   *  the Home Screen, outside the app), so this centers over the dimmed tab
   *  like the calc-method/notifications steps. */
  | { kind: 'widget'; tab: string }
  /** Closing summary + "Open AthanNow" / "Done". Sets `onboardingComplete`. */
  | { kind: 'outro'; tab: string };

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { kind: 'intro' },
  { kind: 'permission', permission: 'location', tab: 'Athan', targetId: 'athan-location', round: true },
  { kind: 'calcMethod', tab: 'Athan' },
  {
    kind: 'spotlight',
    tab: 'Athan',
    targetId: 'athan-list',
    title: "Today's times",
    body: 'Here are all five prayers plus sunrise. The current one is highlighted and the ones that passed fade out.',
  },
  { kind: 'permission', permission: 'notifications', tab: 'Athan' },
  { kind: 'widget', tab: 'Athan' },
  {
    kind: 'spotlight',
    tab: 'Quran',
    targetId: 'quran-title',
    round: true,
    title: 'Read the Quran',
    body: "Tap to browse surahs or search. Tap the page itself to hide the controls for a clean, distraction free read. Tap the bookmark icon to save your place — press and hold it to see everything you've saved.",
  },
  {
    kind: 'spotlight',
    tab: 'Qibla',
    targetId: 'qibla-compass',
    round: true,
    title: 'Find the Qibla',
    body: 'Point your phone and follow the marker to the Kaaba. The compass turns green the moment you line up.',
  },
  { kind: 'outro', tab: 'Athan' },
];
