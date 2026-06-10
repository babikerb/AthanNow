import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, QURAN_FONT } from '../theme/colors';
import { MushafLine, MushafPageData, MushafWord } from '../utils/mushaf';
import { toArabicNumber } from '../utils/quran';

interface MushafPageProps {
  data: MushafPageData;
  width: number;
  height: number;
  colors: Palette;
  dark: boolean;
}

function lineKind(line: MushafLine): 'surah_header' | 'bismillah' | 'normal' {
  if (line.words.some((w) => w.type === 'surah_header')) return 'surah_header';
  if (line.words.every((w) => w.type === 'bismillah')) return 'bismillah';
  return 'normal';
}

/** End-of-ayah marker: ornate brackets around the Eastern-Arabic ayah number. */
function ayahMarker(w: MushafWord): string {
  const n = w.verse_key ? Number(w.verse_key.split(':')[1]) : Number((w.text || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? `﴿${toArabicNumber(n)}﴾` : '';
}

/**
 * One mushaf page: real Unicode word text from the qcf4 layout, rendered in the
 * bundled Amiri font, with the page's exact line grouping preserved. Framed like a
 * printed mushaf and theme-aware for dark/light.
 */
function MushafPageInner({ data, width, height, colors, dark }: MushafPageProps) {
  const frameColor = dark ? 'rgba(255,255,255,0.16)' : 'rgba(120,90,40,0.35)';
  const paper = colors.surface;
  const lines = data.lines.length || 15;
  const baseFont = Math.min((height - 40) / lines / 1.85, width / 16);
  const markerColor = colors.textTertiary;

  return (
    <View style={[styles.outer, { width, height }]}>
      <View style={[styles.frame, { borderColor: frameColor, backgroundColor: paper }]}>
        <View style={[styles.inner, { borderColor: frameColor }]}>
          {data.lines.map((line) => {
            const kind = lineKind(line);
            if (kind === 'surah_header') {
              const text = line.words.map((w) => w.text).join(' ');
              return (
                <View key={line.line} style={styles.headerSlot}>
                  <View style={[styles.rule, { backgroundColor: frameColor }]} />
                  <Text style={[styles.headerText, { color: colors.textPrimary, fontSize: baseFont * 0.8 }]} numberOfLines={1} adjustsFontSizeToFit>
                    {text}
                  </Text>
                  <View style={[styles.rule, { backgroundColor: frameColor }]} />
                </View>
              );
            }
            return (
              <View key={line.line} style={styles.lineSlot}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.lineText, { fontFamily: QURAN_FONT, fontSize: baseFont, color: colors.textPrimary }]}
                >
                  {line.words.map((w, i) =>
                    w.type === 'end' ? (
                      <Text key={i} style={{ color: markerColor, fontSize: baseFont * 0.78 }}>
                        {' '}
                        {ayahMarker(w)}{' '}
                      </Text>
                    ) : (
                      `${w.text} `
                    ),
                  )}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export const MushafPage = React.memo(MushafPageInner);

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  frame: { flex: 1, alignSelf: 'stretch', marginVertical: 8, borderWidth: 1, borderRadius: 8, padding: 5 },
  inner: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 10 },
  lineSlot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lineText: { textAlign: 'center', writingDirection: 'rtl', includeFontPadding: false as any },
  headerSlot: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14 },
  headerText: { fontFamily: QURAN_FONT, writingDirection: 'rtl', textAlign: 'center' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, maxWidth: 40 },
});
