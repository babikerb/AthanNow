import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type PressableScaleProps } from '../../design/PressableScale';

/**
 * A fixed-size button with its content centred. PressableScale's inner Pressable lays children
 * out from the top-left, so centring has to happen inside it, not on its outer style.
 */
export function TapTarget({ size = 44, style, children, ...rest }: Omit<PressableScaleProps, 'children'> & { size?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <PressableScale {...rest} style={[{ width: size, height: size }, style]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </PressableScale>
  );
}
