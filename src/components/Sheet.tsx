import React from 'react';
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconButton } from './IconButton';
import { useTheme } from '../context/ThemeContext';
import { Palette } from '../theme/colors';
import { iconSize } from '../theme/icons';
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
            <IconButton
              name="xmark.circle.fill"
              onPress={onClose}
              accessibilityLabel="Close"
              size={iconSize.xl}
              tintColor={colors.textQuaternary}
              style={styles.closeButton}
            />
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
  // Sheet titles collapse into `type.title2` (was 26/800/-0.4, title2 is 24/800/-0.4).
  title: { ...type.title2, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  closeButton: { marginLeft: spacing.xxs },
  body: { flex: 1 },
});
