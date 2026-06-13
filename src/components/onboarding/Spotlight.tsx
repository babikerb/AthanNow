import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const PAD = 10;
const CARET = 10;
const DIM = 'rgba(0,0,0,0.84)';
const CARD = '#1b1b1d';

export interface SpotTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  target: SpotTarget | null;
  accent: string;
  title: string;
  body: string;
  index: number;
  total: number;
  last: boolean;
  onNext: () => void;
  onSkip: () => void;
  center?: boolean; // show the tooltip centered with no target (e.g. closing step)
}

// Dims the screen, cuts a pulsing highlight around `target` (or centers when
// null), and shows a pointing tooltip with controls. Ported from Hardwood.
export function Spotlight({ target, accent, title, body, index, total, last, onNext, onSkip, center = false }: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const t = target && target.width > 0 ? target : null;

  useEffect(() => {
    if (t || center) {
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [t, center, fade]);

  const sx = t ? t.x - PAD : 0;
  const sy = t ? t.y - PAD : 0;
  const sw = t ? t.width + PAD * 2 : 0;
  const sh = t ? t.height + PAD * 2 : 0;

  const placeBelow = t ? sy + sh + 220 < SH : true;
  const caretLeft = t ? Math.min(Math.max(t.x + t.width / 2 - 20 - CARET, 20), SW - 40 - 20) : SW / 2 - CARET;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={st.overlay}>
      {t ? (
        <>
          <View style={[st.dim, { top: 0, left: 0, right: 0, height: sy }]} />
          <View style={[st.dim, { top: sy, left: 0, width: sx, height: sh }]} />
          <View style={[st.dim, { top: sy, left: sx + sw, right: 0, height: sh }]} />
          <View style={[st.dim, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
          <Animated.View
            pointerEvents="none"
            style={[st.ring, { top: sy, left: sx, width: sw, height: sh, borderColor: accent, opacity: Animated.multiply(fade, ringOpacity), transform: [{ scale: ringScale }] }]}
          />
        </>
      ) : (
        <View style={[st.dim, StyleSheet.absoluteFill]} />
      )}

      {(t || center) && (
        <Animated.View
          style={[
            st.tipWrap,
            center ? { top: SH / 2 - 120 } : placeBelow ? { top: sy + sh + CARET + 4 } : { bottom: SH - (sy - CARET - 4) },
            { opacity: fade },
          ]}
          pointerEvents="box-none"
        >
          {!center && placeBelow && <View style={[st.caretUp, { left: caretLeft }]} />}

          <View style={st.card}>
            <Text style={[st.title, { color: accent }]}>{title}</Text>
            <Text style={st.body}>{body}</Text>

            <View style={st.footer}>
              <View style={st.dots}>
                {Array.from({ length: total }).map((_, k) => (
                  <View key={k} style={[st.dot, k === index ? { backgroundColor: accent, width: 18 } : null]} />
                ))}
              </View>
              <View style={st.btns}>
                {!last && (
                  <TouchableOpacity onPress={onSkip} hitSlop={8} style={st.skipBtn}>
                    <Text style={st.skip}>Skip</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onNext} activeOpacity={0.85} style={[st.nextBtn, { backgroundColor: accent }]}>
                  <Text style={st.nextText}>{last ? 'Done' : 'Next'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {!center && !placeBelow && <View style={[st.caretDown, { left: caretLeft }]} />}
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: { position: 'absolute', borderRadius: 18, borderWidth: 2.5 },

  tipWrap: { position: 'absolute', left: 20, right: 20 },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  body: { color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 20 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
  btns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skipBtn: { paddingVertical: 6 },
  skip: { color: 'rgba(255,255,255,0.62)', fontSize: 14, fontWeight: '600' },
  nextBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 100 },
  nextText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

  caretUp: {
    position: 'absolute',
    top: -CARET,
    width: 0,
    height: 0,
    borderLeftWidth: CARET,
    borderRightWidth: CARET,
    borderBottomWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: CARD,
  },
  caretDown: {
    position: 'absolute',
    bottom: -CARET,
    width: 0,
    height: 0,
    borderLeftWidth: CARET,
    borderRightWidth: CARET,
    borderTopWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: CARD,
  },
});
