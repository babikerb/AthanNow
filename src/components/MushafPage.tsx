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

function MushafPageInner({ data, width, height, colors, dark, isBookmarked, onBookmarkVerse }: MushafPageProps) {
  const frameColor = dark ? 'rgba(255,255,255,0.16)' : 'rgba(120,90,40,0.35)';
  const ruleColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,90,40,0.1)';
  const markerColor = colors.textTertiary;
  const lines = data.lines.length || 15;
  const baseFont = Math.min((height - 96) / lines / 1.85, width / 16);

  const surahNames = data.surahs.map((s) => getSurah(s.id)?.transliteration ?? s.name).join('  ');

  const longPress = (w: MushafWord) => {
    if (!w.verse_key) return;
    const [s, a] = w.verse_key.split(':').map(Number);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBookmarkVerse(s, a);
  };

  return (
    <View style={[styles.outer, { width, height }]}>
      {/* Top header: surahs on this page + juz/part */}
      <View style={styles.topHeader}>
        <Text style={[styles.topNames, { color: colors.textTertiary }]} numberOfLines={1}>
          {surahNames}
        </Text>
        <Text style={[styles.topPart, { color: colors.textTertiary }]}>Part {juzForPage(data.page)}</Text>
      </View>

      <View style={[styles.frame, { borderColor: frameColor, backgroundColor: colors.surface }]}>
        <View style={[styles.inner, { borderColor: frameColor }]}>
          {data.lines.map((line) => {
            const kind = lineKind(line);
            if (kind === 'surah_header') {
              const text = line.words.map((w) => w.text).join(' ');
              return (
                <View key={line.line} style={styles.lineSlot}>
                  <View style={[styles.band, { borderColor: frameColor, backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(120,90,40,0.06)' }]}>
                    <Text style={[styles.headerText, { color: colors.textPrimary, fontSize: baseFont * 0.78 }]} numberOfLines={1} adjustsFontSizeToFit>
                      {text}
                    </Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={line.line} style={[styles.lineSlot, { borderBottomColor: ruleColor }]}>
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
                    return (
                      <Text key={i} onLongPress={() => longPress(w)} style={marked ? { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(120,90,40,0.14)' } : undefined}>
                        {`${w.text} `}
                      </Text>
                    );
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Page number pill */}
      <View style={styles.pillWrap}>
        <View style={[styles.pagePill, { borderColor: frameColor }]}>
          <Text style={[styles.pageNum, { color: colors.textSecondary }]}>{data.page}</Text>
        </View>
      </View>
    </View>
  );
}

export const MushafPage = React.memo(MushafPageInner);

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 8, marginBottom: 4 },
  topNames: { fontSize: 12, flex: 1, marginRight: 12 },
  topPart: { fontSize: 12 },
  frame: { flex: 1, alignSelf: 'stretch', borderWidth: 1, borderRadius: 8, padding: 5 },
  inner: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  lineSlot: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  lineText: { textAlign: 'center', writingDirection: 'rtl', includeFontPadding: false as any },
  band: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingVertical: 4 },
  headerText: { fontFamily: QURAN_FONT, writingDirection: 'rtl', textAlign: 'center' },
  pillWrap: { alignItems: 'center', marginTop: 6 },
  pagePill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 3 },
  pageNum: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
