import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding needed to clear the native tab bar. Reads the navigator's
 * measured height when available, otherwise estimates it as the standard 49pt
 * bar plus the home-indicator safe-area inset. Safe to call outside the
 * navigator (won't throw, unlike the library's useBottomTabBarHeight).
 */
export function useTabBarHeight(): number {
  const measured = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return measured ?? insets.bottom + 49;
}
