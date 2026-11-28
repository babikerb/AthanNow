import React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

/**
 * A surface the app groups content on: the raised surface colour, a continuous corner, no border
 * or shadow (surface contrast does the separating). `feature` is the larger corner for the cards
 * a screen leads with.
 */
export function Card({
  children,
  feature,
  padded = true,
  style,
  ...rest
}: ViewProps & {
  children: React.ReactNode;
  feature?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: feature ? t.radii.feature : t.radii.card,
          borderCurve: 'continuous',
          backgroundColor: t.c.surface1,
          padding: padded ? t.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** The small uppercase line that heads a card or a group: quiet, tracked out. */
export function Caption({ children, header, style }: { children: React.ReactNode; header?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Text variant="caption" color="textSecondary" header={header} numberOfLines={1} style={[{ textTransform: 'uppercase', letterSpacing: 0.8 }, style as object]}>
      {children}
    </Text>
  );
}
