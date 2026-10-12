import React from 'react';
import { View } from 'react-native';

import { Text, type TextColor } from './Text';
import { useTheme } from './theme';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: TextColor }> = {
    neutral: { bg: t.c.surface3, fg: 'textSecondary' },
    accent: { bg: t.c.accentSoft, fg: 'accentText' },
    success: { bg: t.c.surface3, fg: 'success' },
    warning: { bg: t.c.surface3, fg: 'warning' },
    danger: { bg: t.c.surface3, fg: 'danger' },
    info: { bg: t.c.surface3, fg: 'info' },
  };
  const s = map[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: t.spacing.sm, paddingVertical: 3, borderRadius: t.radii.pill, backgroundColor: s.bg }}>
      <Text variant="caption2" color={s.fg} eyebrow>
        {label}
      </Text>
    </View>
  );
}
