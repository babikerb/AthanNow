import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '../context/ThemeContext';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional trailing header action (e.g. a "Done" or refresh control). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Native iOS page-sheet (RN `Modal` with `presentationStyle="pageSheet"`).
 * Used app-wide for popups/modals so content sheets get the system slide-up,
 * swipe-to-dismiss card while still hosting arbitrary RN content.
 */
export function Sheet({ visible, onClose, title, headerRight, children }: SheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            {headerRight}
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <SymbolView
                name="xmark.circle.fill"
                size={26}
                tintColor={colors.textTertiary}
              />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeButton: { marginLeft: 4 },
  body: { flex: 1 },
});
