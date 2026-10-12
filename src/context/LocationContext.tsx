import React, { createContext, useContext, useMemo } from 'react';

import { useLocationState } from '../hooks/useLocation';

type LocationValue = ReturnType<typeof useLocationState>;

const LocationContext = createContext<LocationValue | null>(null);

/**
 * One shared location state for the whole app. `useLocation` used to be per-instance, so choosing a city on Home left
 * Calendar, Qibla, Settings and the widget preview on the old city until a relaunch (and onboarding's GPS grant never
 * reached Home). The restore/refresh/search semantics, storage key and stored shape are unchanged (hooks/useLocation.ts).
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const state = useLocationState();
  // The hook returns a fresh object each render; keep the context value stable unless a field actually changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => state, Object.values(state));
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationValue {
  const v = useContext(LocationContext);
  if (!v) throw new Error('useLocation must be used inside LocationProvider');
  return v;
}
