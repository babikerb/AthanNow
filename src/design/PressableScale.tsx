import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { fire, type HapticKind } from './haptics';
import { useTheme } from './theme';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Layout/appearance style, applied to the scaling wrapper. */
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed; defaults to the control token (0.97). Use motion.press.row for rows. */
  scaleTo?: number;
  haptic?: HapticKind;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
}

/** Pressable with a spring press-scale on the native driver. No scale under Reduce Motion. */
export function PressableScale({
  style,
  scaleTo,
  haptic = 'none',
  onPress,
  onPressIn,
  onPressOut,
  children,
  disabled,
  ...rest
}: PressableScaleProps) {
  const { motion, reduceMotion } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const target = scaleTo ?? motion.press.control;
  const scaleTo_ = (to: number) => Animated.timing(v, { toValue: to, duration: motion.duration.micro, useNativeDriver: true }).start();

  return (
    <Animated.View style={[style, { transform: [{ scale: v }] }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => {
          if (!reduceMotion) scaleTo_(target);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reduceMotion) scaleTo_(1);
          onPressOut?.(e);
        }}
        onPress={(e) => {
          fire(haptic);
          onPress?.(e);
        }}
        style={{ flexGrow: 1 }}
      >
        {({ pressed }) => (typeof children === 'function' ? children({ pressed }) : children)}
      </Pressable>
    </Animated.View>
  );
}
