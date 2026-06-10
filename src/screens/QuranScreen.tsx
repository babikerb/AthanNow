import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookmarkSheet } from '../components/BookmarkSheet';
import { QuranReader, ReaderSection } from '../components/QuranReader';
import { SurahPickerSheet } from '../components/SurahPickerSheet';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { getSurah } from '../data/surahs';
import { useBookmarks } from '../hooks/useBookmarks';
import { ACCENT } from '../theme/colors';
import { fetchChapterVerses } from '../utils/quran';

const LAST_SURAH = 114;

export default function QuranScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { quranScrollDirection, quranLineMode } = useSettings();
  const { bookmarks, isBookmarked, toggleBookmark, removeBookmark } = useBookmarks();

  const [selectedSurahId, setSelectedSurahId] = useState(1);
  const [sections, setSections] = useState<ReaderSection[]>([]);
  const [visibleSurahId, setVisibleSurahId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const sectionsRef = useRef<ReaderSection[]>([]);
  sectionsRef.current = sections;
  const loadingMoreRef = useRef(false);

  const loadSelected = useCallback((id: number) => {
    setLoading(true);
    setError(false);
    setSections([]);
    setVisibleSurahId(id);
    let cancelled = false;
    fetchChapterVerses(id)
      .then((v) => {
        if (cancelled) return;
        const s = getSurah(id);
        if (s) setSections([{ surah: s, verses: v }]);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadSelected(selectedSurahId), [selectedSurahId, loadSelected]);

  // Continuous reading: append the next surah when the reader nears its end.
  const onRequestMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    const cur = sectionsRef.current;
    if (cur.length === 0) return;
    const lastId = cur[cur.length - 1].surah.id;
    if (lastId >= LAST_SURAH) return;
    const nextId = lastId + 1;
    loadingMoreRef.current = true;
    fetchChapterVerses(nextId)
      .then((v) => {
        const s = getSurah(nextId);
        if (s) setSections((p) => (p.some((x) => x.surah.id === nextId) ? p : [...p, { surah: s, verses: v }]));
      })
      .catch(() => {})
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, []);

  const headerSurah = useMemo(() => getSurah(visibleSurahId) ?? getSurah(selectedSurahId)!, [visibleSurahId, selectedSurahId]);

  const reader = (immersive: boolean) => (
    <QuranReader
      sections={sections}
      scrollDirection={quranScrollDirection}
      lineMode={quranLineMode}
      topInset={immersive ? insets.top : insets.top + 64}
      bottomInset={insets.bottom}
      isBookmarked={isBookmarked}
      onToggleBookmark={toggleBookmark}
      onToggleFocus={() => setFocusMode((f) => !f)}
      onVisibleSurahChange={setVisibleSurahId}
      onRequestMore={onRequestMore}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      <GlassHeader insetTop={insets.top}>
        <Pressable
          style={styles.titleButton}
          onPress={() => {
            Haptics.selectionAsync();
            setPickerOpen(true);
          }}
        >
          <View style={styles.titleTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {headerSurah.transliteration}
            </Text>
            <SymbolView name="chevron.down" size={13} tintColor={colors.textTertiary} style={{ marginLeft: 6 }} />
          </View>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
            Surah {headerSurah.id} · {headerSurah.totalVerses} ayat
          </Text>
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
          <Pressable onPress={() => loadSelected(selectedSurahId)} style={[styles.retry, { backgroundColor: ACCENT }]}>
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
        currentSurahId={visibleSurahId}
        onSelect={setSelectedSurahId}
      />
      <BookmarkSheet
        visible={bookmarkOpen}
        onClose={() => setBookmarkOpen(false)}
        bookmarks={bookmarks}
        onSelect={(s) => {
          setSelectedSurahId(s);
          setFocusMode(false);
        }}
        onRemove={removeBookmark}
      />
    </View>
  );
}

function GlassHeader({ insetTop, children }: { insetTop: number; children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const content = <View style={[styles.headerInner, { paddingTop: insetTop + 8 }]}>{children}</View>;

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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  titleButton: { flex: 1 },
  titleTextWrap: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingBottom: 6 },
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
