import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Divider } from './Divider';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';

/** Section label above an inset-grouped list. Uppercase eyebrow, optional trailing action text. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.xxl, paddingBottom: t.spacing.sm }}>
      <Text variant="caption2" color="textSecondary" eyebrow header>
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={onAction} haptic="select" hitSlop={12} accessibilityRole="button" accessibilityLabel={action}>
          <Text variant="footnote" color="textSecondary">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** iOS inset-grouped container: surface1, card radius, hairline separators inset past the icon column. */
export function ListGroup({ children, footer, dividerInset }: { children: React.ReactNode; footer?: string; dividerInset?: number }) {
  const t = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View>
      <View
        style={{
          backgroundColor: t.c.surface1,
          borderRadius: t.radii.card,
          borderCurve: 'continuous',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.c.hairline,
          overflow: 'hidden',
        }}
      >
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Divider inset={dividerInset ?? t.spacing.lg} /> : null}
            {child}
          </React.Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  /** Right-aligned value text (e.g. the current setting). */
  value?: string;
  /** Replaces the value/chevron, e.g. a Toggle. */
  accessory?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Selection state for picker rows (announced by VoiceOver; the visible mark is the accessory). */
  selected?: boolean;
  /** Disclosure state for rows that expand in place. */
  expanded?: boolean;
  accessibilityHint?: string;
}

/** 52pt minimum row with leading hierarchical SF Symbol, title/subtitle, value and chevron. */
export function ListRow({ title, subtitle, icon, value, accessory, onPress, destructive, selected, expanded, accessibilityHint }: ListRowProps) {
  const t = useTheme();
  const body = (pressed: boolean) => (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        backgroundColor: pressed ? t.c.surface2 : 'transparent',
      }}
    >
      {icon ? <SymbolView name={icon} size={20} type="hierarchical" tintColor={destructive ? t.c.danger : t.c.textSecondary} style={{ width: 24, height: 24 }} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory ?? (
        <>
          {value ? (
            <Text variant="body" color="textSecondary" numberOfLines={1} style={{ maxWidth: '45%' }}>
              {value}
            </Text>
          ) : null}
          {onPress ? <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={t.c.glyphQuiet} /> : null}
        </>
      )}
    </View>
  );
  if (!onPress) return <View accessible={!accessory}>{body(false)}</View>;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={1}
      haptic="select"
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, expanded }}
    >
      {({ pressed }) => body(pressed)}
    </PressableScale>
  );
}
