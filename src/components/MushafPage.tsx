import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '../theme/colors';
import { glyph, MushafLine, MushafPageData } from '../utils/mushaf';

interface MushafPageProps {
  data: MushafPageData;
  width: number;
  height: number;
  colors: Palette;
  /** True once all fonts this page needs are registered. */
  fontsReady: boolean;
}

function lineIsHeader(line: MushafLine): boolean {
  return line.words.some((w) => w.type === 'surah_header');
}

function lineFont(line: MushafLine, pageFont: string): string {
  return line.words[0]?.font ?? pageFont;
}

function MushafPageInner({ data, width, height, colors, fontsReady }: MushafPageProps) {
  // Glyph lines are sized to fill the page width; clamp so long lines never wrap/overflow.
  const baseFont = Math.min(height / data.lines.length / 1.5, width / 12);

  if (!fontsReady) {
    return <View style={[styles.page, { width, height }]} />;
  }

  return (
    <View style={[styles.page, { width, height }]}>
      {data.lines.map((line) => {
        const header = lineIsHeader(line);
        const family = lineFont(line, data.font);
        const text = line.words.map(glyph).join(' ');
        return (
          <View key={line.line} style={styles.lineSlot}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.lineText,
                {
                  fontFamily: family,
                  fontSize: header ? baseFont * 0.92 : baseFont,
                  color: colors.textPrimary,
                  opacity: header ? 0.9 : 1,
                },
              ]}
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
  lineSlot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  lineText: { textAlign: 'center', writingDirection: 'rtl', includeFontPadding: false as any },
});
