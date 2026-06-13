import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared top header, ported from the Hardwood app: a row of liquid-glass pills
 * that sits below the safe-area inset (clear of the Dynamic Island / notch).
 * Compose the row from <GlassPill> and <GlassCircleButton>. Use across every
 * screen except the Quran reader (which is full-bleed/immersive).
 */

const CIRCLE = 44;

type Scheme = 'light' | 'dark';

function fallbackStyle(scheme: Scheme): ViewStyle {
  return scheme === 'dark'
    ? { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'rgba(0,0,0,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' };
}

export function HeaderBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.bar, { paddingTop: insets.top + 6 }, style]}>{children}</View>;
}

interface GlassPillProps {
  children: React.ReactNode;
  onPress?: () => void;
  scheme?: Scheme;
  /** Grow to fill the row (the center title pill in Hardwood). */
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlassPill({ children, onPress, scheme = 'dark', flex, style }: GlassPillProps) {
  const glass = isLiquidGlassSupported;
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.8}
      onPress={onPress}
      style={[s.pill, flex && { flex: 1 }, !glass && fallbackStyle(scheme), style]}
    >
      {glass && (
        <LiquidGlassView interactive={!!onPress} colorScheme={scheme} style={[StyleSheet.absoluteFill, { borderRadius: CIRCLE / 2 }]} />
      )}
      <View style={s.pillInner}>{children}</View>
    </Wrapper>
  );
}

export function GlassCircleButton({
  icon,
  onPress,
  scheme = 'dark',
  tintColor = '#FFFFFF',
  size = 18,
}: {
  icon: SFSymbol;
  onPress: () => void;
  scheme?: Scheme;
  tintColor?: string;
  size?: number;
}) {
  const glass = isLiquidGlassSupported;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} hitSlop={8} style={[s.circle, !glass && fallbackStyle(scheme)]}>
      {glass && (
        <LiquidGlassView interactive colorScheme={scheme} style={[StyleSheet.absoluteFill, { borderRadius: CIRCLE / 2 }]} />
      )}
      <View style={s.circleInner}>
        <SymbolView name={icon} size={size} tintColor={tintColor} weight="semibold" />
      </View>
    </TouchableOpacity>
  );
}

/** Center title text for a GlassPill. */
export function HeaderTitle({ title, subtitle, color, subColor }: { title: string; subtitle?: string; color: string; subColor: string }) {
  return (
    <>
      <Text style={[s.title, { color }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[s.subtitle, { color: subColor }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );
}

export function HeaderSpacer() {
  return <View style={s.spacer} />;
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  pill: {
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: CIRCLE,
  },
  pillInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, overflow: 'hidden', flexShrink: 0 },
  circleInner: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 } as TextStyle,
  subtitle: { fontSize: 11, letterSpacing: 0.1, marginTop: 1 } as TextStyle,
  spacer: { width: CIRCLE, flexShrink: 0 },
});
