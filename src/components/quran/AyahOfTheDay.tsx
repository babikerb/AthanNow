import { Button as MenuButton } from '@expo/ui/swift-ui';
import { ayahText, canShareAyahImage, HAFS_FONT, shareAyah } from 'quran-reader';
import React, { useMemo } from 'react';
import { Text as RNText, Share, View } from 'react-native';

import { getSurah } from '../../data/surahs';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { pageForAyah } from '../../quran/pageLayout';
import { NativeMenu } from '../NativeMenu';
import { IconTarget, RoundIcon, TOUCH_TARGET } from '../../design/IconButton';

// Short ayahs that speak to everyday life, each with its theme: worry, patience, family, money, anger,
// death, nature and more (131 in all).
const AYAHS: [number, number, string][] = [
  [13, 28, 'worry and stress'],
  [94, 5, 'worry and stress'],
  [94, 6, 'worry and stress'],
  [65, 7, 'worry and stress'],
  [20, 46, 'worry and stress'],
  [3, 139, 'worry and stress'],
  [12, 86, 'worry and stress'],
  [39, 36, 'worry and stress'],
  [2, 153, 'patience'],
  [2, 155, 'patience'],
  [3, 200, 'patience'],
  [16, 127, 'patience'],
  [39, 10, 'patience'],
  [103, 3, 'patience'],
  [70, 5, 'patience'],
  [11, 115, 'patience'],
  [2, 45, 'patience'],
  [39, 53, 'hope'],
  [12, 87, 'hope'],
  [15, 56, 'hope'],
  [93, 3, 'hope'],
  [93, 5, 'hope'],
  [65, 3, 'hope'],
  [3, 160, 'hope'],
  [40, 60, 'hope'],
  [14, 7, 'gratitude'],
  [2, 152, 'gratitude'],
  [16, 18, 'gratitude'],
  [31, 12, 'gratitude'],
  [55, 13, 'gratitude'],
  [76, 3, 'gratitude'],
  [17, 23, 'parents and family'],
  [17, 24, 'parents and family'],
  [31, 14, 'parents and family'],
  [25, 74, 'parents and family'],
  [30, 21, 'parents and family'],
  [4, 1, 'parents and family'],
  [41, 34, 'kindness'],
  [25, 63, 'kindness'],
  [2, 83, 'kindness'],
  [16, 90, 'kindness'],
  [93, 9, 'kindness'],
  [93, 10, 'kindness'],
  [3, 134, 'kindness'],
  [5, 8, 'honesty and fairness'],
  [33, 70, 'honesty and fairness'],
  [17, 35, 'honesty and fairness'],
  [83, 1, 'honesty and fairness'],
  [2, 42, 'honesty and fairness'],
  [42, 37, 'anger and forgiving'],
  [24, 22, 'anger and forgiving'],
  [7, 199, 'anger and forgiving'],
  [42, 40, 'anger and forgiving'],
  [64, 14, 'anger and forgiving'],
  [9, 71, 'friendship'],
  [49, 10, 'friendship'],
  [43, 67, 'friendship'],
  [25, 28, 'friendship'],
  [2, 261, 'money and giving'],
  [2, 274, 'money and giving'],
  [3, 92, 'money and giving'],
  [64, 16, 'money and giving'],
  [17, 29, 'money and giving'],
  [57, 7, 'money and giving'],
  [2, 268, 'money and giving'],
  [53, 39, 'work and effort'],
  [29, 69, 'work and effort'],
  [62, 10, 'work and effort'],
  [67, 15, 'work and effort'],
  [94, 7, 'work and effort'],
  [20, 114, 'knowledge'],
  [96, 1, 'knowledge'],
  [58, 11, 'knowledge'],
  [39, 9, 'knowledge'],
  [35, 28, 'knowledge'],
  [17, 85, 'knowledge'],
  [3, 190, 'nature and creation'],
  [67, 3, 'nature and creation'],
  [16, 69, 'nature and creation'],
  [36, 40, 'nature and creation'],
  [88, 17, 'nature and creation'],
  [55, 19, 'nature and creation'],
  [3, 185, 'death and the hereafter'],
  [29, 57, 'death and the hereafter'],
  [62, 8, 'death and the hereafter'],
  [67, 2, 'death and the hereafter'],
  [89, 27, 'death and the hereafter'],
  [89, 28, 'death and the hereafter'],
  [99, 7, 'death and the hereafter'],
  [99, 8, 'death and the hereafter'],
  [3, 135, 'forgiveness and turning back'],
  [4, 110, 'forgiveness and turning back'],
  [11, 90, 'forgiveness and turning back'],
  [25, 70, 'forgiveness and turning back'],
  [2, 222, 'forgiveness and turning back'],
  [29, 45, 'prayer'],
  [20, 14, 'prayer'],
  [23, 1, 'prayer'],
  [23, 2, 'prayer'],
  [2, 238, 'prayer'],
  [11, 114, 'prayer'],
  [2, 186, 'dua'],
  [27, 62, 'dua'],
  [7, 55, 'dua'],
  [25, 77, 'dua'],
  [2, 201, 'dua'],
  [20, 25, 'dua'],
  [20, 26, 'dua'],
  [28, 24, 'dua'],
  [21, 87, 'dua'],
  [3, 159, 'trusting God'],
  [8, 2, 'trusting God'],
  [9, 51, 'trusting God'],
  [11, 6, 'trusting God'],
  [14, 12, 'trusting God'],
  [33, 3, 'trusting God'],
  [31, 18, 'humility'],
  [17, 37, 'humility'],
  [28, 83, 'humility'],
  [57, 23, 'humility'],
  [17, 53, 'speech'],
  [50, 18, 'speech'],
  [4, 148, 'speech'],
  [50, 16, 'being near to God'],
  [8, 24, 'being near to God'],
  [17, 82, 'the Quran itself'],
  [54, 17, 'the Quran itself'],
  [38, 29, 'the Quran itself'],
  [15, 9, 'the Quran itself'],
  [59, 21, 'the Quran itself'],
  [10, 57, 'the Quran itself']
];

