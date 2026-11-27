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
import { RoundIcon } from '../Sheet';

// Short ayahs that stand on their own, one a day in turn.
const AYAHS: [number, number][] = [
  [2, 152], [2, 186], [2, 286], [3, 139], [13, 28], [94, 5], [65, 3], [2, 153], [39, 53], [40, 60],
  [3, 173], [20, 114], [29, 69], [93, 3], [93, 5], [2, 45], [8, 46], [14, 7], [21, 87], [25, 63],
  [49, 13], [55, 13], [57, 4], [64, 11], [94, 6], [67, 2], [2, 115], [3, 200], [9, 51], [12, 87],
  [16, 97], [18, 46], [33, 41], [50, 16], [3, 8], [17, 24], [20, 25], [28, 24], [7, 23], [59, 22],
];

function todaysAyah(): [number, number] {
  const now = new Date();
  const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000);
  return AYAHS[((day % AYAHS.length) + AYAHS.length) % AYAHS.length];
}

/** One ayah for the day: the Arabic, its meaning, where it's from, and a quick share. Tap to open it. */
export function AyahOfTheDay({ dark, onOpenPage }: { dark: boolean; onOpenPage: (page: number) => void }) {
  const t = useTheme();
  const [surahId, ayah] = useMemo(todaysAyah, []);
  const surah = getSurah(surahId)!;
  const { arabic, translation } = useMemo(() => ayahText(surahId, ayah), [surahId, ayah]);
  if (!arabic) return null;
  const title = surah.transliteration;

  const share = (asImage: boolean) => {
    const done = shareAyah({ surah: surahId, ayah, title, asImage, colors: { bg: t.c.bg, text: t.c.text, accent: t.c.accent }, dark });
    if (!done) Share.share({ message: `${title} ${ayah}\n\n${arabic}\n\n“${translation}”\n\nShared from AthanNow, free on the App Store` }).catch(() => {});
  };

  return (
    <View style={{ marginTop: t.spacing.md, borderRadius: t.radii.feature, borderCurve: 'continuous', backgroundColor: t.c.surface1, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
      <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Ayah of the day
      </Text>
      <PressableScale scaleTo={0.99} onPress={() => onOpenPage(pageForAyah(surahId, ayah))} accessibilityRole="button" accessibilityLabel={`${title} ${ayah}: ${translation}`} accessibilityHint="Opens it in the mushaf">
        <RNText numberOfLines={4} style={{ fontFamily: HAFS_FONT, fontSize: 24, lineHeight: 46, color: t.c.text, textAlign: 'right', writingDirection: 'rtl', marginTop: t.spacing.sm }}>
          {arabic}
        </RNText>
        <Text variant="subhead" color="textSecondary" numberOfLines={4} style={{ marginTop: t.spacing.xs }}>
          {translation}
        </Text>
      </PressableScale>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
        <Text variant="footnote" style={{ fontWeight: '600' }}>
          {title} {ayah}
        </Text>
        {/* Share, as an image card or as text, like sharing from the mushaf. */}
        <NativeMenu
          width={36}
          height={36}
          colorScheme={t.scheme}
          items={
            <>
              <MenuButton label="As image" systemImage="photo" onPress={() => share(canShareAyahImage)} />
              <MenuButton label="As text" systemImage="text.quote" onPress={() => share(false)} />
            </>
          }
        >
          <RoundIcon name="square.and.arrow.up" label="Share this ayah" />
        </NativeMenu>
      </View>
    </View>
  );
}
