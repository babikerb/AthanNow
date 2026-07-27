import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hitSlopFor } from '../theme/icons';
import { PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';

/**
 * Shared top header, ported from the Hardwood app: a row of pills that sits
 * below the safe-area inset (clear of the Dynamic Island / notch). Compose
 * the row from <GlassPill> and <GlassCircleButton>. Use across every screen
 * except the Quran reader (which is full-bleed/immersive).
 *
 * Visual treatment: a flat tinted surface + hairline border, matching the
 * rest of the app's established "no shadow, no glass material" elevation
 * language (see theme/shadow.ts's doc comment — shadows are reserved for two
 * floating-overlay cases elsewhere, this isn't a third). The tint is a
 * translucent black/white at low alpha keyed off the same base RGB the theme
 * uses for `separator`/`textPrimary` in each scheme (17,17,19 light /
 * 255,255,255 dark), so the header reads as one more instance of the app's
 * existing "elevated surface" grammar rather than a bespoke material. The
 * border goes a little stronger than the plain `separator` token in dark
 * scheme specifically, because this pill floats over the Athan/Qibla
 * animated sky (not a flat same-toned background like most bordered
 * surfaces), so it needs a touch more definition to stay legible across
 * every gradient stop.
 */

// The 44pt circle is both the header's touch-target floor and its visual
// diameter — matches `iconSize` + `hitSlopFor`'s guaranteed minimum exactly.
const CIRCLE = 44;

type Scheme = 'light' | 'dark';

function pillSurfaceStyle(scheme: Scheme): ViewStyle {
  return scheme === 'dark'
    ? { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' }
    : { backgroundColor: 'rgba(17,17,19,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(17,17,19,0.10)' };
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
  // TODO(a11y): make this required for interactive (onPress) pills once every
  // call site supplies a label (tracked as part of the systemic icon-button
  // a11y pass) — left optional here so existing call sites keep compiling
  // unchanged.
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function GlassPill({ children, onPress, scheme = 'dark', flex, style, accessibilityLabel, accessibilityHint }: GlassPillProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={PRESSED_OPACITY}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[s.pill, flex && { flex: 1 }, pillSurfaceStyle(scheme), style]}
    >
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
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: SFSymbol;
  onPress: () => void;
  scheme?: Scheme;
  tintColor?: string;
  size?: number;
  /** Required — icon-only buttons have no visible text for VoiceOver to read. */
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={PRESSED_OPACITY}
      onPress={onPress}
      hitSlop={hitSlopFor(size)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[s.circle, pillSurfaceStyle(scheme)]}
    >
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
  // paddingHorizontal 14 and gap 10 don't land exactly on the spacing grid;
  // kept as token +/- 2 rather than snapping to a token that would visibly
  // tighten or loosen this row (same precedent as spacing.ts's own doc comment).
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm + 2, paddingBottom: spacing.xs, gap: spacing.xs + 2 },
  pill: {
    height: CIRCLE,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: CIRCLE,
  },
  pillInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, gap: spacing.xxs + 2 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, overflow: 'hidden', flexShrink: 0 },
  circleInner: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  // Header pill titles are one of `type.headline`'s named use cases (was 16/700/-0.2, headline is 17/700/-0.2).
  title: { ...type.headline } as TextStyle,
  subtitle: { ...type.caption2, marginTop: 1 } as TextStyle,
  spacer: { width: CIRCLE, flexShrink: 0 },
});
