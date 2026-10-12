import React from 'react';
import { Switch } from 'react-native';

import { haptic } from './haptics';
import { useTheme } from './theme';

/** Native UISwitch, tinted from tokens. Label is required for VoiceOver. */
export function Toggle({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Switch
      value={value}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: t.c.surface3, true: t.c.accent }}
      ios_backgroundColor={t.c.surface3}
      onValueChange={(v) => {
        haptic.select();
        onValueChange(v);
      }}
    />
  );
}
