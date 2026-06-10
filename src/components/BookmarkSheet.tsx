import { SymbolView } from 'expo-symbols';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Bookmark } from '../hooks/useBookmarks';
import { ACCENT, ACCENT_SOFT } from '../theme/colors';
import { Sheet } from './Sheet';

interface BookmarkSheetProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onSelect: (surahId: number, ayah: number) => void;
  onRemove: (surahId: number, ayah: number) => void;
}

export function BookmarkSheet({ visible, onClose, bookmarks, onSelect, onRemove }: BookmarkSheetProps) {
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Bookmarks">
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="bookmark" size={40} tintColor={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
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
                onSelect(item.surahId, item.ayah);
                onClose();
              }}
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[styles.badge, { backgroundColor: ACCENT_SOFT }]}>
                <SymbolView name="bookmark.fill" size={16} tintColor={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.surahName}</Text>
                <Text style={[styles.sub, { color: colors.textTertiary }]}>Ayah {item.ayah}</Text>
              </View>
              <Pressable onPress={() => onRemove(item.surahId, item.ayah)} hitSlop={12}>
                <SymbolView name="xmark.circle.fill" size={22} tintColor={colors.textTertiary} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 16 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
});
