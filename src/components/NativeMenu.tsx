import { Menu, Host, RNHostView } from '@expo/ui/swift-ui';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * A native iOS pull-down menu on a React Native label: tap the label and the system menu opens from
 * it. `items` are @expo/ui SwiftUI elements (Button, Toggle, Picker, Section, Divider). The label
 * should hold no buttons of its own, so the tap reaches the menu.
 *
 * Give it a size (`width` and `height`): the label is laid out at that size. Left to measure its
 * label inside SwiftUI, the menu can end up the wrong size and out of place.
 */
export function NativeMenu({
  children,
  items,
  width,
  height,
  style,
  colorScheme,
}: {
  children: React.ReactElement;
  items: React.ReactNode;
  width?: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  colorScheme?: 'light' | 'dark';
}) {
  return (
    <Host style={[{ height }, width != null ? { width } : { flex: 1 }, style]} colorScheme={colorScheme}>
      <Menu label={<RNHostView>{children}</RNHostView>}>{items}</Menu>
    </Host>
  );
}
