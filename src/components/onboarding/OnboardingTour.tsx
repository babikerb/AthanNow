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
}

const STEPS: Step[] = [
  {
    tab: 'Athan',
    id: 'athan-countdown',
    accent: ACCENT,
    title: 'Your next prayer',
    body: 'This countdown shows how long until the next prayer, with the exact time right below it.',
  },
  {
    tab: 'Athan',
    id: 'athan-location',
    accent: ACCENT,
    title: 'Set your location',
    body: 'Tap here any time to change your city. Prayer times recalculate automatically.',
  },
  {
    tab: 'Athan',
    id: 'athan-list',
    accent: ACCENT,
    title: "Today's times",
    body: 'All five prayers plus sunrise for today. The current prayer is highlighted; past ones dim out.',
  },
  {
    tab: 'Quran',
    id: 'quran-title',
    accent: ACCENT,
    title: 'Read the Quran',
    body: 'Tap here to browse surahs or search. Tap the page itself to hide everything for a full-screen, distraction-free read.',
  },
  {
    tab: 'Qibla',
    id: 'qibla-compass',
    accent: ACCENT,
    title: 'Find the Qibla',
    body: 'Point your phone and follow the marker to the Kaaba. It turns green the moment you line up.',
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
      onNext={() => {
        Haptics.selectionAsync();
        last ? finish() : next();
      }}
      onSkip={finish}
    />
  );
}
