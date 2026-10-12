/**
 * In-app widgets: the visual reference for the WidgetKit widgets (widgets/AthanWidget.swift, Phase 8).
 *
 * What WidgetKit CANNOT do (so the Swift versions differ here on purpose, not by drift):
 *  - no animation: widgets are static timeline entries (the mount fade and the progress-rule animation are in-app only);
 *  - no per-second ticking: the countdown is `Text(date, style: .timer)`, the rule a stepped value or ProgressView(timerInterval:);
 *  - tinted / clear Home Screen modes ignore the sky gradient and accent: use containerBackground + widgetAccentable();
 *  - no adjustsFontSizeToFit (use minimumScaleFactor); Dynamic Type is handled by the system, so fixed geometry is safe;
 *  - Fraunces must be bundled in the extension target and registered in its Info.plist (UIAppFonts).
 * Emphasis follows the Swift widget: the NEXT prayer is bold with a tick; passed prayers are dimmed.
 */
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type TextProps } from 'react-native';

import { useTheme } from '../design/theme';
import { textStyle } from '../design/tokens';
import { numeral, wc, WidgetFrame } from './WidgetFrame';
import type { WidgetModel, WidgetRow } from './model';

interface WidgetProps {
  model: WidgetModel;
  scale?: number;
}

/** Fixed-geometry text: widgets do not follow in-app Dynamic Type (the system scales real widgets). */
const T = (p: TextProps) => <Text allowFontScaling={false} {...p} />;

const label = (size: 'caption' | 'footnote' | 'subhead' | 'body', color: string = wc.skyTextSecondary) => ({
  ...textStyle(size),
  color,
});

function City({ model, size = 11 }: { model: WidgetModel; size?: number }) {
  return (
    <View style={s.cityRow}>
      <SymbolView name="location.fill" size={size - 2} tintColor={wc.skyTextSecondary} />
      <T style={label('caption')} numberOfLines={1}>
        {model.city}
      </T>
    </View>
  );
}

const RULE_H = 3;
const RULE_GAP = 8;

/** Thin progress rule: the one apricot element in a widget (state, not decoration). Animates in on mount, then follows. */
function Rule({ progress, width }: { progress: number | null; width: number }) {
  const { reduceMotion } = useTheme();
  const v = useRef(new Animated.Value(reduceMotion ? (progress ?? 0) : 0)).current;
  const mounted = useRef(false);
  useEffect(() => {
    if (progress == null) return;
    if (!mounted.current && !reduceMotion) {
      mounted.current = true;
      Animated.timing(v, { toValue: progress, duration: 420, useNativeDriver: false }).start();
    } else {
      mounted.current = true;
      v.setValue(progress);
    }
  }, [progress, reduceMotion, v]);
  // Reserve the height even when unknown, so the layout never jumps.
  if (progress == null) return <View style={{ height: RULE_H, marginTop: RULE_GAP }} />;
  return (
    <View style={[s.rule, { width, backgroundColor: wc.skyHairline }]}>
      <Animated.View style={{ height: '100%', borderRadius: 2, backgroundColor: wc.accent, width: v.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }} />
    </View>
  );
}

/** Small (170x170): city, the next prayer's countdown as the hero, prayer + time, progress rule. */
export function SmallWidget({ model, scale }: WidgetProps) {
  return (
    <WidgetFrame family="small" stage={model.stage} scale={scale}>
      <City model={model} />
      <View style={{ flex: 1 }} />
      <T style={label('footnote', wc.skyText)} numberOfLines={1}>
        {model.nextLabel}
      </T>
      <T style={numeral(36)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {model.countdown}
      </T>
      <T style={label('caption')} numberOfLines={1}>
        {`at ${model.nextTime}`}
      </T>
      <Rule progress={model.progress} width={64} />
    </WidgetFrame>
  );
}

function PrayerRow({ r, size, showArabic }: { r: WidgetRow; size: 'footnote' | 'subhead'; showArabic?: boolean }) {
  const color = r.passed ? wc.skyTextSecondary : wc.skyText;
  const weight = r.next ? ({ fontWeight: '600' } as const) : null;
  return (
    <View style={[s.row, r.passed && s.passed]}>
      {r.next && <View style={[s.tick, { backgroundColor: wc.accent }]} />}
      <T style={[label(size, color), weight]} numberOfLines={1}>
        {r.label}
      </T>
      {showArabic && <T style={label('caption')}>{r.arabic}</T>}
      <View style={{ flex: 1 }} />
      <T style={[label(size, color), weight]}>{r.time}</T>
    </View>
  );
}

/** Medium (364x170): hero column on the left, the day's six prayers on the right. */
export function MediumWidget({ model, scale }: WidgetProps) {
  return (
    <WidgetFrame family="medium" stage={model.stage} scale={scale}>
      <View style={s.mediumBody}>
        <View style={s.heroCol}>
          <City model={model} />
          <View style={{ flex: 1 }} />
          <T style={label('footnote', wc.skyText)} numberOfLines={1}>
            {model.nextLabel}
          </T>
          <T style={numeral(32)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {model.countdown}
          </T>
          <T style={label('caption')} numberOfLines={1}>
            {`at ${model.nextTime}`}
          </T>
          <Rule progress={model.progress} width={56} />
        </View>
        <View style={s.listCol}>
          {model.rows.map((r) => (
            <PrayerRow key={r.id} r={r} size="footnote" />
          ))}
        </View>
      </View>
    </WidgetFrame>
  );
}

/** Large (364x382): hero up top, hairline, the full list with Arabic names. */
export function LargeWidget({ model, scale }: WidgetProps) {
  return (
    <WidgetFrame family="large" stage={model.stage} scale={scale}>
      <City model={model} size={13} />
      <View style={{ height: 14 }} />
      <T style={label('subhead', wc.skyText)} numberOfLines={1}>
        {model.nextLabel}
      </T>
      <T style={numeral(52)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {model.countdown}
      </T>
      <T style={label('footnote')} numberOfLines={1}>
        {`at ${model.nextTime}`}
      </T>
      <Rule progress={model.progress} width={96} />
      <View style={[s.hairline, { backgroundColor: wc.skyHairline }]} />
      <View style={s.largeList}>
        {model.rows.map((r) => (
          <PrayerRow key={r.id} r={r} size="subhead" showArabic />
        ))}
      </View>
    </WidgetFrame>
  );
}

const s = StyleSheet.create({
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rule: { height: RULE_H, borderRadius: 2, overflow: 'hidden', marginTop: RULE_GAP },
  mediumBody: { flex: 1, flexDirection: 'row', gap: 16 },
  heroCol: { flex: 1 },
  // 6 rows x 18pt + 5 x 5pt gaps = 133pt, inside the 138pt content height of a 170pt widget.
  listCol: { flex: 1, justifyContent: 'center', gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  passed: { opacity: 0.62 },
  tick: { position: 'absolute', left: 0, top: 1, bottom: 1, width: 3, borderRadius: 2 },
  hairline: { height: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 8 },
  largeList: { flex: 1, justifyContent: 'space-between' },
});
