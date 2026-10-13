import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Returns a function that says whether the app returned to the foreground within `windowMs`. Used by the sky layers:
 * a prayer-stage change that happened while the app was in the background should snap, not play a 4-second fade.
 */
export function useResumeSnap(windowMs = 2500): () => boolean {
  const last = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') last.current = Date.now();
    });
    return () => sub.remove();
  }, []);
  return useCallback(() => Date.now() - last.current < windowMs, [windowMs]);
}
