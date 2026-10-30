import React from 'react';
import { Text as RNText, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { arabicNumber } from '../../recitation/format';

// Eight-pointed star (two squares a quarter turn apart) on a 32 x 32 box.
const STAR = 'M16 1.5 L20.2 5.9 L26.3 5.7 L26.1 11.8 L30.5 16 L26.1 20.2 L26.3 26.3 L20.2 26.1 L16 30.5 L11.8 26.1 L5.7 26.3 L5.9 20.2 L1.5 16 L5.9 11.8 L5.7 5.7 L11.8 5.9 Z';

/**
 * The end-of-ayah mark with its number inside, drawn rather than set as U+06DD so the number always
 * sits within the mark. Sized from the Arabic font size; sits inline at the end of the ayah's text.
 */
export function AyahEnd({ n, size, color }: { n: number; size: number; color: string }) {
  const d = Math.round(size * 1.15);
  const digits = arabicNumber(n);
  return (
    <View
      accessible={false}
      style={{ width: d, height: d, marginHorizontal: size * 0.12, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: size * 0.28 }] }}
    >
      <Svg width={d} height={d} viewBox="0 0 32 32" style={{ position: 'absolute' }}>
        <Path d={STAR} fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
        <Circle cx={16} cy={16} r={10.2} fill="none" stroke={color} strokeWidth={0.9} opacity={0.7} />
      </Svg>
      <RNText
        allowFontScaling={false}
        style={{ color, fontSize: d * (digits.length > 2 ? 0.3 : 0.38), lineHeight: d * 0.5, fontWeight: '600', textAlign: 'center', includeFontPadding: false }}
      >
        {digits}
      </RNText>
    </View>
  );
}
