import { useSyncExternalStore } from 'react';

// Whether a screen has asked for full-screen reading (native tab bar hidden).
// Module-level so the navigator in App.tsx and the Quran screen share it without a provider.
let immersive = false;
const listeners = new Set<() => void>();

export function setImmersive(next: boolean) {
  if (next === immersive) return;
  immersive = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useImmersive() {
  return useSyncExternalStore(subscribe, () => immersive);
}
