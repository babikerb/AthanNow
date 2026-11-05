import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text as RNText, View, type LayoutChangeEvent, type StyleProp, type ViewStyle, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { juzLabel } from '../../data/surahJuz';
import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { clock, QURAN_FONT, rateLabel } from '../../recitation/format';
import { BISMILLAH_TEXT, hasBismillah, splitAyahWords, type Ayah } from '../../recitation/quranAudio';
import { PLAYBACK_RATES, useRecitation, useRecitationProgress } from '../../recitation/RecitationProvider';
import { AyahEnd } from './AyahEnd';
import { ReciterSheet } from './ReciterSheet';
import { Scrubber } from './Scrubber';
import { TapTarget } from './TapTarget';

const ARABIC_SIZE = 36;
// Each word is its own block, so the one being recited can sit in a real rounded highlight (text
// backgrounds can't round and fill the whole line). WORD_LINE is the highlight's height; ROW_GAP
// keeps Amiri Quran's stacked marks off the row below. Every ayah is the same size, so nothing
// reflows when the recitation moves on.
const WORD_LINE = 74;
const ROW_GAP = 14;

// After the reader scrolls by hand, the list stops following the recitation for this long.
const FOLLOW_PAUSE_MS = 5000;
// The ayah being recited sits this far below the top of the list.
const FOLLOW_TOP_GAP = 12;
// The scroll waits this long after the last layout change, to aim at where the row ends up.
const FOLLOW_SETTLE_MS = 50;

// Inside a long ayah, a line this close to the bottom of the list scrolls up to this far down it.
const LINE_BOTTOM_MARGIN = 90;
const LINE_REST = 0.2;

type CellProps = { index: number; style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void; children?: React.ReactNode };

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
  // Only real drags count: the list's own animated scrolls end with the same momentum event.
  const dragging = useRef(false);
  const draggedAt = useRef(0);
  const [away, setAway] = useState(false);
  const visibleRef = useRef<Set<number>>(new Set());
  const indexRef = useRef(r.ayahIndex);
  indexRef.current = r.ayahIndex;
  const bismillahRef = useRef(r.inBismillah);
  bismillahRef.current = r.inBismillah;

  // Measured top of each rendered row, so a scroll lands exactly on it (scrollToIndex estimates).
  const offsets = useRef(new Map<number, number>());
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const following = useRef(false);
  const animate = useRef(false);

  const scrollToCurrent = useCallback(() => {
    following.current = false;
    const i = indexRef.current;
    const y = bismillahRef.current ? 0 : offsets.current.get(i);
    if (y != null) list.current?.scrollToOffset({ offset: Math.max(0, y - FOLLOW_TOP_GAP), animated: animate.current });
    else list.current?.scrollToIndex({ index: i, viewPosition: 0, animated: false });
    setAway(false);
  }, []);

  const follow = useCallback(
    (animated: boolean) => {
      following.current = true;
      animate.current = animated;
      if (settling.current) clearTimeout(settling.current);
      settling.current = setTimeout(scrollToCurrent, FOLLOW_SETTLE_MS);
    },
    [scrollToCurrent],
  );
  useEffect(() => () => {
    if (settling.current) clearTimeout(settling.current);
  }, []);

  useEffect(() => {
    if (r.ayahs.length && !dragging.current && Date.now() - draggedAt.current > FOLLOW_PAUSE_MS) follow(!t.reduceMotion);
  }, [r.ayahIndex, r.inBismillah, r.ayahs.length, r.showTranslation]); // eslint-disable-line react-hooks/exhaustive-deps

  const Cell = useMemo(
    () =>
      function Cell({ index, style, onLayout, children }: CellProps) {
        return (
          <View
            style={style}
            onLayout={(e) => {
              onLayout?.(e);
              offsets.current.set(index, e.nativeEvent.layout.y);
              // A row at or above the target moved it: aim again once layout has settled.
              if (following.current && index <= indexRef.current) follow(animate.current);
            }}
          >
            {children}
          </View>
        );
      },
    [follow],
  );

  const scrollY = useRef(0);
  const viewH = useRef(0);

  // An ayah taller than the list: keep the line being recited in view. `y` is its top within the
  // ayah's text. Holds off while the reader is scrolling and while the list is moving to the ayah.
  const followLine = useCallback(
    (y: number, h: number) => {
      const row = offsets.current.get(indexRef.current);
      if (row == null || following.current || dragging.current || Date.now() - draggedAt.current < FOLLOW_PAUSE_MS) return;
      const top = row + t.spacing.xl + y;
      const offscreen = top + h > scrollY.current + viewH.current - LINE_BOTTOM_MARGIN || top < scrollY.current;
      if (offscreen) list.current?.scrollToOffset({ offset: Math.max(0, top - viewH.current * LINE_REST), animated: !t.reduceMotion });
    },
    [t.spacing.xl, t.reduceMotion],
  );

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    visibleRef.current = new Set(viewableItems.map((v) => v.index ?? -1));
  }).current;
  const checkAway = () => setAway(!visibleRef.current.has(indexRef.current));
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    draggedAt.current = Date.now();
    checkAway();
  };

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

  const surah = r.surahId ? getSurah(r.surahId) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={r.ayahs}
        keyExtractor={(a) => String(a.number)}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        initialNumToRender={Math.min(r.ayahs.length, r.ayahIndex + 6)}
        windowSize={11}
        CellRendererComponent={Cell}
        scrollEventThrottle={32}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
        onScrollBeginDrag={() => {
          dragging.current = true;
          following.current = false;
          if (settling.current) clearTimeout(settling.current);
        }}
        onMomentumScrollEnd={endDrag}
        onScrollEndDrag={(e) => {
          // A drag released without a flick has no momentum phase to end it.
          if ((e.nativeEvent.velocity?.y ?? 0) === 0) endDrag();
        }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
        onScrollToIndexFailed={(info) => {
          // Row not rendered yet: get near it, then land once it has laid out.
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          follow(false);
        }}
        ListHeaderComponent={surah ? <SurahHeading surah={surah} lit={r.inBismillah} /> : null}
        renderItem={({ item, index }) => (
          <AyahItem
            ayah={item}
            index={index}
            current={index === r.ayahIndex}
            hiddenWords={index === 0 ? r.bismillahWords : 0}
            showTranslation={r.showTranslation}
            lit={index === r.ayahIndex && !r.inBismillah}
            onPress={r.goToAyah}
            onLine={followLine}
          />
        )}
        extraData={`${r.ayahIndex}:${r.inBismillah}:${r.showTranslation}`}
      />
      {away ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: t.spacing.md, alignItems: 'center' }}>
          <PressableScale
            haptic="select"
            onPress={() => {
              dragging.current = false;
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
  onLine,
}: {
  ayah: Ayah;
  index: number;
  current: boolean;
  hiddenWords: number;
  showTranslation: boolean;
  lit: boolean;
  onPress: (index: number) => void;
  onLine: (y: number, h: number) => void;
}) {
  const t = useTheme();
  const words = useMemo(() => splitAyahWords(ayah.arabic).slice(hiddenWords), [ayah.arabic, hiddenWords]);
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
        paddingVertical: t.spacing.xl,
      }}
    >
      {lit ? (
        <LitWords words={words} n={ayah.numberInSurah} onLine={onLine} />
      ) : (
        <AyahWords words={words} n={ayah.numberInSurah} color={current ? t.c.text : t.c.textSecondary} markColor={current ? t.c.accent : t.c.glyphQuiet} />
      )}
      {showTranslation && ayah.translation ? (
        <Text variant="body" color={current ? 'text' : 'textSecondary'} style={{ marginTop: t.spacing.md }}>
          <Text variant="body" color="textTertiary" style={{ fontWeight: '600' }}>
            {ayah.numberInSurah}.{' '}
          </Text>
          {ayah.translation}
        </Text>
      ) : null}
    </PressableScale>
  );
});

