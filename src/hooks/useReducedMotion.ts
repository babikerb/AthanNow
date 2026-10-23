import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS-level "Reduce Motion" accessibility preference.
 *
 * Every `Animated.loop` in the app must check this before starting, and jump
 * straight to its settled end-state when true instead of simply not
 * animating from a default (e.g. zero-opacity) state. One-shot settle-in
 * animations (a single fade/translate on mount) are not the kind of motion
 * `prefers-reduced-motion` users object to, only *looping* animations need
 * gating on this hook.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
