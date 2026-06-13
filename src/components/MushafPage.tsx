import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getSurah } from '../data/surahs';
import { Palette, QURAN_FONT } from '../theme/colors';
import { MushafLine, MushafPageData, MushafWord } from '../utils/mushaf';
import { toArabicNumber } from '../utils/quran';

// Standard Madani-mushaf juz (part) start pages, 1..30.
const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

function juzForPage(page: number): number {
  let j = 1;
  for (let i = 0; i < JUZ_START.length; i++) if (JUZ_START[i] <= page) j = i + 1;
  return j;
}

interface MushafPageProps {
  data: MushafPageData;
  /** verseKey -> full Uthmani words (with waqf marks); falls back to qcf4 text. */
  words: Record<string, string[]>;
  width: number;
  height: number;
  colors: Palette;
  dark: boolean;
  isBookmarked: (surahId: number, ayah: number) => boolean;
  onBookmarkVerse: (surahId: number, ayah: number) => void;
}

function lineKind(line: MushafLine): 'surah_header' | 'bismillah' | 'normal' {
  if (line.words.some((w) => w.type === 'surah_header')) return 'surah_header';
  if (line.words.every((w) => w.type === 'bismillah')) return 'bismillah';
  return 'normal';
}

function ayahMarker(w: MushafWord): string {
  const n = w.verse_key ? Number(w.verse_key.split(':')[1]) : Number((w.text || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? `﴿${toArabicNumber(n)}﴾` : '';
}

function MushafPageInner({ data, words, width, height, colors, dark, isBookmarked, onBookmarkVerse }: MushafPageProps) {
  const markerColor = colors.textTertiary;
  const bandColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,90,40,0.07)';
  const lines = data.lines.length || 15;
  // Fill the page edge-to-edge; reserve a little for the baked header/footer.
  const baseFont = Math.min((height - 64) / lines / 1.5, width / 12);

  const surahNames = data.surahs.map((s) => getSurah(s.id)?.transliteration ?? s.name).join('  ·  ');

  const longPress = (w: MushafWord) => {
    if (!w.verse_key) return;
    const [s, a] = w.verse_key.split(':').map(Number);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBookmarkVerse(s, a);
  };

  return (
    <View style={[styles.page, { width, height, backgroundColor: colors.background }]}>
      {/* Baked-in page header: surah(s) on this page, and the Juz. Centered so it
          stays clear of the floating corner controls. */}
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.textSecondary }]} numberOfLines={1}>
          {surahNames}
          <Text style={{ color: colors.textTertiary }}>{'   ·   Juz '}{juzForPage(data.page)}</Text>
        </Text>
      </View>

      {/* The page lines, filling all remaining height. No frame, no rules. */}
      <View style={styles.body}>
        {data.lines.map((line) => {
          const kind = lineKind(line);
          if (kind === 'surah_header') {
            const text = line.words.map((w) => w.text).join(' ');
            return (
              <View key={line.line} style={styles.lineSlot}>
                <View style={[styles.band, { backgroundColor: bandColor }]}>
                  <Text style={[styles.bandText, { color: colors.textPrimary, fontSize: baseFont * 0.74 }]} numberOfLines={1} adjustsFontSizeToFit>
                    {text}
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <View key={line.line} style={styles.lineSlot}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.lineText, { fontFamily: QURAN_FONT, fontSize: baseFont, color: colors.textPrimary }]}>
                {line.words.map((w, i) => {
                  if (w.type === 'end') {
                    return (
                      <Text key={i} style={{ color: markerColor, fontSize: baseFont * 0.78 }}>
                        {' '}{ayahMarker(w)}{' '}
                      </Text>
                    );
                  }
                  if (w.type === 'quarter') {
                    return (
                      <Text key={i} style={{ color: markerColor, fontSize: baseFont * 0.9 }}>
                        {'۞ '}
                      </Text>
                    );
                  }
                  let marked = false;
                  const vk = w.verse_key;
                  if (vk) {
                    const [s, a] = vk.split(':').map(Number);
                    marked = isBookmarked(s, a);
                  }
                  // Prefer the full Uthmani word (with waqf marks) when available.
                  const rich = vk && w.position ? words[vk]?.[w.position - 1] : undefined;
                  const display = rich ?? w.text;
                  return (
                    <Text key={i} onLongPress={() => longPress(w)} style={marked ? { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(120,90,40,0.14)' } : undefined}>
                      {`${display} `}
                    </Text>
                  );
                })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Baked-in page number. */}
      <Text style={[styles.pageNum, { color: colors.textTertiary }]}>{data.page}</Text>
    </View>
  );
}

export const MushafPage = React.memo(MushafPageInner);

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18 },
  header: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 56, height: 24 },
  headerText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1, justifyContent: 'space-evenly' },
  lineSlot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lineText: { textAlign: 'center', writingDirection: 'rtl', includeFontPadding: false as any },
  band: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingVertical: 4, marginVertical: 2 },
  bandText: { fontFamily: QURAN_FONT, writingDirection: 'rtl', textAlign: 'center' },
  pageNum: { alignSelf: 'center', fontSize: 12, fontVariant: ['tabular-nums'], height: 20, textAlign: 'center' },
});
