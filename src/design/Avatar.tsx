import React from 'react';
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <View
      accessible
      accessibilityLabel={name}
      accessibilityRole="image"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.surface3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text variant="subhead" color="textSecondary" maxFontSizeMultiplier={1.3}>
        {initials}
      </Text>
    </View>
  );
}
