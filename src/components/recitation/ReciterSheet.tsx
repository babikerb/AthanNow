import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { ListGroup } from '../../design/List';
import { PressableScale } from '../../design/PressableScale';
import { Text } from '../../design/Text';
import { useTheme } from '../../design/theme';
import { QURAN_FONT } from '../../recitation/format';
import { RECITERS } from '../../recitation/reciters';
import { Sheet } from '../Sheet';

/** Reciter picker. Reciters with verified timing get word-by-word highlighting. */
export function ReciterSheet({ visible, selectedId, onSelect, onClose }: { visible: boolean; selectedId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Reciter">
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xxxl }}>
        <ListGroup>
          {RECITERS.map((r) => {
            const selected = r.id === selectedId;
            return (
              <PressableScale
                key={r.id}
                scaleTo={1}
                haptic="select"
                onPress={() => {
                  onSelect(r.id);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${r.name}, ${r.origin}, ${r.style}${r.wordTiming ? ', word highlighting' : ''}`}
              >
                {({ pressed }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.lg, paddingVertical: 12, backgroundColor: pressed ? t.c.surface2 : 'transparent' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" color={selected ? 'accentText' : 'text'} style={selected ? { fontWeight: '600' } : undefined}>
                        {r.name}
                      </Text>
                      <Text variant="footnote" color="textSecondary">
                        {r.origin}, {r.style}
                        {r.wordTiming ? ', word highlighting' : ''}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: QURAN_FONT, fontSize: 17, lineHeight: 30, color: t.c.textSecondary }}>{r.arabic}</Text>
                    <View style={{ width: 20, alignItems: 'flex-end' }}>
                      {selected ? <SymbolView name="checkmark" size={15} weight="semibold" tintColor={t.c.accent} /> : null}
                    </View>
                  </View>
                )}
              </PressableScale>
            );
          })}
        </ListGroup>
        <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
          Recitations stream from Islamic Network. Word timing comes from the Quranic Universal Library (QUL).
        </Text>
      </ScrollView>
    </Sheet>
  );
}
