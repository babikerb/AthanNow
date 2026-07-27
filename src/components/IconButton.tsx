import { SymbolView, SymbolWeight } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { hitSlopFor, iconSize } from '../theme/icons';
import { PRESSED_OPACITY } from '../theme/motion';

/**
 * Shared icon-only pressable primitive.
 *
 * Wraps `Pressable` + `expo-symbols`' `SymbolView` with a guaranteed 44x44pt
 * hit area (via `hitSlopFor`) and a *required* `accessibilityLabel` — it is
 * a compile error to add a new icon-only button without a label, rather
 * than a lint warning that can be ignored. This is the primitive every
 * icon-only button in the app should migrate to.
 */
export interface IconButtonProps {
  name: SFSymbol;
  onPress: () => void;
  /** Required — icon-only pressables have no visible text for VoiceOver to read. */
  accessibilityLabel: string;
  /** Optional extra guidance read after the label (e.g. what double-tapping does). */
  accessibilityHint?: string;
  /** Visual icon size. Defaults to `iconSize.md`. The hit area is always >= 44x44pt regardless of this value. */
  size?: number;
  tintColor?: string;
  weight?: SymbolWeight;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = iconSize.md,
  tintColor = '#FFFFFF',
  weight = 'semibold',
  disabled,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(size)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={({ pressed }) => [
        st.hit,
        { width: size, height: size },
        pressed && st.pressed,
        style,
      ]}
    >
      <SymbolView name={name} size={size} tintColor={tintColor} weight={weight} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  hit: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: PRESSED_OPACITY },
});
