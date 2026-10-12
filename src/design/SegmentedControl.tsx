import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { haptic } from './haptics';
import { Text } from './Text';
import { useTheme } from './theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

const PAD = 3;

/** Segmented control with a spring-animated thumb (native driver). */
export function SegmentedControl<T extends string>({ options, value, onChange }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(0)).current;
  const thumbW = width > 0 ? (width - PAD * 2) / options.length : 0;
  const placed = useRef(false);

  useEffect(() => {
    if (!thumbW) return;
    if (t.reduceMotion || !placed.current) {
      placed.current = true;
      x.setValue(index * thumbW);
    }
    else Animated.spring(x, { toValue: index * thumbW, useNativeDriver: true, ...t.motion.spring.snappy }).start();
  }, [index, thumbW, t.reduceMotion, t.motion.spring.snappy, x]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: PAD, borderRadius: t.radii.control - 2, borderCurve: 'continuous', backgroundColor: t.c.surface2 }}
    >
      {thumbW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: PAD,
            bottom: PAD,
            left: PAD,
            width: thumbW,
            borderRadius: t.radii.control - 5,
            borderCurve: 'continuous',
            backgroundColor: t.c.surface3,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.c.hairline,
            transform: [{ translateX: x }],
          }}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptic.select();
                onChange(o.value);
              }
            }}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="subhead" color={selected ? 'text' : 'textSecondary'} numberOfLines={1} style={{ fontWeight: selected ? '600' : '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
