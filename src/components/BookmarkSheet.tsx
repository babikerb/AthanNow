import { SymbolView } from 'expo-symbols';
import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '../design/tokens';
import { Bookmark, BOOKMARK_COLOR_NAMES, BOOKMARK_COLORS, BookmarkColor, bookmarkColor } from '../hooks/useBookmarks';
import { Palette } from '../theme/colors';
import { juzForPage } from '../utils/mushaf';
import { Sheet } from './Sheet';

interface BookmarkSheetProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onSelect: (bookmark: Bookmark) => void;
  onRemove: (bookmark: Bookmark) => void;
  palette: Palette;
}

const ORDER = Object.keys(BOOKMARK_COLORS) as BookmarkColor[];

export function BookmarkSheet({ visible, onClose, bookmarks, onSelect, onRemove, palette: colors }: BookmarkSheetProps) {
  // Grouped by colour, most recent first within each, the way Ayah groups highlights.
  const sections = useMemo(
    () =>
      ORDER.map((c) => ({ color: c, data: bookmarks.filter((b) => (b.color ?? 'red') === c) })).filter((s) => s.data.length > 0),
    [bookmarks],
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Bookmarks" palette={colors}>
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No bookmarks</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Tap the ribbon below a page to mark it. Use a different colour for each thing you're reading.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(b) => `${b.page ?? 0}:${b.surahId}:${b.ayah}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{BOOKMARK_COLOR_NAMES[section.color]}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.surahName}, page ${item.page ?? ''}`}
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.separator, backgroundColor: pressed ? colors.surface : 'transparent' }]}
            >
              <SymbolView name="bookmark.fill" size={17} tintColor={bookmarkColor(item)} style={styles.glyph} />
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.surahName}
                </Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {item.page ? `Page ${item.page}, Juz ${juzForPage(item.page)}` : `Ayah ${item.ayah}`}
                </Text>
              </View>
              <Pressable onPress={() => onRemove(item)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove bookmark, ${item.surahName}`}>
                <Text style={[styles.remove, { color: colors.textSecondary }]}>Remove</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  empty: { paddingTop: 64, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { ...textStyle('headline'), textAlign: 'center' },
  emptyText: { ...textStyle('subhead'), textAlign: 'center' },
  list: { paddingBottom: 32 },
  sectionHeader: { ...textStyle('footnote'), paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  glyph: { width: 20, height: 20 },
  rowText: { flex: 1 },
  title: { ...textStyle('bodyEmph') },
  sub: { ...textStyle('footnote'), marginTop: 2 },
  remove: { ...textStyle('subhead') },
});
