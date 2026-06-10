import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/**
 * Ambient sky background (ported from Jamaa): two crossed linear gradients give a
 * soft, radial-ish atmosphere rather than a flat single-direction wash.
 */
export default function AmbientGradient({ colors }: { colors: string[] }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={colors}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.cross]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cross: { opacity: 0.45 },
});
