import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Selectable filter chip, pill-shaped (distinct from 12pt controls). Selected = surface3 fill, primary text and a
 * small apricot marker dot: the only warm element, no accent border or wash.
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} haptic="select" hitSlop={6} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }}>
      <View
        style={{
          minHeight: 34,
          paddingHorizontal: t.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          borderRadius: t.radii.pill,
          backgroundColor: selected ? t.c.surface3 : t.c.surface1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.c.hairline,
        }}
      >
        {selected ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.c.accent }} /> : null}
        <Text variant="subhead" color={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
