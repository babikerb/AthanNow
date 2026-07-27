import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { useOnboarding } from '../../context/OnboardingContext';
import { navigateToTab } from '../../navigation/navigationRef';
import { ACCENT } from '../../theme/colors';
import { Spotlight } from './Spotlight';

interface Step {
  tab: string;
  id: string;
  accent: string;
  title: string;
  body: string;
  center?: boolean;
  /** Highlight a circular / pill-shaped target with a matching rounded ring. */
  round?: boolean;
}

// Trimmed to 4 steps (was 6, plan §3.2): the new welcome flow (see
// src/screens/onboarding/) now explains *why* location, calc method,
// notifications, and the widget matter up front, so the tour's job narrows
// to pure interaction orientation — "here's where things are," not "here's
// why they matter."
const STEPS: Step[] = [
  {
    // Combines the old separate `athan-countdown` + `athan-location` steps:
    // they're adjacent on the same screen, and onboarding's location-priming
    // screen already covered *why* location matters, so this step only needs
    // to point at the actionable bit (tap to change it).
    tab: 'Athan',
    id: 'athan-location',
    accent: ACCENT,
    title: 'Your next prayer',
    body: 'This is the countdown to your next prayer. Tap the location above it anytime to change your city.',
    round: true,
  },
  {
    tab: 'Athan',
    id: 'athan-list',
    accent: ACCENT,
    title: "Today's times",
    body: 'Here are all five prayers plus sunrise. The current one is highlighted and the ones that passed fade out.',
  },
  {
    // `quran-bookmark` is no longer its own step — bookmarking is folded
    // into this step's body copy instead.
    tab: 'Quran',
    id: 'quran-title',
    accent: ACCENT,
    title: 'Read the Quran',
    body: "Tap to browse surahs or search. Tap the page itself to hide the controls for a clean, distraction free read. Tap the bookmark icon to save your place — press and hold it to see everything you've saved.",
    round: true,
  },
  {
    tab: 'Qibla',
    id: 'qibla-compass',
    accent: ACCENT,
    title: 'Find the Qibla',
    body: 'Point your phone and follow the marker to the Kaaba. The compass turns green the moment you line up.',
    round: true,
  },
];

// Overlay that drives the cross-tab spotlight tour: switches tabs as the user
// advances and points the Spotlight at each registered target.
export function OnboardingTour() {
  const { active, step, targets, next, finish, setActiveId } = useOnboarding();
  const cur = STEPS[step];

  useEffect(() => {
    if (!active) return;
    if (!cur) {
      finish();
      return;
    }
    navigateToTab(cur.tab);
    setActiveId(cur.center ? null : cur.id);
  }, [active, step, cur, finish, setActiveId]);

  if (!active || !cur) return null;

  // End the tour back on the Athan home tab, wherever the last step left us.
  const endTour = () => {
    navigateToTab('Athan');
    finish();
  };

  const last = step === STEPS.length - 1;
  return (
    <Spotlight
      target={cur.center ? null : targets[cur.id] ?? null}
      accent={cur.accent}
      title={cur.title}
      body={cur.body}
      index={step}
      total={STEPS.length}
      last={last}
      center={cur.center}
      round={cur.round}
      onNext={() => {
        Haptics.selectionAsync();
        last ? endTour() : next();
      }}
      onSkip={endTour}
    />
  );
}
