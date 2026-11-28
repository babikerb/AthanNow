import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, SectionList, Text as RNText, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { SFSymbol } from 'sf-symbols-typescript';

import { getSurah, SURAHS, type Surah } from '../data/surahs';
import { pageForSurah, TOTAL_PAGES } from '../data/surahPages';
import { PressableScale } from '../design/PressableScale';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import type { Palette } from '../theme/colors';
import { QURAN_FONT } from '../theme/colors';
import { bookmarkColor, type Bookmark } from '../hooks/useBookmarks';
import { firstAyahOnPage } from '../quran/pageLayout';
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
  /** The page being read: its surah and juz are marked, and the lists open on them. */
  currentPage?: number;
  /** The reader's bookmarks, for their tab. */
  bookmarks?: Bookmark[];
  onSelectBookmark?: (b: Bookmark) => void;
  /** @deprecated The sheet follows the app's colours. */
  palette?: Palette;
}

type Tab = 'surah' | 'juz' | 'bookmarks';
const ROW = 64;
const JUZ = JUZ_START.map((page, i) => ({ juz: i + 1, page, start: firstAyahOnPage(page) }));

/** A number in an eight-pointed star, as Quran apps mark a surah or juz. */
function StarBadge({ n, active }: { n: number; active: boolean }) {
  const t = useTheme();
  const c = 18;
  const pts = (r: number, turn: number) =>
    Array.from({ length: 4 }, (_, i) => {
      const a = (Math.PI / 2) * i + turn;
      return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    }).join(' ');
  return (
    <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={36} height={36} style={{ position: 'absolute' }}>
        {[0, Math.PI / 4].map((turn) => (
          <Polygon key={turn} points={pts(16, turn)} fill={active ? t.c.accent : 'none'} stroke={active ? t.c.accent : t.c.textTertiary} strokeWidth={1.2} strokeLinejoin="round" />
        ))}
      </Svg>
      <Text variant="caption" maxFontSizeMultiplier={1.1} style={{ fontWeight: '700', fontVariant: ['tabular-nums'], color: active ? t.c.onAccent : t.c.text }}>
        {n}
      </Text>
    </View>
  );
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
export function SurahPickerSheet({ visible, onClose, currentSurahId, onSelect, onSelectVerse, onSelectPage, currentPage, bookmarks, onSelectBookmark }: SurahPickerSheetProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const isArabic = /[؀-ۿ]/.test(q);

  const [tab, setTab] = useState<Tab>('surah');
  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);
  const currentJuz = currentPage ? JUZ.filter((j) => j.page <= currentPage).length : 0;

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
    if (q && surahs.length) out.push({ title: 'Surahs', data: surahs.map((surah) => ({ kind: 'surah' as const, surah })) });
    if (wantsAyahs && hits.length) out.push({ title: hits.length >= 60 ? 'Ayahs, the first 60' : `Ayahs, ${hits.length}`, data: hits.map((hit) => ({ kind: 'ayah' as const, hit })) });
    return out;
  }, [jumps, surahs, hits, wantsAyahs, q]);

  const nothing = !!q && !sections.length && !searching;

  // A surah: its number in a star, its name and kind and length, its Arabic name and page.
  const surahRow = (s: Surah) => {
    const current = s.id === currentSurahId;
    return (
      <PressableScale scaleTo={0.99} onPress={() => close(() => onSelect(s.id))} accessibilityRole="button" accessibilityLabel={`${s.id}, ${s.transliteration}, ${s.translation}, ${s.type === 'meccan' ? 'Meccan' : 'Medinan'}, ${s.totalVerses} ayahs, page ${pageForSurah(s.id)}`} accessibilityState={{ selected: current }}>
        <View style={{ height: ROW, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.lg, backgroundColor: current ? t.c.accentSoft : 'transparent' }}>
          <StarBadge n={s.id} active={current} />
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
              {s.transliteration}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {s.type === 'meccan' ? 'Meccan' : 'Medinan'}, {s.totalVerses} ayahs
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <RNText style={{ fontFamily: QURAN_FONT, fontSize: 21, lineHeight: 30, color: t.c.text }}>{s.arabicName}</RNText>
            <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
              Page {pageForSurah(s.id)}
            </Text>
          </View>
        </View>
      </PressableScale>
    );
  };

  const juzRow = (j: (typeof JUZ)[number]) => {
    const current = j.juz === currentJuz;
    const s = j.start ? getSurah(j.start.surah) : undefined;
    return (
      <PressableScale scaleTo={0.99} onPress={() => close(() => onSelectPage?.(j.page))} accessibilityRole="button" accessibilityLabel={`Juz ${j.juz}, from ${s?.transliteration} ${j.start?.surah}:${j.start?.ayah}, page ${j.page}`} accessibilityState={{ selected: current }}>
        <View style={{ height: ROW, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.lg, backgroundColor: current ? t.c.accentSoft : 'transparent' }}>
          <StarBadge n={j.juz} active={current} />
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontWeight: '600' }}>
              Juz {j.juz}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {s ? `From ${s.transliteration} ${j.start!.surah}:${j.start!.ayah}` : ''}
            </Text>
          </View>
          <Text variant="footnote" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            Page {j.page}
          </Text>
        </View>
      </PressableScale>
    );
  };

  const bookmarkRow = (b: Bookmark) => (
    <PressableScale scaleTo={0.99} onPress={() => close(() => onSelectBookmark?.(b))} accessibilityRole="button" accessibilityLabel={`${b.surahName}, page ${b.page ?? ''}`}>
      <View style={{ height: ROW, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.lg }}>
        <View style={{ width: 36, alignItems: 'center' }}>
          <SymbolView name="bookmark.fill" size={18} tintColor={bookmarkColor(b)} style={{ width: 22, height: 22 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
            {b.surahName}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {b.page ? `Page ${b.page}` : `Ayah ${b.ayah}`}
          </Text>
        </View>
      </View>
    </PressableScale>
  );

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
    if (item.kind === 'surah') return surahRow(item.surah);
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
    <Sheet visible={visible} onClose={onClose} title="Contents">
      <SheetSearchField placeholder="Search surahs, ayahs, pages or words" value={query} onChangeText={setQuery} returnKeyType="search" accessibilityLabel="Search the Quran" />
      {!q ? (
        // With nothing typed: the contents, by surah, by juz, or the bookmarks.
        <>
          <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm }}>
            <SegmentedControl<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'surah', label: 'Surah' },
                { value: 'juz', label: 'Juz' },
                ...(bookmarks ? [{ value: 'bookmarks' as Tab, label: 'Bookmarks' }] : []),
              ]}
            />
          </View>
          {tab === 'surah' ? (
            <FlatList
              key="surah"
              data={SURAHS}
              keyExtractor={(x) => String(x.id)}
              renderItem={({ item }) => surahRow(item)}
              getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
              initialScrollIndex={Math.max(0, Math.min(SURAHS.length - 1, currentSurahId - 3))}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: t.spacing.xxxl * 2 }}
              initialNumToRender={14}
              windowSize={7}
            />
          ) : tab === 'juz' ? (
            <FlatList
              key="juz"
              data={JUZ}
              keyExtractor={(x) => String(x.juz)}
              renderItem={({ item }) => juzRow(item)}
              getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
              initialScrollIndex={Math.max(0, currentJuz - 3)}
              contentContainerStyle={{ paddingBottom: t.spacing.xxxl * 2 }}
            />
          ) : bookmarks && bookmarks.length ? (
            <FlatList
              key="bookmarks"
              data={bookmarks}
              keyExtractor={(b) => `${b.page ?? 0}:${b.surahId}:${b.ayah}:${b.createdAt}`}
              renderItem={({ item }) => bookmarkRow(item)}
              contentContainerStyle={{ paddingBottom: t.spacing.xxxl * 2 }}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.xxl, paddingHorizontal: t.spacing.xl }}>
              <SymbolView name="bookmark" size={26} tintColor={t.c.glyphQuiet} />
              <Text variant="headline">No bookmarks yet</Text>
              <Text variant="subhead" color="textSecondary" style={{ textAlign: 'center' }}>
                Bookmark a page from the reader's menu, or hold an ayah.
              </Text>
            </View>
          )}
        </>
      ) : null}
      {!q ? null : nothing ? (
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
