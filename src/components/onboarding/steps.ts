/**
 * Ordered step config for the merged onboarding experience.
 *
 * This is the single source of truth for what the flow does and in what
 * order. `OnboardingOverlay` walks this array and picks a step component for
 * each entry. Every step is a standalone popup now, either a full-bleed hero
 * takeover or a centered card over a dimmed real tab background, with no
 * dependency on measuring where a specific real UI element sits on screen.
 * An earlier version also cut a highlight hole around a real target (a
 * location pill, a compass) for a subset of steps, but that cross-tab
 * measurement kept causing layout bugs and was dropped per explicit
 * feedback ("I like multiple popups, not element highlighting, it's
 * glitchy").
 */

export type OnboardingMode = 'initial' | 'replay';

export type OnboardingStepConfig =
  /** Minimal opening beat, logo, wordmark, tagline, "Continue". No real tab
   *  involved. */
  | { kind: 'intro' }
  /** Three-state permission priming (location or notifications), reusing
   *  `permissionState.ts`'s ask/granted/denied-permanent branching. */
  | { kind: 'permission'; permission: 'location' | 'notifications'; tab: string }
  /** Calculation-method smart default plus picker. */
  | { kind: 'calcMethod'; tab: string }
  /** A short descriptive popup introducing a part of the app, no highlight,
   *  just a dimmed backdrop from the relevant tab plus copy. */
  | { kind: 'info'; tab: string; title: string; body: string }
  /** Widget introduction. The widget lives on the Home Screen outside the
   *  app, so there's nothing to dim behind it besides the current tab. */
  | { kind: 'widget'; tab: string }
  /** Closing summary plus "Open AthanNow" / "Done". Sets `onboardingComplete`. */
  | { kind: 'outro'; tab: string };

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { kind: 'intro' },
  { kind: 'permission', permission: 'location', tab: 'Athan' },
  { kind: 'calcMethod', tab: 'Athan' },
  {
    kind: 'info',
    tab: 'Athan',
    title: "Today's times",
    body: 'Five prayers and sunrise. The next one is marked; the ones that have passed fade back.',
  },
  { kind: 'permission', permission: 'notifications', tab: 'Athan' },
  { kind: 'widget', tab: 'Athan' },
  {
    kind: 'info',
    tab: 'Quran',
    title: 'Read the Quran',
    body: 'Browse surahs or search a verse. Tap the page for full screen, and the ribbon to bookmark it.',
  },
  {
    kind: 'info',
    tab: 'Qibla',
    title: 'Find the Qibla',
    body: "Point your phone and follow the marker. The ring lights up when you're facing the Kaaba.",
  },
  { kind: 'outro', tab: 'Athan' },
];
