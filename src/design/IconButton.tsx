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

/** Apple's minimum touch target: every icon control is at least this big to tap. */
export const TOUCH_TARGET = 44;

/** A 44 point square to tap, with its 36 point icon centred in it. */
export function IconTarget({ children }: { children: React.ReactNode }) {
  return <View style={{ width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** The app's round icon button: close, share, add, previous and next. A 44 point target. */
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
      <IconTarget>
        <RoundIcon name={name} disabled={disabled} tint={tint} />
      </IconTarget>
    </PressableScale>
  );
}
