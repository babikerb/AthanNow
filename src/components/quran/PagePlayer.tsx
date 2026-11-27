import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { clock, rateLabel } from '../../recitation/format';
import { PLAYBACK_RATES, useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';
import { Scrubber } from '../recitation/Scrubber';
import { TapTarget } from '../recitation/TapTarget';

/**
 * The player over the page: a slim strip with the reciter and play, which opens into a card with the
 * position, speed, repeat and skip. Before anything has played, play starts at the top of the page.
 */
export function PagePlayer({ onPlayPage, onReciters }: { onPlayPage: () => void; onReciters: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const [open, setOpen] = useState(false);
  const surah = r.surahId ? getSurah(r.surahId) : undefined;
  const expanded = open && !!surah;

  const card = {
    borderRadius: t.radii.card,
    borderCurve: 'continuous' as const,
    backgroundColor: t.c.surface1,
    borderWidth: 1,
    borderColor: t.c.hairline,
    overflow: 'hidden' as const,
  };

  if (expanded) return <Expanded onCollapse={() => setOpen(false)} onReciters={onReciters} style={card} />;

  const title = surah ? `${surah.transliteration}, ${r.inBismillah ? 'Bismillah' : `Ayah ${r.ayahIndex + 1}`}` : r.reciter.name;
  const detail = r.preparing ? `Loading ${r.preparing.done} of ${r.preparing.total}` : surah ? r.reciter.name : 'Listen from this page';

  return (
    <View style={[card, { height: 56 }]}>
      <PressableScale
        scaleTo={0.99}
        onPress={() => (surah ? setOpen(true) : onReciters())}
        accessibilityRole="button"
        accessibilityLabel={surah ? `${title}, ${r.reciter.name}` : `Reciter, ${r.reciter.name}`}
        accessibilityHint={surah ? 'Opens the player controls' : 'Choose a reciter'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: t.spacing.lg, paddingRight: t.spacing.xs, gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.4}>
              {title}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {detail}
            </Text>
          </View>
          <PlayButton onPlayPage={onPlayPage} />
        </View>
      </PressableScale>
      {surah ? <ProgressLine /> : null}
    </View>
  );
}

function PlayButton({ onPlayPage, size = 44, filled = false }: { onPlayPage: () => void; size?: number; filled?: boolean }) {
  const t = useTheme();
  const r = useRecitation();
  const { buffering } = useRecitationProgress();
  const ink = filled ? t.c.onAccent : t.c.text;
  return (
    <TapTarget
      size={size}
      haptic="light"
      onPress={() => (r.surahId ? r.togglePlay() : onPlayPage())}
      accessibilityRole="button"
      accessibilityLabel={r.isPlaying ? 'Pause' : r.surahId ? 'Play' : 'Play from the top of this page'}
      style={filled ? { borderRadius: size / 2, backgroundColor: t.c.accent } : undefined}
    >
      {r.isPlaying && buffering ? (
        <ActivityIndicator color={ink} />
      ) : (
        <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={filled ? 26 : 22} tintColor={ink} style={{ width: 28, height: 28, marginLeft: r.isPlaying ? 0 : 2 }} />
      )}
    </TapTarget>
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

function Icon({ name, label, onPress, active, disabled, size = 20 }: { name: SFSymbol; label: string; onPress: () => void; active?: boolean; disabled?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <TapTarget haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }}>
      <SymbolView name={name} size={size} tintColor={disabled ? t.c.glyphQuiet : active ? t.c.accent : t.c.text} style={{ width: size + 6, height: size + 6 }} />
    </TapTarget>
  );
}

function Expanded({ onCollapse, onReciters, style }: { onCollapse: () => void; onReciters: () => void; style: object }) {
  const t = useTheme();
  const r = useRecitation();
  const p = useRecitationProgress();
  const surah = getSurah(r.surahId!)!;
  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(r.rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length];
  const repeatLabel = r.repeat === 'off' ? 'Repeat off' : r.repeat === 'ayah' ? 'Repeating this ayah' : 'Repeating this surah';

  return (
    <View style={[style, { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, paddingBottom: t.spacing.sm }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <Icon name="chevron.down" label="Hide the player controls" onPress={onCollapse} size={17} />
        <PressableScale onPress={onReciters} accessibilityRole="button" accessibilityLabel={`Reciter, ${r.reciter.name}`} accessibilityHint="Choose a reciter" style={{ flex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.4}>
              {r.reciter.name}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {surah.transliteration}, {r.inBismillah ? 'Bismillah' : `Ayah ${r.ayahIndex + 1}`}
            </Text>
          </View>
        </PressableScale>
        <Icon
          name="xmark"
          label="Stop"
          size={16}
          onPress={() => {
            onCollapse();
            r.stop();
          }}
        />
      </View>

      {r.error ? (
        <Text variant="footnote" color="danger" style={{ textAlign: 'center', marginTop: t.spacing.xs }}>
          {r.error}
        </Text>
      ) : null}
      <View style={{ marginTop: t.spacing.xs }}>
        <Scrubber progress={r.preparing ? r.preparing.done / r.preparing.total : p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {r.preparing ? 'Loading' : clock(p.currentTime)}
          </Text>
          <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {r.preparing ? `${r.preparing.done} of ${r.preparing.total}` : `-${clock(Math.max(0, p.duration - p.currentTime))}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.xs }}>
        <TapTarget haptic="select" onPress={() => r.setRate(nextRate)} accessibilityRole="button" accessibilityLabel={`Speed ${rateLabel(r.rate)}`} accessibilityHint={`Changes to ${rateLabel(nextRate)}`}>
          <Text variant="subhead" color={r.rate !== 1 ? 'accentText' : 'text'} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.2}>
            {rateLabel(r.rate)}
          </Text>
        </TapTarget>
        <Icon name="backward.fill" label="Previous ayah" size={22} onPress={r.previous} disabled={r.ayahIndex === 0 && !r.inBismillah} />
        <PlayButton onPlayPage={() => {}} size={56} filled />
        <Icon name="forward.fill" label="Next ayah" size={22} onPress={r.next} disabled={r.ayahIndex >= surah.totalVerses - 1 && !r.inBismillah} />
        <Icon name={r.repeat === 'ayah' ? 'repeat.1' : 'repeat'} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
      </View>
    </View>
  );
}
