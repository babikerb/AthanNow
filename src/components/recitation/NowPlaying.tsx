import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { juzLabel } from '../../data/surahJuz';
import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { arabicNumber, clock, QURAN_FONT, rateLabel } from '../../recitation/format';
import { hasBismillah, splitAyahWords, type Ayah } from '../../recitation/quranAudio';
import { PLAYBACK_RATES, useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';
import { ReciterSheet } from './ReciterSheet';
import { Scrubber } from './Scrubber';

const ARABIC = { fontFamily: QURAN_FONT, fontSize: 27, lineHeight: 56, textAlign: 'right' as const, writingDirection: 'rtl' as const };
// After the reader scrolls by hand, the list stops following the recitation for this long.
const FOLLOW_PAUSE_MS = 5000;

/** Full-screen player: the whole surah with the current ayah lit and followed, and the controls. */
export function NowPlaying({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const [reciters, setReciters] = useState(false);
  const surah = r.surahId ? getSurah(r.surahId) : undefined;

  return (
    <Modal visible={visible && !!surah} onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      {surah ? (
        <View style={{ flex: 1, backgroundColor: t.c.bg }}>
          <View style={{ alignItems: 'center', paddingTop: t.spacing.sm }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.c.surface3 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, gap: t.spacing.md }}>
            <IconButton name="chevron.down" label="Close player" onPress={onClose} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="title3" numberOfLines={1} header>
                {surah.transliteration}
              </Text>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                {surah.translation}, {juzLabel(surah.id)}
              </Text>
            </View>
            <IconButton
              name={r.showTranslation ? 'text.bubble.fill' : 'text.bubble'}
              label={r.showTranslation ? 'Hide translation' : 'Show translation'}
              active={r.showTranslation}
              onPress={() => r.setShowTranslation(!r.showTranslation)}
            />
          </View>

          <AyahList />

          <Controls bottom={insets.bottom} onReciters={() => setReciters(true)} />
          <ReciterSheet visible={reciters} selectedId={r.reciter.id} onSelect={r.setReciter} onClose={() => setReciters(false)} />
        </View>
      ) : null}
    </Modal>
  );
}

function AyahList() {
  const t = useTheme();
  const r = useRecitation();
  const list = useRef<FlatList<Ayah>>(null);
  const draggedAt = useRef(0);
  const [away, setAway] = useState(false);
  const visibleRef = useRef<Set<number>>(new Set());

  const follow = useCallback(
    (animated: boolean) => {
      if (!r.ayahs.length) return;
      list.current?.scrollToIndex({ index: Math.min(r.ayahIndex, r.ayahs.length - 1), viewPosition: 0.2, animated });
      setAway(false);
    },
    [r.ayahIndex, r.ayahs.length],
  );

  useEffect(() => {
    if (Date.now() - draggedAt.current > FOLLOW_PAUSE_MS) follow(!t.reduceMotion);
  }, [r.ayahIndex, r.ayahs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    visibleRef.current = new Set(viewableItems.map((v) => v.index ?? -1));
  }).current;
  const checkAway = () => setAway(!visibleRef.current.has(indexRef.current));
  const indexRef = useRef(r.ayahIndex);
  indexRef.current = r.ayahIndex;

  if (!r.ayahs.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xxl }}>
        {r.error ? (
          <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            {r.error}
          </Text>
        ) : (
          <ActivityIndicator color={t.c.textSecondary} />
        )}
      </View>
    );
  }

  const bismillah = r.surahId && hasBismillah(r.surahId) ? splitAyahWords(r.ayahs[0].arabic).slice(0, r.bismillahWords).join(' ') : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={r.ayahs}
        keyExtractor={(a) => String(a.number)}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        initialNumToRender={Math.min(r.ayahs.length, r.ayahIndex + 6)}
        windowSize={11}
        onScrollBeginDrag={() => (draggedAt.current = Date.now())}
        onMomentumScrollEnd={() => {
          draggedAt.current = Date.now();
          checkAway();
        }}
        onScrollEndDrag={checkAway}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.2, animated: false }), 120);
        }}
        onLayout={() => follow(false)}
        ListHeaderComponent={
          bismillah ? (
            <View style={{ alignItems: 'center', paddingBottom: t.spacing.lg }}>
              <Text
                accessibilityLanguage="ar"
                style={{ ...ARABIC, textAlign: 'center', fontSize: 24, color: r.inBismillah ? t.c.accent : t.c.textSecondary }}
              >
                {bismillah}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <AyahItem
            ayah={item}
            index={index}
            current={index === r.ayahIndex}
            hiddenWords={index === 0 ? r.bismillahWords : 0}
            showTranslation={r.showTranslation}
            lit={index === r.ayahIndex && !r.inBismillah}
            onPress={r.goToAyah}
          />
        )}
        extraData={`${r.ayahIndex}:${r.inBismillah}:${r.showTranslation}`}
      />
      {away ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: t.spacing.md, alignItems: 'center' }}>
          <PressableScale
            haptic="select"
            onPress={() => {
              draggedAt.current = 0;
              follow(!t.reduceMotion);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Back to ayah ${r.ayahIndex + 1}`}
            style={{ borderRadius: t.radii.pill, backgroundColor: t.c.surface3, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm }}
          >
            <Text variant="subhead" style={{ fontWeight: '600' }}>
              Back to ayah {r.ayahIndex + 1}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const AyahItem = memo(function AyahItem({
  ayah,
  index,
  current,
  hiddenWords,
  showTranslation,
  lit,
  onPress,
}: {
  ayah: Ayah;
  index: number;
  current: boolean;
  hiddenWords: number;
  showTranslation: boolean;
  lit: boolean;
  onPress: (index: number) => void;
}) {
  const t = useTheme();
  const words = splitAyahWords(ayah.arabic).slice(hiddenWords);
  return (
    <PressableScale
      scaleTo={1}
      haptic="select"
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`Ayah ${ayah.numberInSurah}. ${ayah.translation}`}
      accessibilityHint="Plays from this ayah"
      accessibilityState={{ selected: current }}
      style={{
        marginBottom: t.spacing.sm,
        borderRadius: t.radii.card,
        borderCurve: 'continuous',
        backgroundColor: current ? t.c.surface1 : 'transparent',
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.xs }}>
        <View
          style={{
            minWidth: 30,
            height: 30,
            paddingHorizontal: 6,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: current ? t.c.accentSoft : t.c.surface2,
          }}
        >
          <Text variant="caption" color={current ? 'accentText' : 'textSecondary'} style={{ fontWeight: '600' }}>
            {ayah.numberInSurah}
          </Text>
        </View>
      </View>
      {lit ? (
        <LitArabic words={words} />
      ) : (
        <Text accessibilityLanguage="ar" style={{ ...ARABIC, color: current ? t.c.text : t.c.textSecondary }}>
          {words.join(' ')} <Text style={{ color: t.c.glyphQuiet }}>{'۝' + arabicNumber(ayah.numberInSurah)}</Text>
        </Text>
      )}
      {showTranslation && ayah.translation ? (
        <Text variant="subhead" color={current ? 'text' : 'textSecondary'} style={{ marginTop: t.spacing.sm, lineHeight: 22, fontWeight: '400' }}>
          {ayah.translation}
        </Text>
      ) : null}
    </PressableScale>
  );
});

/** The ayah being recited, with the word being spoken in gold. Only this item re-renders as time passes. */
function LitArabic({ words }: { words: string[] }) {
  const t = useTheme();
  const { activeWords } = useRecitationProgress();
  return (
    <Text accessibilityLanguage="ar" style={{ ...ARABIC, color: t.c.text }}>
      {words.map((w, i) => {
        const on = !!activeWords && i >= activeWords[0] && i < activeWords[1];
        return (
          <Text key={i} style={on ? { color: t.c.accent } : undefined}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </Text>
        );
      })}
    </Text>
  );
}

function Controls({ bottom, onReciters }: { bottom: number; onReciters: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const p = useRecitationProgress();
  const repeatIcon: SFSymbol = r.repeat === 'ayah' ? 'repeat.1' : 'repeat';
  const repeatLabel = r.repeat === 'off' ? 'Repeat off' : r.repeat === 'ayah' ? 'Repeating this ayah' : 'Repeating this surah';
  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(r.rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length];
  const total = r.ayahs.length;

  return (
    <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: bottom + t.spacing.md, borderTopWidth: 1, borderTopColor: t.c.hairline, backgroundColor: t.c.bg }}>
      {r.error && r.ayahs.length ? (
        <Text variant="footnote" color="danger" style={{ textAlign: 'center', marginBottom: t.spacing.sm }}>
          {r.error}
        </Text>
      ) : null}
      <Scrubber progress={p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textSecondary">
          {clock(p.currentTime)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {r.inBismillah ? 'Bismillah' : total ? `Ayah ${r.ayahIndex + 1} of ${total}` : ''}
        </Text>
        <Text variant="caption" color="textSecondary">
          {clock(p.duration)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.md }}>
        <IconButton name={repeatIcon} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
        <IconButton name="backward.fill" label="Previous ayah" size={26} onPress={r.previous} disabled={r.ayahIndex === 0 && !r.inBismillah} />
        <PressableScale
          haptic="light"
          onPress={r.togglePlay}
          accessibilityRole="button"
          accessibilityLabel={r.isPlaying ? 'Pause' : 'Play'}
          style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          {r.isPlaying && p.buffering ? (
            <ActivityIndicator color={t.c.onAccent} />
          ) : (
            <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={28} tintColor={t.c.onAccent} style={{ marginLeft: r.isPlaying ? 0 : 3 }} />
          )}
        </PressableScale>
        <IconButton name="forward.fill" label="Next ayah" size={26} onPress={r.next} disabled={r.ayahIndex >= total - 1 && !r.inBismillah} />
        <PressableScale
          haptic="select"
          onPress={() => r.setRate(nextRate)}
          accessibilityRole="button"
          accessibilityLabel={`Speed ${rateLabel(r.rate)}`}
          accessibilityHint={`Changes to ${rateLabel(nextRate)}`}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="subhead" color={r.rate !== 1 ? 'accentText' : 'textSecondary'} style={{ fontWeight: '600' }}>
            {rateLabel(r.rate)}
          </Text>
        </PressableScale>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.md, gap: t.spacing.md }}>
        <PressableScale
          haptic="select"
          onPress={onReciters}
          accessibilityRole="button"
          accessibilityLabel={`Reciter, ${r.reciter.name}`}
          accessibilityHint="Choose a reciter"
          style={{ flexShrink: 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <SymbolView name="person.wave.2" size={16} tintColor={t.c.textSecondary} />
            <Text variant="subhead" numberOfLines={1} style={{ fontWeight: '600', flexShrink: 1 }}>
              {r.reciter.name}
            </Text>
            <SymbolView name="chevron.up.chevron.down" size={11} weight="semibold" tintColor={t.c.glyphQuiet} />
          </View>
        </PressableScale>
        <Pressable
          onPress={() => r.setAutoplay(!r.autoplay)}
          accessibilityRole="switch"
          accessibilityState={{ checked: r.autoplay }}
          accessibilityLabel="Continue to the next surah"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
        >
          <SymbolView name={r.autoplay ? 'arrow.forward.circle.fill' : 'arrow.forward.circle'} size={17} tintColor={r.autoplay ? t.c.accent : t.c.textSecondary} />
          <Text variant="subhead" color={r.autoplay ? 'accentText' : 'textSecondary'}>
            Next surah
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({ name, label, onPress, active, disabled, size = 20 }: { name: SFSymbol; label: string; onPress: () => void; active?: boolean; disabled?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <SymbolView name={name} size={size} tintColor={active ? t.c.accent : t.c.text} />
    </PressableScale>
  );
}
