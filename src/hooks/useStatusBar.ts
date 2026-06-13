import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Applies a status-bar style whenever this screen gains focus. Needed because the
 * native tab navigator keeps every screen mounted, so a plain <StatusBar> only
 * re-applies on a style change — returning to a screen would otherwise inherit the
 * previous tab's bar style and lose contrast (e.g. dark icons on a dark background).
 */
export function useFocusedStatusBar(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
    }, [style]),
  );
}
