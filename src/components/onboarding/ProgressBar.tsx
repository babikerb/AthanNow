import { colorTokens } from '../../design/tokens.generated';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { duration, easing } from '../../theme/motion';

interface Props {
  /** 0-based index of the current step. */
  index: number;
  total: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Persistent thin progress indicator spanning the entire merged onboarding
 * flow — `total` segments, filled up through the current step. Rendered once
 * at the top of `OnboardingBeacon` so all nine steps (opening beat, permission
 * priming, calc method, real-UI highlights, widget intro, closing summary)
 * read as one continuous journey instead of separate sub-flows. Segment fill
 * animates smoothly between steps, gated on reduced motion like every other
 * onboarding animation.
 */
export function ProgressBar({ index, total, style }: Props) {
  return (
    <View
      style={[st.row, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: index + 1 }}
      accessibilityLabel={`Step ${index + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Segment key={i} filled={i <= index} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const reducedMotion = useReducedMotion();
  const v = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      v.setValue(filled ? 1 : 0);
      return;
    }
    Animated.timing(v, {
      toValue: filled ? 1 : 0,
      duration: duration.base,
      easing: easing.standard,
      // Width can't use the native driver.
      useNativeDriver: false,
    }).start();
  }, [filled, reducedMotion, v]);

  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={st.track}>
      <Animated.View style={[st.fill, { width }]} />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 3 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colorTokens.dark.skyHairline, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colorTokens.dark.accent },
});
