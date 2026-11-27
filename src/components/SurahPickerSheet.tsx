import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, SectionList, Text as RNText, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { getSurah, SURAHS, type Surah } from '../data/surahs';
import { pageForSurah, TOTAL_PAGES } from '../data/surahPages';
import { PressableScale } from '../design/PressableScale';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import type { Palette } from '../theme/colors';
import { QURAN_FONT } from '../theme/colors';
import { JUZ_START } from '../utils/mushaf';
import { searchAyat, searchMeaning, type AyahHit } from '../utils/quran';
import { Sheet, SheetSearchField } from './Sheet';

interface SurahPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentSurahId: number;
  onSelect: (surahId: number) => void;
  /** Jump to a specific "surah:ayah" reference (e.g. "2:286"). */
  onSelectVerse?: (verseKey: string) => void;
  /** Jump to a 1-based mushaf page number. */
  onSelectPage?: (page: number) => void;
  /** @deprecated The sheet follows the app's colours. */
  palette?: Palette;
}

type Jump = { key: string; icon: SFSymbol; title: string; subtitle: string; go: () => void };
type Row = { kind: 'jump'; jump: Jump } | { kind: 'surah'; surah: Surah } | { kind: 'ayah'; hit: AyahHit };

/** Folds a name for matching: no case, accents, hyphens, apostrophes or a leading "al". */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’`ʿʾ\-\s]/g, '')
    .replace(/^(adh|ash|al|an|ar|as|at|ad|az)(?=[a-z]{3})/, '')
    .replace(/h$/, '');
}

const FOLDED = SURAHS.map((s) => ({ surah: s, name: fold(s.transliteration), meaning: s.translation.toLowerCase() }));

/** Surahs matching the query: by number, name (however it's spelled), meaning or Arabic name. */
function matchSurahs(query: string): Surah[] {
  const q = query.trim();
  if (!q) return SURAHS;
  if (/^\d{1,3}$/.test(q)) {
    const s = getSurah(Number(q));
    return s ? [s] : [];
  }
  const f = fold(q);
  const lower = q.toLowerCase();
  const scored = FOLDED.map(({ surah, name, meaning }) => {
    let score = 0;
    if (f && name.startsWith(f)) score = 3;
    else if (f && name.includes(f)) score = 2;
    else if (meaning.includes(lower) || surah.arabicName.includes(q)) score = 1;
    return { surah, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.surah.id - b.surah.id);
  return scored.map((x) => x.surah);
}

/**
 * Go to: one search for everything. Type a surah (any spelling: "baqara", "yasin", "kahf"), a
 * reference ("2:255", "2 255", "baqarah 255"), a page ("page 50", or any number past 114), a juz
 * ("juz 30"), or words, in English ("mercy", "patience") or Arabic. Results come as quick jumps,
 * then surahs, then ayahs.
 */
export function SurahPickerSheet({ visible, onClose, currentSurahId, onSelect, onSelectVerse, onSelectPage }: SurahPickerSheetProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const isArabic = /[؀-ۿ]/.test(q);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const close = (then: () => void) => {
    then();
    onClose();
  };

  // Quick jumps: a reference, a page, a juz.
  const jumps = useMemo<Jump[]>(() => {
    const out: Jump[] = [];
    const lower = q.toLowerCase();
    // "2:255", "2.255", "2 255"
    let ref = lower.match(/^(\d{1,3})\s*[:. ]\s*(\d{1,3})$/);
    let surahId = ref ? Number(ref[1]) : 0;
    let ayah = ref ? Number(ref[2]) : 0;
    // "baqarah 255", "al-kahf 10"
    if (!ref) {
      const named = lower.match(/^([a-z'‘’\- ]{3,}?)\s*[: ]\s*(\d{1,3})$/);
      if (named) {
        const s = matchSurahs(named[1])[0];
        if (s) {
          surahId = s.id;
          ayah = Number(named[2]);
          ref = named;
        }
      }
    }
    const s = surahId ? getSurah(surahId) : undefined;
    if (ref && s && ayah >= 1 && ayah <= s.totalVerses && onSelectVerse) {
      out.push({ key: 'verse', icon: 'text.book.closed', title: `${s.transliteration} ${s.id}:${ayah}`, subtitle: 'Go to this ayah', go: () => close(() => onSelectVerse(`${s.id}:${ayah}`)) });
    }
    const labelled = lower.match(/^(?:page|pg|p)\s*(\d{1,3})$/);
    const page = labelled ? Number(labelled[1]) : /^\d{1,3}$/.test(lower) && Number(lower) > 114 ? Number(lower) : 0;
    if (page >= 1 && page <= TOTAL_PAGES && onSelectPage) {
      out.push({ key: 'page', icon: 'book.pages', title: `Page ${page}`, subtitle: 'Go to this page', go: () => close(() => onSelectPage(page)) });
    }
    const juz = lower.match(/^(?:juz|juzz|jz|j|para)\s*(\d{1,2})$/);
    const j = juz ? Number(juz[1]) : 0;
    if (j >= 1 && j <= 30 && onSelectPage) {
      out.push({ key: 'juz', icon: 'square.stack', title: `Juz ${j}`, subtitle: `From page ${JUZ_START[j - 1]}`, go: () => close(() => onSelectPage(JUZ_START[j - 1])) });
    }
    return out;
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const surahs = useMemo(() => (jumps.some((x) => x.key === 'verse') ? [] : matchSurahs(q)), [q, jumps]);

  // Ayahs: Arabic text, or English meaning; alongside surah matches, not instead of them.
  const wantsAyahs = !jumps.length && (isArabic ? q.length >= 2 : /[a-z]/i.test(q) && q.replace(/[^a-z]/gi, '').length >= 3);
  const [hits, setHits] = useState<AyahHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!wantsAyahs) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      (isArabic ? searchAyat(q).then((h) => h.slice(0, 60)) : searchMeaning(q))
        .then((h) => !cancelled && setHits(h))
        .catch(() => !cancelled && (setHits([]), setFailed(true)))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, wantsAyahs, isArabic]);

  const sections = useMemo(() => {
    const out: { title: string; data: Row[] }[] = [];
    if (jumps.length) out.push({ title: 'Go to', data: jumps.map((jump) => ({ kind: 'jump' as const, jump })) });
    if (surahs.length) out.push({ title: q ? 'Surahs' : 'All surahs', data: surahs.map((surah) => ({ kind: 'surah' as const, surah })) });
    if (wantsAyahs && hits.length) out.push({ title: hits.length >= 60 ? 'Ayahs, the first 60' : `Ayahs, ${hits.length}`, data: hits.map((hit) => ({ kind: 'ayah' as const, hit })) });
    return out;
  }, [jumps, surahs, hits, wantsAyahs, q]);

  const nothing = !!q && !sections.length && !searching;

  const row = (item: Row) => {
    if (item.kind === 'jump') {
      const { jump } = item;
      return (
        <PressableScale scaleTo={0.99} onPress={jump.go} accessibilityRole="button" accessibilityLabel={jump.title}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginHorizontal: t.spacing.lg, marginBottom: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.accentSoft }}>
            <SymbolView name={jump.icon} size={18} tintColor={t.c.accentText} style={{ width: 24, height: 24 }} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{jump.title}</Text>
              <Text variant="footnote" color="textSecondary">
                {jump.subtitle}
              </Text>
            </View>
            <SymbolView name="arrow.right" size={14} tintColor={t.c.accentText} />
          </View>
        </PressableScale>
      );
    }
    if (item.kind === 'surah') {
      const s = item.surah;
      const current = s.id === currentSurahId;
      return (
        <PressableScale scaleTo={0.99} onPress={() => close(() => onSelect(s.id))} accessibilityRole="button" accessibilityLabel={`${s.id}, ${s.transliteration}, ${s.translation}`} accessibilityState={{ selected: current }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm + 2 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? t.c.accent : t.c.surface2 }}>
              <Text variant="footnote" style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: current ? t.c.onAccent : t.c.textSecondary }}>
                {s.id}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                {s.transliteration}
              </Text>
              <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                {s.translation}, {s.totalVerses} ayahs, page {pageForSurah(s.id)}
              </Text>
            </View>
            <RNText style={{ fontFamily: QURAN_FONT, fontSize: 20, color: t.c.text }}>{s.arabicName}</RNText>
          </View>
        </PressableScale>
      );
    }
    const h = item.hit;
    return (
      <PressableScale scaleTo={0.99} onPress={() => close(() => onSelectVerse?.(h.key))} accessibilityRole="button" accessibilityLabel={`${h.surahName} ${h.key}${h.translation ? `, ${h.translation}` : ''}`}>
        <View style={{ marginHorizontal: t.spacing.lg, marginBottom: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, gap: 4 }}>
          <RNText numberOfLines={2} style={{ fontFamily: QURAN_FONT, fontSize: 20, lineHeight: 36, color: t.c.text, textAlign: 'right', writingDirection: 'rtl' }}>
            {h.text}
          </RNText>
          {h.translation ? (
            <Text variant="subhead" color="textSecondary" numberOfLines={3}>
              {h.translation}
            </Text>
          ) : null}
          <Text variant="caption" style={{ fontWeight: '600', color: t.c.accentText }}>
            {h.surahName} {h.key}
          </Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Go to">
      <SheetSearchField placeholder="Surah, 2:255, page 50, juz 30, or a word" value={query} onChangeText={setQuery} returnKeyType="search" accessibilityLabel="Search the Quran" />
      {!q ? (
        // With nothing typed: each juz a tap away, above the surahs.
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.md }}>
            {JUZ_START.map((p, i) => (
              <PressableScale key={i} haptic="select" onPress={() => close(() => onSelectPage?.(p))} accessibilityRole="button" accessibilityLabel={`Juz ${i + 1}, page ${p}`}>
                <View style={{ height: 36, paddingHorizontal: t.spacing.md, borderRadius: 18, justifyContent: 'center', backgroundColor: t.c.surface2 }}>
                  <Text variant="subhead" style={{ fontWeight: '600' }}>
                    Juz {i + 1}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {nothing ? (
        <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.xxl, paddingHorizontal: t.spacing.xl }}>
          <SymbolView name={failed ? 'wifi.slash' : 'magnifyingglass'} size={26} tintColor={t.c.glyphQuiet} />
          <Text variant="headline" style={{ textAlign: 'center' }}>
            {failed ? 'Search needs a connection the first time' : 'Nothing found'}
          </Text>
          <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
            {failed ? 'Ayah search downloads the Quran once, then works offline.' : 'Try a surah name, a reference like 2:255, a page, or another word.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(r) => (r.kind === 'jump' ? r.jump.key : r.kind === 'surah' ? `s${r.surah.id}` : `a${r.hit.key}`)}
          renderItem={({ item }) => row(item)}
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: t.c.bg, paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm, paddingBottom: t.spacing.xs }}>
              <Text variant="caption" color="textSecondary" header style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {section.title}
              </Text>
            </View>
          )}
          ListFooterComponent={
            searching ? (
              <View style={{ paddingVertical: t.spacing.xl }}>
                <ActivityIndicator color={t.c.textSecondary} />
              </View>
            ) : null
          }
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: t.spacing.xxxl * 2 }}
          initialNumToRender={20}
        />
      )}
    </Sheet>
  );
}
