import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { ACCENT } from '../../theme/colors';
import { iconSize } from '../../theme/icons';
import { PRESSED_OPACITY } from '../../theme/motion';
import { type } from '../../theme/typography';

/**
 * Settings-style row primitives — extracted from `SettingsScreen.tsx` (plan
 * §3.7) so any future screen that wants the same grouped-row chrome can
 * reuse them instead of reinventing it. Mechanical extraction: behavior is
 * unchanged, styles migrated onto `type`/`iconSize` tokens.
 */

export type Colors = ReturnType<typeof useTheme>['colors'];

export function RowFrame({ last, colors, children }: { last?: boolean; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}>
      {children}
    </View>
  );
}

export function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  colors,
  last,
}: {
  icon: SFSymbol;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <RowFrame last={last} colors={colors}>
      <SymbolView name={icon} size={iconSize.md} tintColor={colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: ACCENT }}
        accessibilityLabel={label}
      />
    </RowFrame>
  );
}

export function NavRow({
  icon,
  label,
  value,
  onPress,
  colors,
  last,
  dimmed,
  chevron = 'chevron.right',
}: {
  icon: SFSymbol;
  label: string;
  value: string;
  onPress: () => void;
  colors: Colors;
  last?: boolean;
  /** De-emphasizes the icon + label (not just the value) for a row that
   *  represents a currently-inactive feature — e.g. "Reminder time" when the
   *  reminder itself is off — so an inactive row doesn't visually compete
   *  with active ones at the same weight. The value text already renders in
   *  `textSecondary` regardless, so this is what actually changes the row's
   *  weight when the feature is off. */
  dimmed?: boolean;
  /** Override the trailing glyph — defaults to a disclosure chevron (implies
   *  "navigates somewhere"). Pass `chevron.down`/`chevron.up` for a row that
   *  expands/collapses in place instead, so the affordance reads correctly. */
  chevron?: SFSymbol;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}
    >
      <RowFrame last={last} colors={colors}>
        <SymbolView name={icon} size={iconSize.md} tintColor={dimmed ? colors.textQuaternary : colors.textSecondary} />
        <Text style={[styles.rowLabel, { color: dimmed ? colors.textSecondary : colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
        <SymbolView name={chevron} size={14} tintColor={colors.textQuaternary} />
      </RowFrame>
    </Pressable>
  );
}

export function SegmentRow({
  icon,
  label,
  options,
  value,
  onChange,
  colors,
  last,
}: {
  icon: SFSymbol;
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <RowFrame last={last} colors={colors}>
      <SymbolView name={icon} size={iconSize.md} tintColor={colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <View style={[styles.segment, { backgroundColor: colors.background }]}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(o.key);
              }}
              style={[styles.segmentItem, active && { backgroundColor: ACCENT }]}
            >
              <Text style={[styles.segmentText, { color: active ? '#FFF' : colors.textSecondary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </RowFrame>
  );
}

/** Exported so ad hoc rows outside the four components above (e.g.
 *  Settings' destructive/version rows) can share the exact same row chrome
 *  instead of re-declaring it. */
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 50 },
  rowLabel: { ...type.body, flex: 1 },
  // Not part of this pass's requested token migration (only rowLabel was) —
  // left as the original literal so the row's value/segment text is
  // pixel-identical to before.
  rowValue: { fontSize: 15, maxWidth: 150, textAlign: 'right' },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  segmentText: { fontSize: 13, fontWeight: '600' },
});
