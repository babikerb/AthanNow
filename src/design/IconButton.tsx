import { SymbolView } from 'expo-symbols';
import React from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { PressableScale } from './PressableScale';
import { useTheme } from './theme';

/**
 * The round icon every small action uses (close, share, add), drawn without a press handler so it
 * can also be the label of a native menu.
 */
export function RoundIcon({ name, label, disabled, tint }: { name: SFSymbol; label?: string; disabled?: boolean; tint?: 'accent' }) {
  const t = useTheme();
  const accent = tint === 'accent' && !disabled;
  return (
    <View accessibilityLabel={label} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent ? t.c.accent : t.c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={name} size={14} weight="semibold" tintColor={accent ? t.c.onAccent : disabled ? t.c.glyphQuiet : t.c.text} style={{ width: 18, height: 18 }} />
    </View>
  );
}

/** The app's round icon button: close, share, add, previous and next. */
export function IconButton({
  name,
  label,
  onPress,
  disabled,
  tint,
}: {
  name: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Filled with the accent: the sheet's main action. */
  tint?: 'accent';
}) {
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <RoundIcon name={name} disabled={disabled} tint={tint} />
    </PressableScale>
  );
}
