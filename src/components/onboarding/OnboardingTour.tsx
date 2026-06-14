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

const STEPS: Step[] = [
  {
    tab: 'Athan',
    id: 'athan-countdown',
    accent: ACCENT,
    title: 'Your next prayer',
    body: 'This is the countdown to your next prayer, and the exact time sits right below it.',
  },
  {
    tab: 'Athan',
    id: 'athan-location',
    accent: ACCENT,
    title: 'Set your location',
    body: 'Tap here whenever you want to change your city. Your prayer times update on their own.',
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
    tab: 'Quran',
    id: 'quran-title',
    accent: ACCENT,
    title: 'Read the Quran',
    body: 'Tap to browse surahs or search. Tap the page itself to hide the controls and tab bar for a clean, distraction free read.',
    round: true,
  },
  {
    tab: 'Quran',
    id: 'quran-bookmark',
    accent: ACCENT,
    title: 'Save your place',
    body: 'Tap the bookmark to save the page you are on. Press and hold it to see all your saved spots.',
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
