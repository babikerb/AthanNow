import { Picker, Section, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { AirPlayButton } from 'quran-reader';
import type { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { clock } from '../../recitation/format';
import { RECITERS } from '../../recitation/reciters';
import { PLAYBACK_RATES, useRecitation, useRecitationProgress, useRecitationWord } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';
import { Scrubber } from '../recitation/Scrubber';
import { TapTarget } from '../recitation/TapTarget';
import { radius, space } from '../../theme/theme';

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

/** A plain control: the glyph alone, in a 44 point target. */
function Control({ name, label, onPress, size = 20, active, disabled }: { name: SFSymbol; label: string; onPress: () => void; size?: number; active?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <TapTarget haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }}>
      <SymbolView name={name} size={size} tintColor={disabled ? t.c.glyphQuiet : active ? t.c.accent : t.c.text} style={{ width: size + 8, height: size + 8 }} />
    </TapTarget>
  );
}

/**
 * The player over the page, one card: AirPlay, the reciter (tap to choose another) and stop along the
 * top; the surah and ayah under the reciter; the ayah's position; then speed, previous, play, next
 * and repeat. Away from the page being recited, a way back to it. Before anything plays, play starts
 * at the top of the page.
 */
export function PagePlayer({ onPlayPage, onBackToRecitation }: { onPlayPage: () => void; /** Shown when the reader is away from the page being recited. */ onBackToRecitation?: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const p = useRecitationProgress();
  const { buffering } = useRecitationWord();
  const surah = r.surahId ? getSurah(r.surahId) : undefined;
  const repeatLabel = r.repeat === 'off' ? 'Repeat off' : r.repeat === 'ayah' ? 'Repeating this ayah' : 'Repeating this surah';
  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(r.rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length];

  return (
    <View
      style={{
        borderRadius: radius.feature,
        borderCurve: 'continuous',
        backgroundColor: t.c.surface1,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.c.hairline,
        paddingHorizontal: t.spacing.md,
        paddingTop: t.spacing.sm,
        paddingBottom: t.spacing.sm,
      }}
    >
      {/* AirPlay, the reciter, stop. */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44 }}>
          <AirPlayButton tint={t.c.textSecondary} />
        </View>
        <NativeMenu height={48} colorScheme={t.scheme} items={<ReciterItems />}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Reciter, ${r.reciter.name}`} accessibilityHint="Choose another reciter">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Text variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ flexShrink: 1 }}>
                {r.reciter.name}
              </Text>
              <SymbolView name="chevron.down" size={10} weight="semibold" tintColor={t.c.textSecondary} />
            </View>
            <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {r.loading ? 'Loading' : surah ? `${surah.transliteration}: ${r.ayahIndex + 1}` : 'Listen from this page'}
            </Text>
          </View>
        </NativeMenu>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {surah ? <Control name="xmark" size={15} label="Stop the recitation" onPress={r.stop} /> : null}
        </View>
      </View>

      {r.error ? (
        <Text variant="footnote" color="danger" style={{ textAlign: 'center', marginTop: t.spacing.xs }}>
          {r.error}
        </Text>
      ) : null}

      {/* Where in the ayah. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingHorizontal: t.spacing.xs, marginTop: t.spacing.xs, opacity: surah ? 1 : 0.4 }} pointerEvents={surah ? 'auto' : 'none'}>
        <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'], minWidth: 34 }}>
          {surah && !r.loading ? clock(p.currentTime) : '0:00'}
        </Text>
        <View style={{ flex: 1 }}>
          <Scrubber progress={p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
        </View>
        <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' }}>
          {surah && !r.loading ? `-${clock(Math.max(0, p.duration - p.currentTime))}` : '0:00'}
        </Text>
      </View>

      {/* Speed, the controls, repeat. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TapTarget haptic="select" onPress={() => r.setRate(nextRate)} accessibilityRole="button" accessibilityLabel={`Speed ${r.rate} times`} accessibilityHint={`Changes to ${nextRate} times`}>
          <Text variant="subhead" style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: r.rate === 1 ? t.c.text : t.c.accent }}>
            {r.rate}×
          </Text>
        </TapTarget>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
          <Control name="backward.fill" size={24} label="Previous ayah" onPress={r.previous} disabled={!surah || r.ayahIndex === 0} />
          <TapTarget
            size={60}
            haptic="light"
            onPress={() => (r.surahId ? r.togglePlay() : onPlayPage())}
            accessibilityRole="button"
            accessibilityLabel={r.isPlaying ? 'Pause' : r.surahId ? 'Play' : 'Play from the top of this page'}
          >
            {r.isPlaying && buffering ? (
              <ActivityIndicator color={t.c.text} />
            ) : (
              <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={36} tintColor={t.c.text} style={{ width: 42, height: 42, marginLeft: r.isPlaying ? 0 : 3 }} />
            )}
          </TapTarget>
          <Control name="forward.fill" size={24} label="Next ayah" onPress={r.next} disabled={!surah || r.ayahIndex >= surah.totalVerses - 1} />
        </View>
        <Control name={r.repeat === 'ayah' ? 'repeat.1' : 'repeat'} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
      </View>

      {/* Away from the page being recited: a way back, quietly. */}
      {onBackToRecitation ? (
        <PressableScale haptic="select" onPress={onBackToRecitation} accessibilityRole="button" accessibilityHint="Turns to the page being recited" hitSlop={{ top: 8, bottom: 8 }}>
          <Text variant="footnote" style={{ textAlign: 'center', color: t.c.accentText, fontWeight: '600', paddingVertical: space.xs }}>
            Back to the recitation
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
