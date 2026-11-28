import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Modal, TextInput, View, type TextInputProps } from 'react-native';

import { IconButton as SheetIconButton } from '../design/IconButton';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { textStyle } from '../design/tokens';
import type { Palette } from '../theme/colors';
import { radius } from '../theme/theme';

/**
 * Every sheet in the app looks the same: a grabber, the title at the left (with an optional line
 * under it), any actions, then a round close button at the right. The parts are exported for the
 * sheets that host their own container (the Meaning sheet's half-height native sheet).
 */

// The round icon button is the app's, not only the sheets'.
export { RoundIcon, IconButton as SheetIconButton } from '../design/IconButton';
/** A sheet's header: the title (and a line under it), its actions, and close. */
export function SheetHeader({
  title,
  subtitle,
  right,
  onClose,
  closeLabel = 'Close',
  top,
}: {
  /** Room above the header: more where the system's own grabber sits over it. */
  top?: number;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingHorizontal: t.spacing.xl, paddingTop: top ?? t.spacing.md, paddingBottom: t.spacing.md, minHeight: 52 }}>
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? (
          <SheetTitle>{title}</SheetTitle>
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

/** A sheet's title: the app's display face, so every sheet reads as AthanNow's. */
export function SheetTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="title2" header numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ fontFamily: 'Fraunces-SemiBold', fontWeight: undefined, letterSpacing: -0.2 }}>
      {children}
    </Text>
  );
}

/** The grabber at a sheet's top edge. */
export function SheetGrabber() {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: t.spacing.sm }}>
      <View style={{ width: 36, height: 5, borderRadius: radius.xs, backgroundColor: t.c.glyphQuiet, opacity: 0.5 }} />
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
