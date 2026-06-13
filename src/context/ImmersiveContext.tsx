import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Lets a screen ask the root tab navigator to hide the native bottom tab bar
 * (used by the Quran reader for a full-bleed, Ayah-style immersive mode).
 */
interface ImmersiveValue {
  tabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
}

const ImmersiveContext = createContext<ImmersiveValue>({
  tabBarHidden: false,
  setTabBarHidden: () => {},
});

export function ImmersiveProvider({ children }: { children: React.ReactNode }) {
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const value = useMemo(() => ({ tabBarHidden, setTabBarHidden }), [tabBarHidden]);
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

export function useImmersive() {
  return useContext(ImmersiveContext);
}
