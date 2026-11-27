import { Menu, Host, RNHostView } from '@expo/ui/swift-ui';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * A native iOS pull-down menu on a React Native label: tap the label and the system menu opens from
 * it. `items` are @expo/ui SwiftUI elements (Button, Picker, Section, Divider). The label should hold
 * no buttons of its own, so the tap reaches the menu.
 */
export function NativeMenu({ children, items, style }: { children: React.ReactElement; items: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Host matchContents style={style}>
      <Menu label={<RNHostView matchContents>{children}</RNHostView>}>{items}</Menu>
    </Host>
  );
}
