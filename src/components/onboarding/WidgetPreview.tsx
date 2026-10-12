import { colorTokens } from '../../design/tokens.generated';
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import AmbientGradient from '../../components/AmbientGradient';
import SkyScene from '../../components/SkyScene';
import { prayerGradients, skyTextSecondary } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { type } from '../../theme/typography';
import { GradientBucket, timeOfDayBucket } from '../../utils/timeOfDayGradient';

const SCREEN = Dimensions.get('screen');
const PREVIEW_W = 260;
const PREVIEW_H = 132;
// Shrinks the real full-screen sky scene down to widget size while keeping
// every proportion (arc position, star field, glow radius) identical to the
// real Athan screen — see the `transformOrigin` note below for how.
const SCALE = PREVIEW_W / SCREEN.width;
// Same rough sky-strip offset the Athan screen uses (insets.top + 72); a
// fixed approximation is fine here since this is a static preview, not a
// live-rendered screen.
const SKY_AREA_Y = 96;

const PRAYER_LABELS: Record<GradientBucket, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/**
 * Widget-introduction preview: reuses the real `AmbientGradient` + `SkyScene`
 * components at a small scale instead of a static mockup image, so the
 * preview is literally accurate and can't drift from what the real
 * widget/home screen actually look like.
 *
 * `SkyScene` positions everything in absolute device-screen coordinates
 * (`Dimensions.get('screen')`), so it can't be handed a small container
 * directly. Instead we render it at full size inside a `transformOrigin:
 * 'top left'` scaled wrapper clipped by an `overflow: hidden` frame — the
 * standard technique for shrinking a screen-locked component into a
 * thumbnail without reimplementing its geometry.
 */
export function WidgetPreview() {
  const bucket = useMemo(() => timeOfDayBucket(), []);
  const gradient = prayerGradients[bucket];

  return (
    <View style={st.frame}>
      <View style={[st.scaledScreen, { width: SCREEN.width, height: SCREEN.height, transform: [{ scale: SCALE }] }]}>
        <AmbientGradient colors={gradient} scrimBottomOpacity={0.14} />
        <SkyScene prayer={bucket} skyAreaY={SKY_AREA_Y} />
      </View>
      <View style={st.overlay} pointerEvents="none">
        <Text style={st.prayerName}>{PRAYER_LABELS[bucket]}</Text>
        <Text style={st.subline}>Next prayer</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  frame: { width: PREVIEW_W, height: PREVIEW_H, borderRadius: radii.lg, overflow: 'hidden', alignSelf: 'center' },
  scaledScreen: { position: 'absolute', top: 0, left: 0, transformOrigin: [0, 0, 0] },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  prayerName: { ...type.title3, color: colorTokens.dark.skyText } as any,
  subline: { ...type.caption, color: skyTextSecondary } as any,
});
