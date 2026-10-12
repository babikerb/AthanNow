import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { PressableScale } from './PressableScale';
import { useTheme } from './theme';
import type { Palette } from './tokens';

export interface IconButtonProps {
  icon: SFSymbol;
  /** Required: icon-only controls must be named for VoiceOver. */
  label: string;
  onPress?: () => void;
  filled?: boolean;
  tint?: keyof Palette;
  size?: number;
  disabled?: boolean;
}

/** 44pt minimum target, regular-weight SF Symbol, hierarchical rendering. */
export function IconButton({ icon, label, onPress, filled, tint = 'text', size = 20, disabled }: IconButtonProps) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: t.radii.control,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? t.c.surface2 : 'transparent',
          borderWidth: filled ? StyleSheet.hairlineWidth : 0,
          borderColor: t.c.hairline,
        }}
      >
        <SymbolView name={icon} size={size} type="hierarchical" tintColor={t.c[tint]} />
      </View>
    </PressableScale>
  );
}
