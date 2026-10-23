import { useSyncExternalStore } from 'react';

import type { ScenePeriod } from './palettes';

/** Everything needed to draw the sky exactly as Home is drawing it right now. */
export interface HomeSky {
  period: ScenePeriod;
  arc: number;
  zone?: { top: number; bottom: number };
  clearTop: number;
  groundLift: number;
}

// Home publishes its sky here; the launch overlay draws the same sky so the hand-off to Home only
// reveals the text. Module-level so no provider is needed.
let current: HomeSky | null = null;
const listeners = new Set<() => void>();

export function publishHomeSky(next: HomeSky) {
  const same =
    current &&
    current.period === next.period &&
    current.arc === next.arc &&
    current.clearTop === next.clearTop &&
    current.groundLift === next.groundLift &&
    current.zone?.top === next.zone?.top &&
    current.zone?.bottom === next.zone?.bottom;
  if (same) return;
  current = next;
  listeners.forEach((l) => l());
}

export function useHomeSky(): HomeSky | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
