import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';

export const MINI_PLAYER_H = 64;

/** The current recitation, floating above the tab bar. Tap to open the player. */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const surah = r.surahId ? getSurah(r.surahId) : undefined;
  if (!surah) return null;
  const detail = r.inBismillah ? 'Bismillah' : `Ayah ${r.ayahIndex + 1}`;

  return (
    <View
      style={{
        height: MINI_PLAYER_H,
        borderRadius: t.radii.card,
        borderCurve: 'continuous',
        backgroundColor: t.c.surface2,
        borderWidth: 1,
        borderColor: t.c.hairline,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <PressableScale scaleTo={0.99} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Now playing, ${surah.transliteration}, ${detail}, ${r.reciter.name}`} accessibilityHint="Opens the player" style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: t.spacing.lg, paddingRight: t.spacing.xs, gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }}>
              {surah.transliteration}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {detail}, {r.reciter.name}
            </Text>
          </View>
          <PlayButton />
          <PressableScale
            haptic="select"
            onPress={r.next}
            disabled={r.ayahIndex >= r.ayahs.length - 1 && !r.inBismillah}
            accessibilityRole="button"
            accessibilityLabel="Next ayah"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView name="forward.fill" size={20} tintColor={t.c.text} />
          </PressableScale>
        </View>
      </PressableScale>
      <ProgressLine />
    </View>
  );
}

function PlayButton() {
  const t = useTheme();
  const r = useRecitation();
  const { buffering } = useRecitationProgress();
  return (
    <PressableScale
      haptic="light"
      onPress={r.togglePlay}
      accessibilityRole="button"
      accessibilityLabel={r.isPlaying ? 'Pause' : 'Play'}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      {r.isPlaying && buffering ? <ActivityIndicator color={t.c.text} /> : <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={22} tintColor={t.c.text} />}
    </PressableScale>
  );
}

function ProgressLine() {
  const t = useTheme();
  const { currentTime, duration } = useRecitationProgress();
  const f = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: t.c.hairline }}>
      <View style={{ width: `${f * 100}%`, height: 2, backgroundColor: t.c.accent }} />
    </View>
  );
}
