import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { duration, easing } from '../../theme/motion';

interface Props {
  /** This element's position in the entrance sequence (0 = first). */
  index: number;
  /** Total staggered elements on this screen. */
  count: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Onboarding's single entrance-motion primitive: fade + translateY(16),
 * staggered ~90ms apart, `duration.slower` (600ms) for the first element decaying
 * to `duration.base` (220ms) for the last — mirrors bbabiker.com's `${i * 60}ms`
 * stagger pattern scaled up slightly for a full-screen context.
 *
 * Gated on `useReducedMotion()`: when on, renders in its final position
 * immediately, no fade, no translate. This is the most motion-forward surface
 * in the app, so it's also the most important place to get the gating right.
 */
export function StaggerReveal({ index, count, children, style }: Props) {
  const reducedMotion = useReducedMotion();
  const v = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      v.setValue(1);
      return;
    }
    const dur =
      count > 1 ? duration.slower - (duration.slower - duration.base) * (index / (count - 1)) : duration.slower;
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: dur,
      delay: index * 90,
      easing: easing.emphasized,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Intentionally re-run only when the reduced-motion preference itself
    // changes — `index`/`count` are stable per mounted screen instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
