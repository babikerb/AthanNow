import React from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ScreenContainerProps {
  /** Large title (Fraunces title1). Omit for screens that draw their own header. */
  title?: string;
  subtitle?: string;
  /** Trailing header slot, e.g. an IconButton. */
  right?: React.ReactNode;
  /** Scrolls with pull-to-refresh when onRefresh is given. Default true. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Reserve space for the tab bar at the bottom. Default true. */
  tabBarInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Screen shell: ink background, safe areas, 20pt gutters, optional large title, keyboard-aware scrolling. */
export function ScreenContainer({ title, subtitle, right, scroll = true, refreshing, onRefresh, tabBarInset = true, contentStyle, children }: ScreenContainerProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? t.spacing.lg : t.spacing.xl; // 16 on SE-width, 20 otherwise
  const bottom = (tabBarInset ? tabBar : insets.bottom) + t.spacing.xxl;

  const header =
    title || right ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: t.spacing.lg, paddingBottom: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          {title ? (
            <Text variant="title1" header>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="subhead" color="textSecondary" style={{ marginTop: t.spacing.xs }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const pad = { paddingTop: insets.top, paddingHorizontal: gutter };
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.c.bg }, pad, { paddingBottom: bottom }, contentStyle]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentContainerStyle={[pad, { paddingBottom: bottom }, contentStyle]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.c.textSecondary} /> : undefined}
    >
      {header}
      {children}
    </ScrollView>
  );
}