const Word = memo(function Word({
  text,
  index,
  on,
  color,
  highlight,
  onLayoutWord,
}: {
  text: string;
  index: number;
  on: boolean;
  color: string;
  highlight: string;
  onLayoutWord?: (index: number, e: LayoutChangeEvent) => void;
}) {
  return (
    <View
      onLayout={onLayoutWord ? (e) => onLayoutWord(index, e) : undefined}
      style={{ paddingHorizontal: 6, borderRadius: 14, borderCurve: 'continuous', backgroundColor: on ? highlight : 'transparent' }}
    >
      <RNText style={{ fontFamily: QURAN_FONT, fontSize: ARABIC_SIZE, lineHeight: WORD_LINE, color, writingDirection: 'rtl' }}>{text}</RNText>
    </View>
  );
});

/** An ayah's words right to left, wrapping, then its end mark. The layout is the same lit or not, so nothing shifts as the recitation moves on. */
function AyahWords({
  words,
  n,
  color,
  markColor,
  active,
  onLayoutWord,
}: {
  words: string[];
  n: number;
  color: string;
  markColor: string;
  active?: [number, number] | null;
  onLayoutWord?: (index: number, e: LayoutChangeEvent) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', rowGap: ROW_GAP }}>
      {words.map((w, i) => (
        <Word key={i} text={w} index={i} color={color} highlight={`${t.c.accent}3D`} on={!!active && i >= active[0] && i < active[1]} onLayoutWord={onLayoutWord} />
      ))}
      <AyahEnd n={n} size={ARABIC_SIZE} color={markColor} />
    </View>
  );
}

/**
 * The ayah being recited, with the word being spoken in its highlight. Only this item re-renders as
 * time passes, and of its words only the two changing state. Without word timing nothing is lit, and
 * how far through the clip it is stands in for the position.
 */
