import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, QURAN_FONT } from '../theme/colors';
import { MushafLine, MushafPageData } from '../utils/mushaf';

interface MushafPageProps {
  data: MushafPageData;
  width: number;
  height: number;
  colors: Palette;
}

function lineIsHeader(line: MushafLine): boolean {
  return line.words.some((w) => w.type === 'surah_header');
}

/**
 * Renders one mushaf page using the real Unicode word text from the qcf4 layout,
 * in the bundled Amiri Quran font. The page's exact line grouping is preserved
 * (each line holds the words that physically sit on that line), so spatial memory
 * is kept without depending on remote glyph fonts.
 */
function MushafPageInner({ data, width, height, colors }: MushafPageProps) {
  const baseFont = Math.min(height / data.lines.length / 1.7, width / 13);

  return (
    <View style={[styles.page, { width, height }]}>
      {data.lines.map((line) => {
        const header = lineIsHeader(line);
        const text = line.words.map((w) => w.text).join(' ');
        if (header) {
          return (
            <View key={line.line} style={styles.headerSlot}>
              <View style={[styles.rule, { backgroundColor: colors.separator }]} />
              <Text style={[styles.headerText, { color: colors.textPrimary, fontSize: baseFont * 0.78 }]} numberOfLines={1} adjustsFontSizeToFit>
                {text}
              </Text>
              <View style={[styles.rule, { backgroundColor: colors.separator }]} />
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
              {text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const MushafPage = React.memo(MushafPageInner);

const styles = StyleSheet.create({
  page: { justifyContent: 'center', alignSelf: 'center' },
  lineSlot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  lineText: { textAlign: 'center', writingDirection: 'rtl', includeFontPadding: false as any },
  headerSlot: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  headerText: { fontFamily: QURAN_FONT, writingDirection: 'rtl', textAlign: 'center' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, maxWidth: 48 },
});
