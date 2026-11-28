import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** Ring colours, outermost first: gold, then dusk blue, then quieter steps. */
export function ringColors(dark: boolean): string[] {
  return dark ? ['#E2B456', '#7FA7C7', '#C9965A', '#A7AEBA'] : ['#8A6420', '#3B6584', '#A88A4E', '#7D8E9E'];
}

/**
 * Concentric rings, one per goal due today, each filled as far as today's progress. Flat: a faint
 * track and a solid arc with round ends.
 */
export function GoalRings({ progress, size, dark, stroke }: { progress: number[]; size: number; dark: boolean; stroke?: number }) {
  const colors = ringColors(dark);
  const rings = progress.slice(0, 4);
  const w = stroke ?? Math.max(8, size * 0.1);
  const gap = w * 0.35;
  const track = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(29, 27, 38, 0.07)';
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={`${rings.filter((p) => p >= 1).length} of ${rings.length} goals done today`}>
      <Svg width={size} height={size}>
        {(rings.length ? rings : [0]).map((p, i) => {
          const r = size / 2 - w / 2 - i * (w + gap);
          if (r <= w) return null;
          const c = 2 * Math.PI * r;
          const f = Math.min(1, Math.max(0, p));
          return (
            <React.Fragment key={i}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={w} fill="none" />
              {f > 0 ? (
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={colors[i % colors.length]}
                  strokeWidth={w}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${c * f} ${c}`}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
