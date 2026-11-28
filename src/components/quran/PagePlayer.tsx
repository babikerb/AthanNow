import { Button, Picker, Section, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { AirPlayButton } from 'quran-reader';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { clock } from '../../recitation/format';
import { RECITERS } from '../../recitation/reciters';
import { useRecitation, useRecitationProgress, useRecitationWord } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';
import { SheetIconButton } from '../Sheet';
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
 * position, repeat and skip. The recitation plays at the reciter's own pace. Before anything has played, play starts at the top of the page.
 */
export function PagePlayer({ onPlayPage, onMeaning }: { onPlayPage: () => void; onMeaning?: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const [open, setOpen] = useState(false);
  const surah = r.surahId ? getSurah(r.surahId) : undefined;

  const card = {
    borderRadius: 28,
    borderCurve: 'continuous' as const,
    backgroundColor: t.c.surface1,
    borderWidth: 1,
    borderColor: t.c.hairline,
    overflow: 'hidden' as const,
  };

  if (open && surah) return <Expanded onCollapse={() => setOpen(false)} onMeaning={onMeaning} style={card} />;

  const label = (
    <View style={{ flex: 1, justifyContent: 'center' }}>
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
          <NativeMenu height={54} colorScheme={t.scheme} items={<ReciterItems />}>
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
  const { buffering } = useRecitationWord();
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

/**
 * The player opened up: the reciter (tap to change) and close along the top, then the surah and ayah
 * with a Meaning button beside them, the ayah's position between its times, then the controls:
 * AirPlay, previous, play, next and repeat.
 */
function Expanded({ onCollapse, onMeaning, style }: { onCollapse: () => void; onMeaning?: () => void; style: object }) {
  const t = useTheme();
  const r = useRecitation();
  const p = useRecitationProgress();
  const surah = getSurah(r.surahId!)!;
  const repeatLabel = r.repeat === 'off' ? 'Repeat off' : r.repeat === 'ayah' ? 'Repeating this ayah' : 'Repeating this surah';

  return (
    <View style={[style, { borderRadius: 30, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.md }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        {/* The reciter, as a button that looks like one: tap to choose another. */}
        <NativeMenu height={44} colorScheme={t.scheme} items={<ReciterItems />}>
          <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center' }} accessibilityLabel={`Reciter, ${r.reciter.name}`} accessibilityHint="Choose another reciter">
            <View
              style={{
                maxWidth: '100%',
                height: 40,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: t.spacing.md,
                borderRadius: 20,
                backgroundColor: t.c.surface2,
                borderWidth: 1,
                borderColor: t.c.hairline,
              }}
            >
              <SymbolView name="person.wave.2.fill" size={14} tintColor={t.c.accent} style={{ width: 20, height: 20 }} />
              <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600', flexShrink: 1 }} maxFontSizeMultiplier={1.3}>
                {r.reciter.name}
              </Text>
              <SymbolView name="chevron.up.chevron.down" size={11} tintColor={t.c.textSecondary} />
            </View>
          </View>
        </NativeMenu>
        <SheetIconButton
          name="xmark"
          label="Stop"
          onPress={() => {
            onCollapse();
            r.stop();
          }}
        />
      </View>

      {/* Where the recitation is, and what that ayah means. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.md }}>
        <PressableScale scaleTo={1} onPress={onCollapse} accessibilityRole="button" accessibilityLabel={`${surah.transliteration}, ayah ${r.ayahIndex + 1}`} accessibilityHint="Folds the player away" style={{ flex: 1 }}>
          <Text variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {surah.transliteration}
          </Text>
          <Text variant="footnote" color="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            Ayah {r.ayahIndex + 1} of {surah.totalVerses}
          </Text>
        </PressableScale>
        {onMeaning ? (
          <PressableScale haptic="select" onPress={onMeaning} accessibilityRole="button" accessibilityLabel={`Meaning of ayah ${r.ayahIndex + 1}`} hitSlop={{ top: 4, bottom: 4 }}>
            <View
              style={{
                height: 36,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: t.spacing.md,
                borderRadius: 18,
                backgroundColor: t.c.accentSoft,
              }}
            >
              <SymbolView name="text.book.closed" size={13} tintColor={t.c.accent} style={{ width: 16, height: 16 }} />
              <Text variant="subhead" maxFontSizeMultiplier={1.3} style={{ fontWeight: '600', color: t.c.accent }}>
                Meaning
              </Text>
            </View>
          </PressableScale>
        ) : null}
      </View>

      {r.error ? (
        <Text variant="footnote" color="danger" style={{ textAlign: 'center', marginTop: t.spacing.xs }}>
          {r.error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.sm }}>
        <Text variant="footnote" color="textSecondary" style={{ fontVariant: ['tabular-nums'], minWidth: 36 }}>
          {r.loading ? '--:--' : clock(p.currentTime)}
        </Text>
        <View style={{ flex: 1 }}>
          <Scrubber progress={p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
        </View>
        <Text variant="footnote" color="textSecondary" style={{ fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' }}>
          -{clock(Math.max(0, p.duration - p.currentTime))}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.xs }}>
        <View style={{ width: 44, height: 44 }}>
          <AirPlayButton tint={t.c.text} />
        </View>
        <Icon name="backward.fill" label="Previous ayah" size={30} onPress={r.previous} disabled={r.ayahIndex === 0} />
        <BigPlay />
        <Icon name="forward.fill" label="Next ayah" size={30} onPress={r.next} disabled={r.ayahIndex >= surah.totalVerses - 1} />
        <Icon name={r.repeat === 'ayah' ? 'repeat.1' : 'repeat'} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
      </View>
    </View>
  );
}

/** The big play and pause in the open player: the glyph alone, large. */
function BigPlay() {
  const t = useTheme();
  const r = useRecitation();
  const { buffering } = useRecitationWord();
  return (
    <TapTarget size={64} haptic="light" onPress={r.togglePlay} accessibilityRole="button" accessibilityLabel={r.isPlaying ? 'Pause' : 'Play'}>
      {r.isPlaying && buffering ? (
        <ActivityIndicator color={t.c.text} />
      ) : (
        <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={40} tintColor={t.c.text} style={{ width: 44, height: 44 }} />
      )}
    </TapTarget>
  );
}
