import { SymbolView } from 'expo-symbols';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Bookmark } from '../hooks/useBookmarks';
import { textStyle } from '../design/tokens';
import { Palette } from '../theme/colors';
import { Sheet } from './Sheet';

interface BookmarkSheetProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onSelect: (bookmark: Bookmark) => void;
  onRemove: (surahId: number, ayah: number) => void;
  /** Overrides the app's default (dark) palette — the Quran tab stays on the
   *  forced-light reading palette instead. */
  palette?: Palette;
}

export function BookmarkSheet({ visible, onClose, bookmarks, onSelect, onRemove, palette }: BookmarkSheetProps) {
  const { colors: themeColors } = useTheme();
  const colors = palette ?? themeColors;

  return (
    <Sheet visible={visible} onClose={onClose} title="Bookmarks" palette={colors}>
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="bookmark" size={40} tintColor={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Nothing saved yet. Tap the bookmark button while you read to keep your place.
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
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1 }]}
            >
              <SymbolView name="bookmark.fill" size={18} tintColor={colors.accent} style={styles.glyph} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{item.surahName}</Text>
                <Text style={[styles.sub, { color: colors.textTertiary }]}>
                  {item.page ? `Page ${item.page} · Ayah ${item.ayah}` : `Ayah ${item.ayah}`}
                </Text>
              </View>
              <Pressable onPress={() => onRemove(item.surahId, item.ayah)} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Remove bookmark, ${item.surahName}`}>
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
  emptyText: { ...textStyle('subhead'), textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  glyph: { width: 22, height: 22 },
  title: { ...textStyle('bodyEmph') },
  sub: { ...textStyle('footnote'), marginTop: 2 },
});
