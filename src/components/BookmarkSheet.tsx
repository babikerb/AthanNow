import { SymbolView } from 'expo-symbols';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Bookmark } from '../hooks/useBookmarks';
import { ACCENT, ACCENT_SOFT } from '../theme/colors';
import { PRESSED_OPACITY } from '../theme/motion';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';
import { Sheet } from './Sheet';

interface BookmarkSheetProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onSelect: (bookmark: Bookmark) => void;
  onRemove: (surahId: number, ayah: number) => void;
}

export function BookmarkSheet({ visible, onClose, bookmarks, onSelect, onRemove }: BookmarkSheetProps) {
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Bookmarks">
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="bookmark" size={40} tintColor={colors.textQuaternary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No bookmarks yet. Tap the bookmark on any ayah to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => `${b.surahId}:${b.ayah}`}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, opacity: pressed ? PRESSED_OPACITY : 1 }]}
            >
              <View style={[styles.badge, { backgroundColor: ACCENT_SOFT }]}>
                <SymbolView name="bookmark.fill" size={16} tintColor={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.surahName}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {item.page ? `Page ${item.page} · Ayah ${item.ayah}` : `Ayah ${item.ayah}`}
                </Text>
              </View>
              <Pressable
                onPress={() => onRemove(item.surahId, item.ayah)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Remove bookmark"
              >
                <SymbolView name="xmark.circle.fill" size={22} tintColor={colors.textSecondary} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.xxxl, gap: spacing.md },
  emptyText: { ...type.body, textAlign: 'center' } as TextStyle,
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.bodyEmph } as TextStyle,
  sub: { ...type.footnote, marginTop: 2 } as TextStyle,
});
