import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { PressableScale } from './PressableScale';
import { Text, type TextColor } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: SFSymbol;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, fullWidth, accessibilityHint, style }: ButtonProps) {
  const t = useTheme();
  const inactive = disabled || loading;
  const spec: Record<ButtonVariant, { bg: string; fg: TextColor; border?: string }> = {
    primary: { bg: t.c.accent, fg: 'onAccent' },
    secondary: { bg: t.c.surface2, fg: 'text', border: t.c.hairline },
    ghost: { bg: 'transparent', fg: 'accentText' },
    destructive: { bg: t.c.surface2, fg: 'danger', border: t.c.hairline },
  };
  const s = spec[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'primary' ? 'light' : 'none'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[{ alignSelf: fullWidth ? undefined : 'flex-start', width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {({ pressed }) => (
      <View
        style={{
          minHeight: variant === 'primary' ? 50 : 44,
          opacity: pressed ? 0.85 : 1,
          paddingHorizontal: t.spacing.xl,
          borderRadius: t.radii.control,
          borderCurve: 'continuous',
          backgroundColor: s.bg,
          borderWidth: s.border ? StyleSheet.hairlineWidth : 0,
          borderColor: s.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.sm,
        }}
      >
        {icon && !loading ? <SymbolView name={icon} size={18} tintColor={t.c[s.fg]} /> : null}
        <Text variant="headline" color={s.fg} numberOfLines={2} style={{ opacity: loading ? 0 : 1, textAlign: 'center' }}>
          {label}
        </Text>
        {loading ? <ActivityIndicator color={t.c[s.fg]} style={StyleSheet.absoluteFill} /> : null}
      </View>
      )}
    </PressableScale>
  );
}
