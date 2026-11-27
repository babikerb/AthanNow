import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * The page's background fading in over text that scrolls under the reader's bars: solid at the
 * edge, clear where the text is meant to be read.
 */
export function EdgeFade({ edge, height, solid, color }: { edge: 'top' | 'bottom'; height: number; solid: number; color: string }) {
  const id = `fade-${edge}`;
  const top = edge === 'top';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, height, [edge]: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1={top ? '0' : '1'} x2="0" y2={top ? '1' : '0'}>
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset={String(Math.min(0.95, solid / height))} stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
