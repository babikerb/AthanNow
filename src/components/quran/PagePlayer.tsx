import { Button, Picker, Section, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { clock, rateLabel } from '../../recitation/format';
import { RECITERS } from '../../recitation/reciters';
import { PLAYBACK_RATES, useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';
import { Scrubber } from '../recitation/Scrubber';
import { TapTarget } from '../recitation/TapTarget';

/** The reciters as a native picker, the chosen one ticked. */
function ReciterItems() {
  const r = useRecitation();
  return (
    <Section title="Reciter">
      <Picker selection={r.reciter.id} onSelectionChange={(id: string) => r.setReciter(id)} modifiers={[pickerStyle('inline')]}>
        {RECITERS.map((x) => (
          <SwiftText key={x.id} modifiers={[tag(x.id)]}>
            {x.name}
          </SwiftText>
        ))}
      </Picker>
    </Section>
  );
}

/**
 * The player over the page: a slim strip with the reciter and play, which opens into a card with the
 * position, speed, repeat and skip. Before anything has played, play starts at the top of the page.
 */
export function PagePlayer({ onPlayPage }: { onPlayPage: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const [open, setOpen] = useState(false);
  const surah = r.surahId ? getSurah(r.surahId) : undefined;

  const card = {
    borderRadius: t.radii.card,
    borderCurve: 'continuous' as const,
    backgroundColor: t.c.surface1,
    borderWidth: 1,
    borderColor: t.c.hairline,
    overflow: 'hidden' as const,
  };

  if (open && surah) return <Expanded onCollapse={() => setOpen(false)} style={card} />;

  const label = (
    <View style={{ minHeight: 54, justifyContent: 'center' }}>
      <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.4}>
        {surah ? `${surah.transliteration}, Ayah ${r.ayahIndex + 1}` : r.reciter.name}
      </Text>
      <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {r.loading ? 'Loading' : surah ? r.reciter.name : 'Listen from this page'}
      </Text>
    </View>
  );

  return (
    <View style={[card, { height: 56 }]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: t.spacing.lg, paddingRight: t.spacing.xs, gap: t.spacing.sm }}>
        {surah ? (
          <PressableScale scaleTo={0.99} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${surah.transliteration}, Ayah ${r.ayahIndex + 1}, ${r.reciter.name}`} accessibilityHint="Opens the player controls" style={{ flex: 1 }}>
            {label}
          </PressableScale>
        ) : (
          // Before anything plays, the strip is where the reciter is chosen.
          <NativeMenu style={{ flex: 1 }} colorScheme={t.scheme} items={<ReciterItems />}>
            {label}
          </NativeMenu>
        )}
        <PlayButton onPlayPage={onPlayPage} />
      </View>
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

function Expanded({ onCollapse, style }: { onCollapse: () => void; style: object }) {
  const t = useTheme();
  const r = useRecitation();
  const p = useRecitationProgress();
  const surah = getSurah(r.surahId!)!;
  const repeatLabel = r.repeat === 'off' ? 'Repeat off' : r.repeat === 'ayah' ? 'Repeating this ayah' : 'Repeating this surah';

  return (
    <View style={[style, { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, paddingBottom: t.spacing.sm }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <Icon name="chevron.down" label="Hide the player controls" onPress={onCollapse} size={17} />
        <NativeMenu style={{ flex: 1 }} colorScheme={t.scheme} items={<ReciterItems />}>
          <View style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600', flexShrink: 1 }} maxFontSizeMultiplier={1.4}>
                {r.reciter.name}
              </Text>
              <SymbolView name="chevron.up.chevron.down" size={11} tintColor={t.c.textSecondary} />
            </View>
            <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {surah.transliteration}, Ayah {r.ayahIndex + 1}
            </Text>
          </View>
        </NativeMenu>
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
        <Scrubber progress={p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {r.loading ? 'Loading' : clock(p.currentTime)}
          </Text>
          <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            -{clock(Math.max(0, p.duration - p.currentTime))}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.xs }}>
        <NativeMenu
          colorScheme={t.scheme}
          items={
            <Section title="Speed">
              {PLAYBACK_RATES.map((rate) => (
                <Button key={rate} label={rateLabel(rate)} systemImage={rate === r.rate ? 'checkmark' : undefined} onPress={() => r.setRate(rate)} />
              ))}
            </Section>
          }
        >
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Speed ${rateLabel(r.rate)}`}>
            <Text variant="subhead" color={r.rate !== 1 ? 'accentText' : 'text'} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.2}>
              {rateLabel(r.rate)}
            </Text>
          </View>
        </NativeMenu>
        <Icon name="backward.fill" label="Previous ayah" size={22} onPress={r.previous} disabled={r.ayahIndex === 0} />
        <PlayButton onPlayPage={() => {}} size={56} filled />
        <Icon name="forward.fill" label="Next ayah" size={22} onPress={r.next} disabled={r.ayahIndex >= surah.totalVerses - 1} />
        <Icon name={r.repeat === 'ayah' ? 'repeat.1' : 'repeat'} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
      </View>
    </View>
  );
}
