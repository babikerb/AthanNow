import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface AmbientGradientProps {
  colors: string[];
  /**
   * Optional darkening scrim, drawn on top of the two crossed gradients as a
   * third full-bleed `LinearGradient` from `rgba(0,0,0,0.05)` at the top to
   * `rgba(0,0,0,scrimBottomOpacity)` at the bottom. Callers pass the per-stage
   * intensity directly (e.g. the Athan screen boosts this over the light
   * Dhuhr sky to keep white hero text readable) — this component has no
   * opinion on prayer stages. Defaults to 0 (no scrim) so other consumers of
   * `AmbientGradient` are unaffected.
   */
  scrimBottomOpacity?: number;
}

/**
 * Ambient sky background (ported from Jamaa): two crossed linear gradients give a
 * soft, radial-ish atmosphere rather than a flat single-direction wash.
 */
export default function AmbientGradient({ colors, scrimBottomOpacity = 0 }: AmbientGradientProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={colors}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.cross]}
      />
      {scrimBottomOpacity > 0 && (
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', `rgba(0,0,0,${scrimBottomOpacity})`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cross: { opacity: 0.45 },
});
