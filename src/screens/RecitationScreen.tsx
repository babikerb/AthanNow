import { SymbolView } from 'expo-symbols';
import React, { memo, useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MINI_PLAYER_H, MiniPlayer } from '../components/recitation/MiniPlayer';
import { NowPlaying } from '../components/recitation/NowPlaying';
import { SURAH_JUZ } from '../data/surahJuz';
import { getSurah, SURAHS, type Surah } from '../data/surahs';
import { PressableScale } from '../design/PressableScale';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { useFocusedStatusBar } from '../hooks/useStatusBar';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { QURAN_FONT } from '../recitation/format';
import { useRecitation } from '../recitation/RecitationProvider';

type Filter = 'all' | 'saved';

/** Matches across transliteration with or without its punctuation ("al kahf", "alkahf", "Al-Kahf"). */
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Listen to the Quran: every surah grouped by juz, a card to pick up where you left off, search,
 * saved surahs, and the player (mini player above the tab bar, full player as a sheet).
 */
export default function RecitationScreen() {
  const t = useTheme();
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarHeight();
  const { width } = useWindowDimensions();
  const gutter = width <= 375 ? t.spacing.lg : t.spacing.xl;
  useFocusedStatusBar(t.scheme === 'dark' ? 'light' : 'dark');

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [playerOpen, setPlayerOpen] = useState(false);

  const sections = useMemo(() => {
    const q = fold(query);
    const raw = query.trim();
    const matches = SURAHS.filter((s) => {
      if (filter === 'saved' && !r.savedIds.includes(s.id)) return false;
      if (!q && !raw) return true;
      return String(s.id) === raw || fold(s.transliteration).includes(q) || fold(s.translation).includes(q) || s.arabicName.includes(raw);
    });
    const byJuz = new Map<number, Surah[]>();
    for (const s of matches) {
      const j = SURAH_JUZ[s.id - 1]?.[0] ?? 1;
      byJuz.set(j, [...(byJuz.get(j) ?? []), s]);
    }
    return [...byJuz].map(([juz, data]) => ({ title: `Juz ${juz}`, data }));
  }, [filter, query, r.savedIds]);

  const play = (id: number) => {
    if (r.surahId === id) r.togglePlay();
    else r.playSurah(id);
  };

  const bottom = tabBar + (r.surahId ? MINI_PLAYER_H + t.spacing.md : 0) + t.spacing.xxl;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(s) => String(s.id)}
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: gutter, paddingBottom: bottom }}
        ListHeaderComponent={
          <View>
            <Text variant="title1" header maxFontSizeMultiplier={1.3} style={{ paddingVertical: t.spacing.sm }}>
              Quran
            </Text>
            <ContinueCard onOpen={() => setPlayerOpen(true)} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.sm,
                marginTop: t.spacing.lg,
                paddingHorizontal: t.spacing.md,
                minHeight: 44,
                borderRadius: t.radii.control,
                borderCurve: 'continuous',
                backgroundColor: t.c.surface2,
              }}
            >
              <SymbolView name="magnifyingglass" size={16} tintColor={t.c.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Surah name, meaning or number"
                placeholderTextColor={t.c.textTertiary}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search surahs"
                style={{ flex: 1, paddingVertical: 10, fontSize: 17, color: t.c.text }}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                  <SymbolView name="xmark.circle.fill" size={17} tintColor={t.c.glyphQuiet} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ marginTop: t.spacing.md }}>
              <SegmentedControl<Filter>
                options={[
                  { value: 'all', label: 'All surahs' },
                  { value: 'saved', label: r.savedIds.length ? `Saved (${r.savedIds.length})` : 'Saved' },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="footnote" color="textSecondary" header style={{ paddingTop: t.spacing.xxl, paddingBottom: t.spacing.sm, paddingHorizontal: t.spacing.xs }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <SurahRow
            surah={item}
            current={item.id === r.surahId}
            playing={item.id === r.surahId && r.isPlaying}
            saved={r.savedIds.includes(item.id)}
            onPlay={play}
            onToggleSaved={r.toggleSaved}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: t.spacing.xxxl, paddingHorizontal: t.spacing.xl, gap: t.spacing.sm }}>
            <SymbolView name={filter === 'saved' && !query ? 'star' : 'magnifyingglass'} size={28} tintColor={t.c.glyphQuiet} />
            <Text variant="headline" style={{ textAlign: 'center' }}>
              {filter === 'saved' && !query ? 'No saved surahs yet' : 'No surahs match'}
            </Text>
            <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
              {filter === 'saved' && !query ? 'Tap the star beside a surah to keep it here.' : 'Try another name, a meaning, or a surah number.'}
            </Text>
          </View>
        }
      />

      {r.surahId ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: tabBar + t.spacing.sm }}>
          <MiniPlayer onOpen={() => setPlayerOpen(true)} />
        </View>
      ) : null}

      <NowPlaying visible={playerOpen} onClose={() => setPlayerOpen(false)} />
    </View>
  );
}