/** A fixed shuffle of the list (a seeded Fisher-Yates): the days run through every ayah, in an order
 *  that feels random and moves between themes, before any comes round again. */
const ORDER = (() => {
  const order = AYAHS.map((_, i) => i);
  let seed = 20260101;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
})();

function todaysAyah(): [number, number, string] {
  const now = new Date();
  const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000);
  return AYAHS[ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length]];
}

/** One ayah for the day: the Arabic, its meaning, where it's from, and a quick share. Tap to open it. */
export function AyahOfTheDay({ dark, onOpenPage }: { dark: boolean; onOpenPage: (page: number) => void }) {
  const t = useTheme();
  const [surahId, ayah, theme] = useMemo(todaysAyah, []);
  const surah = getSurah(surahId)!;
  const { arabic, translation } = useMemo(() => ayahText(surahId, ayah), [surahId, ayah]);
  if (!arabic) return null;
  const title = surah.transliteration;

  const share = (asImage: boolean) => {
    const done = shareAyah({ surah: surahId, ayah, title, asImage, colors: { bg: t.c.bg, text: t.c.text, accent: t.c.accent }, dark });
    if (!done) Share.share({ message: `${title} ${surahId}:${ayah}\n\n${arabic}\n\n“${translation}”\n\nShared from AthanNow, free on the App Store` }).catch(() => {});
  };

  return (
    <View style={{ marginTop: t.spacing.md, borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
      <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Ayah of the day, on {theme}
      </Text>
      <PressableScale scaleTo={0.99} onPress={() => onOpenPage(pageForAyah(surahId, ayah))} accessibilityRole="button" accessibilityLabel={`${title} ${surahId}:${ayah}: ${translation}`} accessibilityHint="Opens it in the mushaf">
        <RNText numberOfLines={4} style={{ fontFamily: HAFS_FONT, fontSize: 24, lineHeight: 46, color: t.c.text, textAlign: 'right', writingDirection: 'rtl', marginTop: t.spacing.sm }}>
          {arabic}
        </RNText>
        <Text variant="subhead" color="textSecondary" numberOfLines={4} style={{ marginTop: t.spacing.xs }}>
          {translation}
        </Text>
      </PressableScale>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
        <Text variant="footnote" style={{ fontWeight: '600' }}>
          {title} {surahId}:{ayah}
        </Text>
        {/* Share, as an image card or as text, like sharing from the mushaf. */}
        <NativeMenu
          width={TOUCH_TARGET}
          height={TOUCH_TARGET}
          colorScheme={t.scheme}
          items={
            <>
              <MenuButton label="As image" systemImage="photo" onPress={() => share(canShareAyahImage)} />
              <MenuButton label="As text" systemImage="text.quote" onPress={() => share(false)} />
            </>
          }
        >
          <IconTarget>
            <RoundIcon name="square.and.arrow.up" label="Share this ayah" />
          </IconTarget>
        </NativeMenu>
      </View>
    </View>
  );
}
