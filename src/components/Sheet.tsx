import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { Modal, TextInput, View, type TextInputProps } from 'react-native';

import { PressableScale } from '../design/PressableScale';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { textStyle } from '../design/tokens';
import type { Palette } from '../theme/colors';

/**
 * Every sheet in the app looks the same: a grabber, the title at the left (with an optional line
 * under it), any actions, then a round close button at the right. The parts are exported for the
 * sheets that host their own container (the Meaning sheet's half-height native sheet).
 */

/**
 * The round icon every small action uses (close, share, add), drawn without a press handler so it
 * can also be the label of a native menu.
 */
export function RoundIcon({ name, label, disabled, tint }: { name: SFSymbol; label?: string; disabled?: boolean; tint?: 'accent' }) {
  const t = useTheme();
  const accent = tint === 'accent' && !disabled;
  return (
    <View accessibilityLabel={label} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent ? t.c.accent : t.c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={name} size={14} weight="semibold" tintColor={accent ? t.c.onAccent : disabled ? t.c.glyphQuiet : t.c.text} style={{ width: 18, height: 18 }} />
    </View>
  );
}

/** A round button for a sheet's header, and any small action elsewhere: close, share, add. */
export function SheetIconButton({
  name,
  label,
  onPress,
  disabled,
  tint,
}: {
  name: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Filled with the accent: the sheet's main action. */
  tint?: 'accent';
}) {
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <RoundIcon name={name} disabled={disabled} tint={tint} />
    </PressableScale>
  );
}

/** A sheet's header: the title (and a line under it), its actions, and close. */
export function SheetHeader({
  title,
  subtitle,
  right,
  onClose,
  closeLabel = 'Close',
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm, paddingBottom: t.spacing.md, minHeight: 52 }}>
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? (
          <Text variant="title3" header numberOfLines={1} style={{ fontWeight: '700' }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {typeof subtitle === 'string' ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {onClose ? <SheetIconButton name="xmark" label={closeLabel} onPress={onClose} /> : null}
    </View>
  );
}

/** The grabber at a sheet's top edge. */
export function SheetGrabber() {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: t.spacing.sm }}>
      <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.c.glyphQuiet, opacity: 0.5 }} />
    </View>
  );
}

/** The search field every sheet that searches uses. */
export function SheetSearchField(props: TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, height: 44, borderRadius: t.radii.control, borderCurve: 'continuous', paddingHorizontal: t.spacing.md, backgroundColor: t.c.surface2 }}>
        <SymbolView name="magnifyingglass" size={16} tintColor={t.c.textTertiary} style={{ width: 20, height: 20 }} />
        <TextInput
          placeholderTextColor={t.c.textTertiary}
          keyboardAppearance={t.scheme}
          autoCorrect={false}
          clearButtonMode="while-editing"
          {...props}
          // No lineHeight on a single-line TextInput: it shifts the baseline on iOS.
          style={[{ flex: 1, ...textStyle('body'), lineHeight: undefined, height: 44, color: t.c.text }, props.style]}
        />
      </View>
    </View>
  );
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Actions in the header, before close (a share or add button). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** @deprecated Sheets follow the app's colours; kept so older call sites still compile. */
  palette?: Palette;
}

/**
 * The app's sheet: a native iOS page sheet (slides up, swipes down to close) hosting the content
 * under the standard header.
 */
export function Sheet({ visible, onClose, title, subtitle, headerRight, children }: SheetProps) {
  const t = useTheme();
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <SheetGrabber />
        <SheetHeader title={title} subtitle={subtitle} right={headerRight} onClose={onClose} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </Modal>
  );
}
