import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { QuranReader } from '../components/QuranReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getSurah } from '../data/surahs';
import { useBookmarks } from '../hooks/useBookmarks';
import { ACCENT } from '../theme/colors';
import { fetchChapterVerses, Verse } from '../utils/quran';

export default function QuranScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { quranScrollDirection, quranLineMode } = useSettings();
  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks();

  const [surahId, setSurahId] = useState(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const surah = useMemo(() => getSurah(surahId)!, [surahId]);

  const loadSurah = (id: number) => {
    setLoading(true);
    setError(false);
    fetchChapterVerses(id)
      .then(setVerses)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchChapterVerses(surahId)
      .then((v) => !cancelled && setVerses(v))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [surahId]);

  const reader = (immersive: boolean) => (
    <QuranReader
      surah={surah}
      verses={verses}
      scrollDirection={quranScrollDirection}
      lineMode={quranLineMode}
      topInset={immersive ? insets.top : insets.top + 56}
      bottomInset={insets.bottom}
      isBookmarked={isBookmarked}
      onToggleBookmark={(ayah) => toggleBookmark(surahId, ayah, surah.transliteration)}
      onToggleFocus={() => setFocusMode((f) => !f)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* Glass header (hidden in focus mode) */}
      <GlassHeader insetTop={insets.top}>
        <Pressable
          style={styles.titleButton}
          onPress={() => {
            Haptics.selectionAsync();
            setPickerOpen(true);
          }}
        >
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {surah.transliteration}
          </Text>
          <SymbolView name="chevron.down" size={12} tintColor={colors.textTertiary} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={10}>
            <SymbolView name="magnifyingglass" size={20} tintColor={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => setBookmarkOpen(true)} hitSlop={10}>
            <SymbolView name="bookmark" size={20} tintColor={colors.textPrimary} />
          </Pressable>
        </View>
      </GlassHeader>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <SymbolView name="wifi.slash" size={36} tintColor={colors.textTertiary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Couldn't load this surah. Check your connection and try again.
          </Text>
          <Pressable onPress={() => loadSurah(surahId)} style={[styles.retry, { backgroundColor: ACCENT }]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        reader(false)
      )}

      {/* Immersive focus mode: full-screen modal hides the native tab bar + header. */}
      <Modal visible={focusMode} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setFocusMode(false)}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar hidden animated />
          {reader(true)}
          <View pointerEvents="none" style={styles.vignette} />
        </View>
      </Modal>

      <SurahPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentSurahId={surahId}
        onSelect={setSurahId}
      />
      <BookmarkSheet
        visible={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        bookmarks={bookmarks}
        onSelect={(s) => {
          setSurahId(s);
          setFocusMode(false);
        }}
        onRemove={removeBookmark}
      />
    </View>
  );
}

function GlassHeader({ insetTop, children }: { insetTop: number; children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const content = <View style={[styles.headerInner, { paddingTop: insetTop + 6 }]}>{children}</View>;

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView effect="regular" colorScheme={scheme} style={styles.header}>
        {content}
      </LiquidGlassView>
    );
  }
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  titleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 60,
    borderColor: 'rgba(0,0,0,0.18)',
  },
});