function LitWords({ words, n, onLine }: { words: string[]; n: number; onLine: (y: number, h: number) => void }) {
  const t = useTheme();
  const { activeWords, currentTime, duration } = useRecitationProgress();
  const rows = useRef<{ y: number; h: number }[]>([]);
  const onLayoutWord = useCallback((index: number, e: LayoutChangeEvent) => {
    rows.current[index] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
  }, []);

  const word = activeWords ? activeWords[0] : duration > 0 ? Math.floor((currentTime / duration) * words.length) : 0;
  const y = rows.current[word]?.y ?? 0;
  useEffect(() => {
    const row = rows.current[word];
    if (row && y > 0) onLine(row.y, row.h);
  }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AyahWords words={words} n={n} color={t.c.text} markColor={t.c.accent} active={activeWords} onLayoutWord={onLayoutWord} />;
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
      <Scrubber progress={r.preparing ? r.preparing.done / r.preparing.total : p.duration > 0 ? p.currentTime / p.duration : 0} onSeek={p.seekTo} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textSecondary">
          {clock(p.currentTime)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {r.preparing ? `Loading ${r.preparing.done} of ${r.preparing.total}` : r.inBismillah ? 'Bismillah' : total ? `Ayah ${r.ayahIndex + 1} of ${total}` : ''}
        </Text>
        <Text variant="caption" color="textSecondary">
          {clock(p.duration)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.md }}>
        <IconButton name={repeatIcon} label={repeatLabel} active={r.repeat !== 'off'} onPress={r.cycleRepeat} />
        <IconButton name="backward.fill" label="Previous ayah" size={26} onPress={r.previous} disabled={r.ayahIndex === 0 && !r.inBismillah} />
        <TapTarget
          size={72}
          haptic="light"
          onPress={r.togglePlay}
          accessibilityRole="button"
          accessibilityLabel={r.isPlaying ? 'Pause' : 'Play'}
          style={{ borderRadius: 36, backgroundColor: t.c.accent }}
        >
          {r.isPlaying && p.buffering ? (
            <ActivityIndicator color={t.c.onAccent} />
          ) : (
            // The play triangle's visual centre sits left of its box; nudge it so it reads centred.
            <SymbolView name={r.isPlaying ? 'pause.fill' : 'play.fill'} size={30} tintColor={t.c.onAccent} style={{ width: 30, height: 30, marginLeft: r.isPlaying ? 0 : 4 }} />
          )}
        </TapTarget>
        <IconButton name="forward.fill" label="Next ayah" size={26} onPress={r.next} disabled={r.ayahIndex >= total - 1 && !r.inBismillah} />
        <TapTarget
          size={48}
          haptic="select"
          onPress={() => r.setRate(nextRate)}
          accessibilityRole="button"
          accessibilityLabel={`Speed ${rateLabel(r.rate)}`}
          accessibilityHint={`Changes to ${rateLabel(nextRate)}`}
        >
          <Text variant="subhead" color={r.rate !== 1 ? 'accentText' : 'textSecondary'} style={{ fontWeight: '600' }} maxFontSizeMultiplier={1.2}>
            {rateLabel(r.rate)}
          </Text>
        </TapTarget>
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
    <TapTarget
      size={48}
      haptic="select"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <SymbolView name={name} size={size} tintColor={active ? t.c.accent : t.c.text} style={{ width: size + 4, height: size + 4 }} />
    </TapTarget>
  );
}

/** Above the first ayah: the surah's name, where it was revealed, and the Bismillah (lit while it plays). */
function SurahHeading({ surah, lit }: { surah: NonNullable<ReturnType<typeof getSurah>>; lit: boolean }) {
  const t = useTheme();
  const rule = <View style={{ flex: 1, height: 1, backgroundColor: t.c.hairline }} />;
  return (
    <View style={{ alignItems: 'center', paddingTop: t.spacing.sm, paddingBottom: t.spacing.xl }}>
      <Text accessibilityLanguage="ar" style={{ fontFamily: QURAN_FONT, fontSize: 40, lineHeight: 76, color: t.c.text }}>
        {'\u0633\u0648\u0631\u0629 ' + surah.arabicName}
      </Text>
      <Text variant="footnote" color="textSecondary">
        {surah.type === 'meccan' ? 'Meccan' : 'Medinan'}, {surah.totalVerses} ayahs, {juzLabel(surah.id)}
      </Text>
      {hasBismillah(surah.id) ? (
        <View style={{ alignSelf: 'stretch', marginTop: t.spacing.xl, paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: lit ? t.c.surface1 : 'transparent' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            {rule}
            <View style={{ width: 6, height: 6, backgroundColor: t.c.accent, transform: [{ rotate: '45deg' }] }} />
            {rule}
          </View>
          <Text
            accessibilityLanguage="ar"
            accessibilityLabel="Bismillah ir-Rahman ir-Rahim"
            style={{ fontFamily: QURAN_FONT, fontSize: 34, lineHeight: 72, textAlign: 'center', color: lit ? t.c.accent : t.c.text }}
          >
            {BISMILLAH_TEXT}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            {rule}
            <View style={{ width: 6, height: 6, backgroundColor: t.c.accent, transform: [{ rotate: '45deg' }] }} />
            {rule}
          </View>
        </View>
      ) : surah.id === 9 ? (
        <Text variant="footnote" color="textTertiary" style={{ marginTop: t.spacing.md, textAlign: 'center' }}>
          At-Tawbah opens without the Bismillah.
        </Text>
      ) : null}
    </View>
  );
}
