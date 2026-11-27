import { Picker, Section, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import type { PageColor, ReaderView, TextTone } from 'quran-reader';
import type { SFSymbol } from 'sf-symbols-typescript';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../design/PressableScale';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { Toggle } from '../../design/Toggle';
import { TEXT_SCALES, type Display } from '../../quran/display';
import { QURAN_FONT } from '../../recitation/format';
import { RECITERS } from '../../recitation/reciters';
import { useRecitation, type RepeatMode } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';

type Tab = 'reading' | 'view' | 'recitation';

const COLORS: { id: PageColor; name: string; bg: string; ink: string }[] = [
  { id: 'night', name: 'Night', bg: '#000000', ink: '#F4F3F8' },
  { id: 'charcoal', name: 'Charcoal', bg: '#1C1C1F', ink: '#F4F3F8' },
  { id: 'sepia', name: 'Sepia', bg: '#F4ECD8', ink: '#2B2118' },
  { id: 'paper', name: 'Paper', bg: '#F8F8FC', ink: '#1D1B26' },
];
const TONES: { id: TextTone; name: string }[] = [
  { id: 'standard', name: 'Standard' },
  { id: 'soft', name: 'Soft' },
  { id: 'warm', name: 'Warm' },
];
const VIEWS: { id: ReaderView; name: string; detail: string; icon: SFSymbol }[] = [
  { id: 'mushaf', name: 'Mushaf', detail: 'The printed page. Pinch to read it larger.', icon: 'book' },
  { id: 'translation', name: 'Translation', detail: 'Each ayah, with its meaning beneath.', icon: 'text.alignleft' },
  { id: 'words', name: 'Word by word', detail: 'Each word, with its meaning beneath.', icon: 'textformat.abc' },
];

/**
 * The reader's display panel, floating over the foot of the page: how it reads (page and text colour,
 * text size), how it's laid out (Mushaf, Translation, Word by word) and the recitation's options.
 */
export function DisplayPanel({ display, onClose }: { display: Display; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('reading');

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close display options" />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: t.spacing.md,
          right: t.spacing.md,
          bottom: insets.bottom + 76,
          borderRadius: 32,
          borderCurve: 'continuous',
          backgroundColor: t.c.surface1,
          borderWidth: 1,
          borderColor: t.c.hairline,
          padding: t.spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <SegmentedControl<Tab>
              options={[
                { value: 'reading', label: 'Reading' },
                { value: 'view', label: 'View' },
                { value: 'recitation', label: 'Recitation' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
          <PressableScale haptic="select" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.c.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <SymbolView name="xmark" size={14} tintColor={t.c.text} style={{ width: 18, height: 18 }} />
            </View>
          </PressableScale>
        </View>
        {tab === 'reading' ? <ReadingTab display={display} /> : tab === 'view' ? <ViewTab display={display} /> : <RecitationTab display={display} />}
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text variant="footnote" color="textSecondary" header style={{ marginTop: t.spacing.xl, marginBottom: t.spacing.sm }}>
      {children}
    </Text>
  );
}

function ReadingTab({ display }: { display: Display }) {
  const t = useTheme();
  const step = TEXT_SCALES.reduce((best, v, i) => (Math.abs(v - display.textScale) < Math.abs(TEXT_SCALES[best] - display.textScale) ? i : best), 0);
  return (
    <View>
      <Label>Page colour</Label>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        {COLORS.map((c) => {
          const on = display.pageColor === c.id;
          return (
            <PressableScale
              key={c.id}
              haptic="select"
              onPress={() => display.set({ pageColor: c.id })}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} page`}
              accessibilityState={{ selected: on }}
              style={{ flex: 1 }}
            >
              <View style={{ padding: 3, borderRadius: 22, borderWidth: 2, borderColor: on ? t.c.text : 'transparent' }}>
                <View style={{ height: 84, borderRadius: 18, backgroundColor: c.bg, borderWidth: 1, borderColor: t.c.hairline, alignItems: 'center', justifyContent: 'center' }}>
                  <RNText style={{ fontFamily: QURAN_FONT, fontSize: 26, lineHeight: 46, color: c.ink }}>اقرأ</RNText>
                  <RNText style={{ fontSize: 12, fontWeight: '600', color: c.ink }} numberOfLines={1}>
                    {c.name}
                  </RNText>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <Label>Text colour</Label>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        {TONES.map((tone) => {
          const on = display.textTone === tone.id;
          return (
            <PressableScale
              key={tone.id}
              haptic="select"
              onPress={() => display.set({ textTone: tone.id })}
              accessibilityRole="button"
              accessibilityLabel={`${tone.name} text`}
              accessibilityState={{ selected: on }}
              style={{ flex: 1 }}
            >
              <View style={{ height: 46, borderRadius: 23, borderWidth: on ? 2 : 1, borderColor: on ? t.c.text : t.c.hairline, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="subhead" style={{ fontWeight: on ? '700' : '500' }}>
                  {tone.name}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <Label>Text size</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }} accessible accessibilityRole="adjustable" accessibilityLabel="Text size" accessibilityValue={{ min: 1, max: TEXT_SCALES.length, now: step + 1 }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => {
        const next = Math.max(0, Math.min(TEXT_SCALES.length - 1, step + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
        display.set({ textScale: TEXT_SCALES[next] });
      }}>
        <RNText style={{ fontFamily: QURAN_FONT, fontSize: 16, color: t.c.textSecondary }}>ع</RNText>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          <View style={{ position: 'absolute', left: 8, right: 8, height: 4, borderRadius: 2, backgroundColor: t.c.surface2 }} />
          {TEXT_SCALES.map((v, i) => (
            <Pressable key={v} onPress={() => display.set({ textScale: v })} hitSlop={8} accessible={false}>
              <View
                style={{
                  width: i === step ? 26 : 8,
                  height: i === step ? 26 : 8,
                  borderRadius: 13,
                  backgroundColor: i === step ? t.c.text : t.c.glyphQuiet,
                }}
              />
            </Pressable>
          ))}
        </View>
        <RNText style={{ fontFamily: QURAN_FONT, fontSize: 28, color: t.c.text }}>ع</RNText>
      </View>
      <Text variant="caption" color="textSecondary">
        For Translation, Word by word, and the page when pinched larger.
      </Text>
    </View>
  );
}

function ViewTab({ display }: { display: Display }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
      {VIEWS.map((v) => {
        const on = display.view === v.id;
        return (
          <PressableScale key={v.id} scaleTo={0.99} haptic="select" onPress={() => display.set({ view: v.id })} accessibilityRole="button" accessibilityLabel={`${v.name}. ${v.detail}`} accessibilityState={{ selected: on }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, padding: t.spacing.md, borderRadius: t.radii.card, borderCurve: 'continuous', borderWidth: on ? 2 : 1, borderColor: on ? t.c.text : t.c.hairline }}>
              <SymbolView name={v.icon} size={20} tintColor={t.c.text} style={{ width: 26, height: 26 }} />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {v.name}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {v.detail}
                </Text>
              </View>
              {on ? <SymbolView name="checkmark" size={15} tintColor={t.c.text} /> : null}
            </View>
          </PressableScale>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: t.spacing.xs, marginTop: t.spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Text variant="body">Transliteration</Text>
          <Text variant="footnote" color="textSecondary">
            Under each word, in Word by word
          </Text>
        </View>
        <Toggle label="Transliteration" value={display.translit} onValueChange={(v) => display.set({ translit: v })} />
      </View>
    </View>
  );
}

function RecitationTab({ display }: { display: Display }) {
  const t = useTheme();
  const r = useRecitation();
  return (
    <View style={{ marginTop: t.spacing.lg, gap: t.spacing.md }}>
      <NativeMenu
        height={56}
        colorScheme={t.scheme}
        items={
          <Section title="Reciter">
            <Picker selection={r.reciter.id} onSelectionChange={(id: string) => r.setReciter(id)} modifiers={[pickerStyle('inline')]}>
              {RECITERS.map((x) => (
                <SwiftText key={x.id} modifiers={[tag(x.id)]}>
                  {x.name}
                </SwiftText>
              ))}
            </Picker>
          </Section>
        }
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.md, borderRadius: t.radii.card, borderWidth: 1, borderColor: t.c.hairline }}>
          <SymbolView name="person.wave.2" size={18} tintColor={t.c.text} style={{ width: 24, height: 24 }} />
          <View style={{ flex: 1 }}>
            <Text variant="footnote" color="textSecondary">
              Reciter
            </Text>
            <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
              {r.reciter.name}
            </Text>
          </View>
          <SymbolView name="chevron.up.chevron.down" size={12} tintColor={t.c.textSecondary} />
        </View>
      </NativeMenu>

      <View>
        <Text variant="footnote" color="textSecondary" style={{ marginBottom: t.spacing.sm }}>
          Repeat
        </Text>
        <SegmentedControl<RepeatMode>
          options={[
            { value: 'off', label: 'Off' },
            { value: 'ayah', label: 'This ayah' },
            { value: 'surah', label: 'The surah' },
          ]}
          value={r.repeat}
          onChange={r.setRepeat}
        />
      </View>

      <Row label="Play on to the next surah" value={r.autoplay} onChange={r.setAutoplay} />
      <Row label="Keep the screen on while reading" value={display.keepAwake} onChange={(v) => display.set({ keepAwake: v })} />
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: t.spacing.xs }}>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </View>
  );
}
