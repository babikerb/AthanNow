import { BottomSheet, Form, Group, Host, Picker, Section, Text as SwiftText, Toggle } from '@expo/ui/swift-ui';
import { pickerStyle, presentationDetents, presentationDragIndicator, tag, tint } from '@expo/ui/swift-ui/modifiers';
import type { ReaderView } from 'quran-reader';
import React from 'react';

import { useTheme } from '../../design/theme';
import type { Display } from '../../quran/display';
import { RECITERS } from '../../recitation/reciters';
import { useRecitation, type RepeatMode } from '../../recitation/RecitationProvider';

const LAYOUTS: { id: ReaderView; name: string }[] = [
  { id: 'mushaf', name: 'Page' },
  { id: 'translation', name: 'Ayah by ayah' },
  { id: 'words', name: 'Word by word' },
];
const REPEAT: { id: RepeatMode; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'ayah', name: 'One ayah' },
  { id: 'surah', name: 'The whole surah' },
];

/**
 * The reader's settings: a native iOS form in a sheet. How the Quran is laid out, and how the
 * recitation plays. The colours are the app's own.
 */
export function ReaderSettingsSheet({ open, onClose, display }: { open: boolean; onClose: () => void; display: Display }) {
  const t = useTheme();
  const r = useRecitation();
  return (
    <Host style={{ position: 'absolute', width: 0, height: 0 }} colorScheme={t.scheme}>
      <BottomSheet isPresented={open} onIsPresentedChange={(v) => !v && onClose()}>
        <Group modifiers={[presentationDetents(['medium', 'large']), presentationDragIndicator('visible'), tint(t.c.accent)]}>
          <Form>
            <Section title="Layout" footer={<SwiftText>Pinch any layout to read it larger.</SwiftText>}>
              <Picker selection={display.view} onSelectionChange={(v: string) => display.set({ view: v as ReaderView })} modifiers={[pickerStyle('inline')]}>
                {LAYOUTS.map((l) => (
                  <SwiftText key={l.id} modifiers={[tag(l.id)]}>
                    {l.name}
                  </SwiftText>
                ))}
              </Picker>
              {display.view === 'words' ? (
                <Toggle label="Transliteration" systemImage="textformat.abc" isOn={display.translit} onIsOnChange={(v) => display.set({ translit: v })} />
              ) : null}
            </Section>

            <Section title="Recitation">
              <Picker label="Reciter" systemImage="person.wave.2" selection={r.reciter.id} onSelectionChange={(id: string) => r.setReciter(id)} modifiers={[pickerStyle('menu')]}>
                {RECITERS.map((x) => (
                  <SwiftText key={x.id} modifiers={[tag(x.id)]}>
                    {x.name}
                  </SwiftText>
                ))}
              </Picker>
              <Picker label="Repeat" systemImage="repeat" selection={r.repeat} onSelectionChange={(v: string) => r.setRepeat(v as RepeatMode)} modifiers={[pickerStyle('menu')]}>
                {REPEAT.map((x) => (
                  <SwiftText key={x.id} modifiers={[tag(x.id)]}>
                    {x.name}
                  </SwiftText>
                ))}
              </Picker>
              <Toggle label="Play on to the next surah" systemImage="forward.end" isOn={r.autoplay} onIsOnChange={r.setAutoplay} />
              <Toggle label="Keep the screen on" systemImage="sun.max" isOn={display.keepAwake} onIsOnChange={(v) => display.set({ keepAwake: v })} />
            </Section>
          </Form>
        </Group>
      </BottomSheet>
    </Host>
  );
}
