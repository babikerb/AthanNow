import { BottomSheet, Button as MenuButton, Group, Host, RNHostView, Section as MenuSection } from '@expo/ui/swift-ui';
import { presentationBackground, presentationBackgroundInteraction, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import { ayahText, HAFS_FONT } from 'quran-reader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { ayahAfter, ayahBefore, commentaryText, DEFAULT_MEANING_SOURCE, loadMeaning, MEANING_SOURCES, type AyahRef, type Meaning } from '../../quran/meaning';
import { QURAN_FONT } from '../../recitation/format';
import { NativeMenu } from '../NativeMenu';

const SOURCE_KEY = 'athannow.meaning.source.v1';

/**
 * The Meaning sheet: what a passage means. The ayahs it covers (each with its translation), then the
 * chosen commentary, with the passages before and after a tap away. A native sheet: half height with
 * the page still in view behind it, or full.
 */
export function MeaningSheet({
  ayah,
  onClose,
  onPassage,
  onPlay,
}: {
  /** The ayah held; null when closed. */
  ayah: AyahRef | null;
  onClose: () => void;
  /** The passage being explained, as it changes (the page tints it). */
  onPassage: (first: AyahRef, last: AyahRef) => void;
  onPlay: (from: AyahRef) => void;
}) {
  const t = useTheme();
  const [anchor, setAnchor] = useState<AyahRef | null>(ayah);
  const [source, setSource] = useState(DEFAULT_MEANING_SOURCE);
  const [meaning, setMeaning] = useState<Meaning | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(SOURCE_KEY)
      .then((v) => v && MEANING_SOURCES.some((s) => String(s.id) === v) && setSource(Number(v)))
      .catch(() => {});
  }, []);
  const chooseSource = useCallback((id: number) => {
    setSource(id);
    AsyncStorage.setItem(SOURCE_KEY, String(id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (ayah) setAnchor(ayah);
  }, [ayah]);

  // The explanation covering the anchor; a different commentary may group the ayahs differently.
  useEffect(() => {
    if (!anchor) return;
    let cancelled = false;
    setFailed(false);
    setMeaning((m) => (m && m.source === source && m.ayahs.some((a) => a.surah === anchor.surah && a.ayah === anchor.ayah) ? m : null));
    loadMeaning(source, anchor)
      .then((m) => {
        if (cancelled) return;
        setMeaning(m);
        onPassage(m.ayahs[0], m.ayahs[m.ayahs.length - 1]);
        scroll.current?.scrollTo({ y: 0, animated: false });
        // The passage after this one, ready for Next.
        const next = ayahAfter(m.ayahs[m.ayahs.length - 1]);
        if (next) loadMeaning(source, next).catch(() => {});
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [anchor?.surah, anchor?.ayah, source, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Until the commentary arrives, the held ayah stands alone.
  const ayahs = meaning?.ayahs ?? (anchor ? [anchor] : []);
  const first = ayahs[0];
  const last = ayahs[ayahs.length - 1];
  const surah = first ? getSurah(first.surah) : undefined;
  const sourceName = MEANING_SOURCES.find((s) => s.id === source)?.name ?? '';
  const before = first ? ayahBefore(first) : null;
  const after = last ? ayahAfter(last) : null;

  const share = () => {
    if (!meaning || !surah) return;
    const head = `${surah.transliteration} ${first.ayah}${last.ayah !== first.ayah ? `-${last.ayah}` : ''}`;
    const lines = ayahs.map((a) => `(${a.ayah}) ${ayahText(a.surah, a.ayah).translation}`).join('\n');
    Share.share({ message: `${head}\n\n${lines}\n\n${sourceName}\n\n${commentaryText(meaning.blocks)}` }).catch(() => {});
  };

  return (
    <Host style={{ position: 'absolute', width: 0, height: 0 }}>
      <BottomSheet isPresented={!!ayah} onIsPresentedChange={(open) => !open && onClose()}>
        <Group
          modifiers={[
            presentationDetents(['medium', 'large']),
            presentationDragIndicator('visible'),
            presentationBackgroundInteraction({ type: 'enabledUpThrough', detent: 'medium' }),
            presentationBackground(t.c.bg),
          ]}
        >
          <RNHostView>
            <View style={{ flex: 1, backgroundColor: t.c.bg }}>
              <SheetBody
                scrollRef={scroll}
                sourceName={sourceName}
                source={source}
                onSource={chooseSource}
                onShare={share}
                onClose={onClose}
                ayahs={ayahs}
                held={ayah}
                meaning={meaning}
                failed={failed}
                onRetry={() => setAttempt((n) => n + 1)}
                before={before}
                after={after}
                onGo={setAnchor}
                onPlay={() => first && onPlay(first)}
              />
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

function SheetBody({
  scrollRef,
  sourceName,
  source,
  onSource,
  onShare,
  onClose,
  ayahs,
  held,
  meaning,
  failed,
  onRetry,
  before,
  after,
  onGo,
  onPlay,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  sourceName: string;
  source: number;
  onSource: (id: number) => void;
  onShare: () => void;
  onClose: () => void;
  ayahs: AyahRef[];
  held: AyahRef | null;
  meaning: Meaning | null;
  failed: boolean;
  onRetry: () => void;
  before: AyahRef | null;
  after: AyahRef | null;
  onGo: (r: AyahRef) => void;
  onPlay: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const first = ayahs[0];
  const last = ayahs[ayahs.length - 1];
  const surah = first ? getSurah(first.surah) : undefined;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <NativeMenu
          height={44}
          colorScheme={t.scheme}
          items={
            <MenuSection title="Commentary">
              {MEANING_SOURCES.map((s) => (
                <MenuButton key={s.id} label={s.name} systemImage={s.id === source ? 'checkmark' : undefined} onPress={() => onSource(s.id)} />
              ))}
            </MenuSection>
          }
        >
          <View style={{ flex: 1, justifyContent: 'center' }} accessibilityLabel={`Commentary, ${sourceName}`}>
            <Text variant="title3" header numberOfLines={1}>
              Meaning
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                {sourceName}
              </Text>
              <SymbolView name="chevron.up.chevron.down" size={10} tintColor={t.c.textSecondary} />
            </View>
          </View>
        </NativeMenu>
        <IconButton name="square.and.arrow.up" label="Share" onPress={onShare} disabled={!meaning} />
        <IconButton name="xmark" label="Close" onPress={onClose} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: t.spacing.xl, paddingBottom: insets.bottom + t.spacing.xxxl }}>
        {surah ? (
          <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginTop: t.spacing.xs }}>
            {surah.transliteration}, {ayahs.length > 1 ? `explains ayahs ${first.ayah} to ${last.ayah}` : `ayah ${first.ayah}`}
          </Text>
        ) : null}

        {ayahs.map((a) => {
          const { arabic, translation } = ayahText(a.surah, a.ayah);
          const isHeld = !!held && held.surah === a.surah && held.ayah === a.ayah && ayahs.length > 1;
          return (
            <View
              key={`${a.surah}:${a.ayah}`}
              style={{
                marginTop: t.spacing.md,
                padding: t.spacing.md,
                borderRadius: t.radii.card,
                borderCurve: 'continuous',
                backgroundColor: isHeld ? t.c.accentSoft : t.c.surface1,
              }}
            >
              <RNText style={{ fontFamily: HAFS_FONT, fontSize: 26, lineHeight: 50, color: t.c.text, textAlign: 'right', writingDirection: 'rtl' }}>{arabic}</RNText>
              <Text variant="subhead" style={{ marginTop: t.spacing.xs }}>
                <Text variant="subhead" color="textSecondary" style={{ fontWeight: '600' }}>
                  {a.ayah}.{' '}
                </Text>
                {translation}
              </Text>
            </View>
          );
        })}

        <View style={{ marginTop: t.spacing.xl }}>
          {failed ? (
            <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xl }}>
              <SymbolView name="wifi.slash" size={24} tintColor={t.c.glyphQuiet} />
              <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
                The commentary couldn’t load. Check your connection.
              </Text>
              <PressableScale haptic="select" onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again">
                <View style={{ height: 40, paddingHorizontal: t.spacing.lg, borderRadius: 20, borderWidth: 1, borderColor: t.c.hairline, justifyContent: 'center' }}>
                  <Text variant="subhead" style={{ fontWeight: '600' }}>
                    Try again
                  </Text>
                </View>
              </PressableScale>
            </View>
          ) : !meaning ? (
            <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={t.c.textSecondary} />
            </View>
          ) : meaning.blocks.length ? (
            meaning.blocks.map((b, i) => (
              <Text
                key={i}
                variant={b.kind === 'heading' ? 'headline' : 'body'}
                header={b.kind === 'heading'}
                style={{ marginTop: i === 0 ? 0 : b.kind === 'heading' ? t.spacing.xl : t.spacing.md, lineHeight: b.kind === 'heading' ? undefined : 26 }}
              >
                {b.runs.map((r, j) =>
                  r.arabic ? (
                    <RNText key={j} style={{ fontFamily: QURAN_FONT, fontSize: 21, color: t.c.text }}>
                      {r.text}
                    </RNText>
                  ) : (
                    r.text
                  ),
                )}
              </Text>
            ))
          ) : (
            <Text variant="subhead" color="textSecondary">
              No commentary on this passage in {MEANING_SOURCES.find((s) => s.id === meaning.source)?.name}.
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.xxl, gap: t.spacing.sm }}>
          <NavButton label="Previous" icon="chevron.left" disabled={!before} onPress={() => before && onGo(before)} />
          <PressableScale haptic="light" onPress={onPlay} accessibilityRole="button" accessibilityLabel="Play this passage">
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <SymbolView name="play.fill" size={20} tintColor={t.c.onAccent} style={{ width: 24, height: 24, marginLeft: 2 }} />
            </View>
          </PressableScale>
          <NavButton label="Next" icon="chevron.right" trailing disabled={!after} onPress={() => after && onGo(after)} />
        </View>
      </ScrollView>
    </>
  );
}

function IconButton({ name, label, onPress, disabled }: { name: 'square.and.arrow.up' | 'xmark'; label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name={name} size={15} tintColor={disabled ? t.c.glyphQuiet : t.c.text} style={{ width: 20, height: 20 }} />
      </View>
    </PressableScale>
  );
}

function NavButton({ label, icon, trailing, disabled, onPress }: { label: string; icon: 'chevron.left' | 'chevron.right'; trailing?: boolean; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  const color = disabled ? t.c.glyphQuiet : t.c.text;
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} passage`} style={{ flex: 1 }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: trailing ? 'flex-end' : 'flex-start', gap: 6 }}>
        {!trailing ? <SymbolView name={icon} size={13} tintColor={color} /> : null}
        <Text variant="subhead" style={{ fontWeight: '600', color }}>
          {label}
        </Text>
        {trailing ? <SymbolView name={icon} size={13} tintColor={color} /> : null}
      </View>
    </PressableScale>
  );
}
