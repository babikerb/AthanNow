import { BottomSheet, Button as MenuButton, Group, Host, Picker, RNHostView, Section, Text as SwiftText } from '@expo/ui/swift-ui';
import { pickerStyle, presentationBackground, presentationDetents, presentationDragIndicator, tag } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReaderView } from 'quran-reader';
import type { SFSymbol } from 'sf-symbols-typescript';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { Toggle } from '../../design/Toggle';
import type { Display } from '../../quran/display';
import { RECITERS } from '../../recitation/reciters';
import { useRecitation, type RepeatMode } from '../../recitation/RecitationProvider';
import { NativeMenu } from '../NativeMenu';

const LAYOUTS: { id: ReaderView; name: string; icon: SFSymbol }[] = [
  { id: 'mushaf', name: 'Page', icon: 'book.pages' },
  { id: 'translation', name: 'Ayah by ayah', icon: 'list.bullet.below.rectangle' },
  { id: 'words', name: 'Word by word', icon: 'character.book.closed' },
];
const REPEAT: { id: RepeatMode; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'ayah', name: 'One ayah' },
  { id: 'surah', name: 'The whole surah' },
];

/**
 * The reader's settings, as a native sheet laid out like Settings: how the Quran is laid out, and how
 * the recitation plays. Colours are the app's own.
 */
export function ReaderSettingsSheet({ open, onClose, display }: { open: boolean; onClose: () => void; display: Display }) {
  const t = useTheme();
  return (
    <Host style={{ position: 'absolute', width: 0, height: 0 }}>
      <BottomSheet isPresented={open} onIsPresentedChange={(v) => !v && onClose()}>
        <Group modifiers={[presentationDetents(['medium', 'large']), presentationDragIndicator('visible'), presentationBackground(t.c.bg)]}>
          <RNHostView>
            <View style={{ flex: 1, backgroundColor: t.c.bg }}>
              <Body display={display} onClose={onClose} />
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

function GroupBox({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.xl }}>
      <Text variant="footnote" color="textSecondary" header style={{ marginBottom: t.spacing.sm, paddingHorizontal: t.spacing.md }}>
        {title}
      </Text>
      <View style={{ borderRadius: t.radii.card, borderCurve: 'continuous', backgroundColor: t.c.surface1, overflow: 'hidden' }}>{children}</View>
      {footer ? (
        <Text variant="caption" color="textSecondary" style={{ marginTop: t.spacing.xs, paddingHorizontal: t.spacing.md }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, marginLeft: 52, backgroundColor: t.c.hairline }} />;
}

function Body({ display, onClose }: { display: Display; onClose: () => void }) {
  const t = useTheme();
  const r = useRecitation();
  const insets = useSafeAreaInsets();
  const repeatName = REPEAT.find((x) => x.id === r.repeat)?.name ?? 'Off';

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: insets.bottom + t.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title3" header>
          Reading
        </Text>
        <PressableScale haptic="select" onPress={onClose} accessibilityRole="button" accessibilityLabel="Done">
          <View style={{ height: 40, justifyContent: 'center' }}>
            <Text variant="body" color="accentText" style={{ fontWeight: '600' }}>
              Done
            </Text>
          </View>
        </PressableScale>
      </View>

      <GroupBox title="Layout" footer="Pinch any layout to read it larger.">
        {LAYOUTS.map((l, i) => {
          const on = display.view === l.id;
          return (
            <View key={l.id}>
              {i > 0 ? <Divider /> : null}
              <PressableScale scaleTo={1} haptic="select" onPress={() => display.set({ view: l.id })} accessibilityRole="button" accessibilityLabel={l.name} accessibilityState={{ selected: on }}>
                {({ pressed }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 50, paddingHorizontal: t.spacing.md, backgroundColor: pressed ? t.c.surface2 : 'transparent' }}>
                    <SymbolView name={l.icon} size={18} tintColor={t.c.accent} style={{ width: 24, height: 24 }} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {l.name}
                    </Text>
                    {on ? <SymbolView name="checkmark" size={15} tintColor={t.c.accent} /> : null}
                  </View>
                )}
              </PressableScale>
            </View>
          );
        })}
        {display.view === 'words' ? (
          <>
            <Divider />
            <ToggleRow icon="textformat.abc" label="Transliteration" value={display.translit} onChange={(v) => display.set({ translit: v })} />
          </>
        ) : null}
      </GroupBox>

      <GroupBox title="Recitation">
        <NativeMenu
          height={50}
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
          <Row icon="person.wave.2" label="Reciter" value={r.reciter.name} />
        </NativeMenu>
        <Divider />
        <NativeMenu
          height={50}
          colorScheme={t.scheme}
          items={
            <Section title="Repeat">
              {REPEAT.map((x) => (
                <MenuButton key={x.id} label={x.name} systemImage={x.id === r.repeat ? 'checkmark' : undefined} onPress={() => r.setRepeat(x.id)} />
              ))}
            </Section>
          }
        >
          <Row icon="repeat" label="Repeat" value={repeatName} />
        </NativeMenu>
        <Divider />
        <ToggleRow icon="forward.end" label="Play on to the next surah" value={r.autoplay} onChange={r.setAutoplay} />
        <Divider />
        <ToggleRow icon="sun.max" label="Keep the screen on" value={display.keepAwake} onChange={(v) => display.set({ keepAwake: v })} />
      </GroupBox>
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: SFSymbol; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.md }} accessibilityLabel={`${label}, ${value}`}>
      <SymbolView name={icon} size={18} tintColor={t.c.accent} style={{ width: 24, height: 24 }} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color="textSecondary" numberOfLines={1} style={{ maxWidth: '50%' }}>
        {value}
      </Text>
      <SymbolView name="chevron.up.chevron.down" size={11} tintColor={t.c.textSecondary} />
    </View>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: SFSymbol; label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 50, paddingHorizontal: t.spacing.md }}>
      <SymbolView name={icon} size={18} tintColor={t.c.accent} style={{ width: 24, height: 24 }} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </View>
  );
}
