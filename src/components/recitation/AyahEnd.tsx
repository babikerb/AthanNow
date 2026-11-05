import React from 'react';
import { Text as RNText, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { arabicNumber } from '../../recitation/format';

// The mushaf end-of-ayah mark on a 100 x 133 box: a ring between two pointed crowns, each with a dot
// and two curved strokes. CROWN is the top one; the bottom is the same, flipped.
const CROWN = 'M2 33 C14 30 24 22 33 17 C41 13 46 8 50 2 C54 8 59 13 67 17 C76 22 86 30 98 33 C90 37 84 40 78 40 C72 40 70 34 64 33 C58 32 54 34 50 38 C46 34 42 32 36 33 C30 34 28 40 22 40 C16 40 10 37 2 33 Z';
const STROKES = 'M25 31 C29 28 33 26 38 24 M62 24 C67 26 71 28 75 31';
// How far below the middle of the words the mark sits, as a share of the Arabic font size.
const DROP = 0.14;
const RING ='M13.5 39 A46.5 46.5 0 0 0 13.5 94 M86.5 39 A46.5 46.5 0 0 1 86.5 94';

function Crown({ color }: { color: string }) {
  return (
    <>
      <Path d={CROWN} fill="none" stroke={color} strokeWidth={3.4} strokeLinejoin="round" />
      <Path d={STROKES} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={50} cy={23} r={5.6} fill={color} />
    </>
  );
}

/**
 * The end-of-ayah mark with its number inside, drawn rather than set as U+06DD so the number always
 * sits within the mark. Sized from the Arabic font size; sits with the words, after the last one.
 */
export function AyahEnd({ n, size, color }: { n: number; size: number; color: string }) {
  const w = Math.round(size * 0.95);
  const h = Math.round((w * 133) / 100);
  const digits = arabicNumber(n);
  return (
    <View
      accessible={false}
      style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center', marginRight: size * 0.28, transform: [{ translateY: size * DROP }] }}
    >
      <Svg width={w} height={h} viewBox="0 0 100 133" style={{ position: 'absolute' }}>
        <Crown color={color} />
        <G transform="translate(0 133) scale(1 -1)">
          <Crown color={color} />
        </G>
        <Path d={RING} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
      </Svg>
      <RNText
        allowFontScaling={false}
        style={{ color, fontSize: w * (digits.length > 2 ? 0.3 : 0.38), lineHeight: w * 0.5, fontWeight: '600', textAlign: 'center' }}
      >
        {digits}
      </RNText>
    </View>
  );
}
