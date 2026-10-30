import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { useTheme } from '../../design/theme';

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Position within the current ayah: drag or tap to seek, VoiceOver adjusts in 5% steps. */
export function Scrubber({ progress, onSeek }: { progress: number; onSeek: (fraction: number) => void }) {
  const t = useTheme();
  const width = useRef(1);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          start.current = clamp(e.nativeEvent.locationX / width.current);
          setDrag(start.current);
        },
        onPanResponderMove: (_e, g) => setDrag(clamp(start.current + g.dx / width.current)),
        onPanResponderRelease: (_e, g) => {
          onSeek(clamp(start.current + g.dx / width.current));
          setDrag(null);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    [onSeek],
  );

  const shown = clamp(drag ?? progress);
  const thumb = drag != null ? 16 : 12;
  return (
    <View
      onLayout={(e) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Position in this ayah"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onSeek(clamp(progress + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)))}
      style={{ height: 28, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.c.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${shown * 100}%`, height: '100%', backgroundColor: t.c.accent }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${shown * 100}%`,
          width: thumb,
          height: thumb,
          marginLeft: -thumb / 2,
          borderRadius: thumb / 2,
          backgroundColor: t.c.accent,
        }}
      />
    </View>
  );
}
