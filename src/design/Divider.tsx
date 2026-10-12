import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from './theme';

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, backgroundColor: t.c.hairline }}
    />
  );
}
