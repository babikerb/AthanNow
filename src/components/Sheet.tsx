import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Palette } from '../theme/colors';
import { hitSlopFor, iconSize } from '../theme/icons';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional trailing header action (e.g. a "Done" or refresh control). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** Overrides the app's default (dark) palette — used by the Quran tab's
   *  sheets, which stay on the forced-light reading palette instead. */
  palette?: Palette;
}

/**
 * Native iOS page-sheet (RN `Modal` with `presentationStyle="pageSheet"`).
 * Used app-wide for popups/modals so content sheets get the system slide-up,
 * swipe-to-dismiss card while still hosting arbitrary RN content.
 */
export function Sheet({ visible, onClose, title, headerRight, children, palette }: SheetProps) {
  const { colors: themeColors } = useTheme();
  const colors = palette ?? themeColors;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: colors.separator }]} />
        </View>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            {headerRight}
            <Pressable
              onPress={onClose}
              hitSlop={hitSlopFor(iconSize.xl)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeButton, { width: iconSize.xl, height: iconSize.xl }, pressed && { opacity: 0.6 }]}
            >
              <SymbolView name="xmark.circle.fill" size={iconSize.xl} tintColor={colors.textQuaternary} weight="semibold" />
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grabberWrap: { alignItems: 'center', paddingTop: spacing.xs },
  grabber: { width: 36, height: 5, borderRadius: 3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    // 10 sits exactly between the xs/sm tokens; kept as-is rather than
    // visibly tightening or loosening this header row.
    paddingTop: 10,
    paddingBottom: spacing.sm,
  },
  // Sheet titles use `type.title3` (20/600): a quiet title, not a heavy header.
  title: { ...type.title3, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  closeButton: { marginLeft: spacing.xxs, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
