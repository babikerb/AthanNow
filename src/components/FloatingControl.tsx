import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colorTokens } from '../design/tokens.generated';
import { Palette, skyTextPrimary, skyTextSecondary } from '../theme/colors';
import { hitSlopFor, iconSize } from '../theme/icons';
import { PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';

/**
 * A solid backing for exactly the status-bar strip (time/battery/Dynamic
 * Island), sized to `insets.top`. Needed on any screen with scrolling
 * content and no header bar (Calendar, Settings) — without a header, that
 * strip has nothing behind it, so scrolled content can slide directly under
 * the system status bar with poor contrast against it ("bleeding under").
 * Deliberately *not* used on Athan/Qibla — those screens' atmospheric
 * gradient + stars are supposed to bleed all the way to the top edge, this
 * is only for screens where real text/content would otherwise collide with
 * system UI.
 */
export function SafeAreaScrim({ color }: { color: string }) {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[st.scrim, { height: insets.top, backgroundColor: color }]} />;
}

/**
 * Small floating controls — replaces the old full-width `AppHeader`/
 * `HeaderBar` bar concept entirely (per explicit feedback across several
 * rounds: headers should only exist where a screen genuinely needs a
 * control, and should never be a persistent chrome bar spending permanent
 * vertical space). Every screen that needs *something* at the top (Athan's
 * location switcher, Calendar's jump-to-today) now renders exactly that one
 * small control directly, positioned wherever suits that screen's own
 * layout — not inside a shared bar.
 *
 * What *is* shared is the visual language, via these two primitives, so
 * "small floating control" reads as one consistent idea everywhere it
 * appears instead of every screen inventing its own padding/radius/border
 * values (which is literally how the app ended up with drifted, ad hoc
 * control styling in the first place).
 *
 * Two tones, since this app has two genuinely different backdrops a control
 * can float over:
 *  - `onSky`: the animated night-sky/gradient screens (Athan, Qibla) —
 *    always a translucent-white-on-dark treatment regardless of system
 *    theme, since the sky itself is always dark-ish.
 *  - `onSurface`: theme-following screens (Calendar, Settings) — needs the
 *    screen's actual `Palette` so it reads correctly in both light and dark
 *    mode.
 */
export type ControlTone = 'onSky' | 'onSurface';

interface ToneColors {
  fill: string;
  border: string;
  icon: string;
  text: string;
  textSecondary: string;
}

function toneColors(tone: ControlTone, colors?: Palette): ToneColors {
  if (tone === 'onSky') {
    return {
      fill: colorTokens.dark.skyFill,
      border: colorTokens.dark.skyHairline,
      icon: colorTokens.dark.skyText,
      text: skyTextPrimary,
      textSecondary: skyTextSecondary,
    };
  }
  if (!colors) {
    throw new Error('FloatingControl: `colors` is required when tone="onSurface"');
  }
  return { fill: colors.surfaceElevated, border: colors.separator, icon: colors.textPrimary, text: colors.textPrimary, textSecondary: colors.textSecondary };
}

interface FloatingPillProps {
  tone: ControlTone;
  colors?: Palette;
  icon?: SFSymbol;
  label: string;
  /** Trailing glyph — e.g. a chevron implying "tap to change". */
  trailingIcon?: SFSymbol;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function FloatingPill({ tone, colors, icon, label, trailingIcon, onPress, accessibilityLabel, style }: FloatingPillProps) {
  const c = toneColors(tone, colors);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        st.pill,
        { backgroundColor: c.fill, borderColor: c.border, opacity: pressed ? PRESSED_OPACITY : 1 },
        style,
      ]}
    >
      {icon && <SymbolView name={icon} size={iconSize.xs} tintColor={c.icon} />}
      <Text style={[st.pillText, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon && <SymbolView name={trailingIcon} size={iconSize.sm} tintColor={c.icon} />}
    </Pressable>
  );
}

interface FloatingIconButtonProps {
  tone: ControlTone;
  colors?: Palette;
  icon: SFSymbol;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function FloatingIconButton({ tone, colors, icon, onPress, accessibilityLabel, style }: FloatingIconButtonProps) {
  const c = toneColors(tone, colors);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlopFor(CIRCLE)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        st.circle,
        { backgroundColor: c.fill, borderColor: c.border, opacity: pressed ? PRESSED_OPACITY : 1 },
        style,
      ]}
    >
      <SymbolView name={icon} size={iconSize.md} tintColor={c.icon} weight="semibold" />
    </Pressable>
  );
}

const CIRCLE = 40;

const st = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xxs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '80%',
  },
  pillText: { ...type.footnote, letterSpacing: 0.3, flexShrink: 1 } as TextStyle,
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
});