/** Resume where you left off; with nothing played yet, Al-Kahf on a Friday and Al-Mulk otherwise. */
function ContinueCard({ onOpen }: { onOpen: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const resuming = !!r.surahId;
  const surah = getSurah(r.surahId ?? (new Date().getDay() === 5 ? 18 : 67));
  if (!surah) return null;
  const label = resuming ? (r.isPlaying ? 'Now playing' : 'Continue listening') : new Date().getDay() === 5 ? 'For Friday' : 'Suggested';
  const detail = resuming ? `Ayah ${r.ayahIndex + 1} of ${surah.totalVerses}, ${r.reciter.name}` : `${surah.translation}, ${surah.totalVerses} ayahs`;

  return (
    <PressableScale
      haptic="light"
      onPress={() => {
        if (resuming) onOpen();
        else r.playSurah(surah.id);
        if (resuming && !r.isPlaying) r.togglePlay();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${surah.transliteration}, ${detail}`}
      accessibilityHint={resuming ? 'Opens the player and plays' : 'Plays this surah'}
      style={{ borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, padding: t.spacing.lg, marginTop: t.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="accentText" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: t.spacing.sm, marginTop: 2 }}>
            <Text variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {surah.transliteration}
            </Text>
            <Text style={{ fontFamily: QURAN_FONT, fontSize: 22, lineHeight: 36, color: t.c.text }}>{surah.arabicName}</Text>
          </View>
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name={resuming && r.isPlaying ? 'waveform' : 'play.fill'} size={20} tintColor={t.c.onAccent} style={{ marginLeft: resuming && r.isPlaying ? 0 : 2 }} />
        </View>
      </View>
    </PressableScale>
  );
}

const SurahRow = memo(function SurahRow({
  surah,
  current,
  playing,
  saved,
  onPlay,
  onToggleSaved,
}: {
  surah: Surah;
  current: boolean;
  playing: boolean;
  saved: boolean;
  onPlay: (id: number) => void;
  onToggleSaved: (id: number) => void;
}) {
  const t = useTheme();
  return (
    <PressableScale
      scaleTo={1}
      haptic="select"
      onPress={() => onPlay(surah.id)}
      accessibilityRole="button"
      accessibilityLabel={`${surah.id}, ${surah.transliteration}, ${surah.translation}, ${surah.totalVerses} ayahs${playing ? ', playing' : ''}`}
      accessibilityHint={playing ? 'Pauses' : 'Plays this surah'}
      accessibilityActions={[{ name: 'save', label: saved ? 'Remove from saved' : 'Save' }]}
      onAccessibilityAction={() => onToggleSaved(surah.id)}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: 64,
            paddingVertical: t.spacing.sm,
            paddingHorizontal: t.spacing.md,
            borderRadius: t.radii.control,
            borderCurve: 'continuous',
            backgroundColor: pressed ? t.c.surface2 : current ? t.c.surface1 : 'transparent',
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? t.c.accentSoft : t.c.surface1 }}>
            {playing ? (
              <SymbolView name="waveform" size={16} tintColor={t.c.accent} />
            ) : (
              <Text variant="footnote" color={current ? 'accentText' : 'textSecondary'} style={{ fontWeight: '600' }}>
                {surah.id}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" color={current ? 'accentText' : 'text'} numberOfLines={1} style={{ fontWeight: '600' }}>
              {surah.transliteration}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {surah.translation}, {surah.totalVerses} ayahs
            </Text>
          </View>
          <Text style={{ fontFamily: QURAN_FONT, fontSize: 20, lineHeight: 34, color: t.c.textSecondary }}>{surah.arabicName}</Text>
          <Pressable
            onPress={() => onToggleSaved(surah.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${surah.transliteration} from saved` : `Save ${surah.transliteration}`}
            style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name={saved ? 'star.fill' : 'star'} size={17} tintColor={saved ? t.c.accent : t.c.glyphQuiet} />
          </Pressable>
        </View>
      )}
    </PressableScale>
  );
});
