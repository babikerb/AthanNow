import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { darkPalette } from '../../theme/colors';
import { hitSlopFor } from '../../theme/icons';
import { duration, easing, PRESSED_OPACITY } from '../../theme/motion';
import { radii } from '../../theme/radii';
import { shadow } from '../../theme/shadow';
import { type } from '../../theme/typography';

const PAD = 10;
const CARET = 10;
const DIM = 'rgba(0,0,0,0.84)';
// The tour genuinely should look the same regardless of which tab's real
// theme it's dimming (a coach-mark overlay is legitimately its own
// always-dark surface, same reasoning as Athan/Qibla's `NIGHT_BG` exception)
// — so this stays visually independent of the light/dark `Palette`, but
// references the dark theme's own elevated-surface/text tokens explicitly
// instead of one-off hex values that don't agree with anything else.
const CARD = darkPalette.surfaceElevated;
// Nominal rendered height of the Next/Done pill (14px text + 15pt vertical
// padding on each side) — comfortably clears the 44pt HIG touch-target floor
// on its own; `hitSlopFor` below is the defensive belt-and-suspenders floor.
const NEXT_BTN_HEIGHT = 44;

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
  round?: boolean; // target is circular / pill-shaped -> draw a matching rounded ring
}

// Dims the screen, cuts a pulsing highlight around `target` (or centers when
// null), and shows a pointing tooltip with controls. Ported from Hardwood.
//
// Modal semantics (§2.2) — judgment call: this overlay renders as a plain
// absolutely-positioned `View` (a sibling of the app's `NavigationContainer` in
// App.tsx), not a real RN `Modal`. Migrating it to a transparent,
// non-dismissible `Modal` (`presentationStyle="overFullScreen"`) was
// considered, but rejected here in favor of `accessibilityViewIsModal` below:
//  1. `OnboardingContext`'s `useOnboardingTarget` measures cross-tab targets
//     via `measureInWindow`, retried across up to 20 animation frames. That
//     flow is currently proven reliable specifically because the tab content
//     and this overlay are siblings in the same native window. Moving the
//     overlay into a separate native `Modal` window changes which window the
//     ring's own coordinates are drawn in, and iOS's handling of the
//     presenting view controller's continued layout/paint under an
//     `overFullScreen` presentation is not something worth gambling this
//     working flow on without a device to verify against.
//  2. The tour must be non-dismissible, but RN `Modal` auto-invokes
//     `onRequestClose` on Android back-press, which would need extra
//     plumbing to swallow — complexity with no accessibility upside.
// `accessibilityViewIsModal` solves the actual reported problem (VoiceOver
// can still reach the dimmed content underneath) without touching the
// measurement flow or dismiss behavior at all.
export function Spotlight({ target, accent, title, body, index, total, last, onNext, onSkip, center = false, round = false }: Props) {
  const { width: SW, height: SH } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  // Continuous ring-pulse loop is gated on reduced-motion (§2.6): when the OS
  // preference is on, skip `Animated.loop` entirely and render the ring at its
  // settled full-opacity/scale-1.0 state below instead of animating. The one-shot
  // fade-in right below this is NOT gated — a single ~180ms settle-in on mount is
  // not the kind of motion `prefers-reduced-motion` users object to.
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  const t = target && target.width > 0 ? target : null;

  useEffect(() => {
    if (t || center) {
      Animated.timing(fade, { toValue: 1, duration: duration.fast, easing: easing.standard, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [t, center, fade]);

  const sx = t ? t.x - PAD : 0;
  const sy = t ? t.y - PAD : 0;
  const sw = t ? t.width + PAD * 2 : 0;
  const sh = t ? t.height + PAD * 2 : 0;

  // Match the ring's corner radius to the target: a full circle/pill for round
  // targets (search button, location pill, compass), gentle corners otherwise.
  const ringRadius = round ? Math.min(sw, sh) / 2 : 18;

  const placeBelow = t ? sy + sh + 220 < SH : true;
  const caretLeft = t ? Math.min(Math.max(t.x + t.width / 2 - 20 - CARET, 20), SW - 40 - 20) : SW / 2 - CARET;

  // Fixed settled state (scale 1.0, full opacity) when reduced motion is on —
  // neither interpolation endpoint alone produces this pair, so bypass the
  // interpolation entirely rather than parking `pulse` at a value that doesn't.
  const ringScale = reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const ringOpacity = reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    // `accessibilityViewIsModal`: see the judgment-call note on `Spotlight`
    // above for why this is a plain View rather than a real RN `Modal`. This
    // tells VoiceOver to treat it as the sole active subtree instead of
    // leaving the dimmed tab content underneath reachable.
    <View style={st.overlay} accessibilityViewIsModal>

      {t ? (
        <>
          <View style={[st.dim, { top: 0, left: 0, right: 0, height: sy }]} />
          <View style={[st.dim, { top: sy, left: 0, width: sx, height: sh }]} />
          <View style={[st.dim, { top: sy, left: sx + sw, right: 0, height: sh }]} />
          <View style={[st.dim, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
          <Animated.View
            pointerEvents="none"
            style={[st.ring, { top: sy, left: sx, width: sw, height: sh, borderRadius: ringRadius, borderColor: accent, opacity: Animated.multiply(fade, ringOpacity), transform: [{ scale: ringScale }] }]}
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
                  <TouchableOpacity
                    onPress={onSkip}
                    hitSlop={8}
                    style={st.skipBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Skip tour"
                  >
                    <Text style={st.skip}>Skip</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onNext}
                  activeOpacity={PRESSED_OPACITY}
                  style={[st.nextBtn, { backgroundColor: accent }]}
                  hitSlop={hitSlopFor(NEXT_BTN_HEIGHT)}
                  accessibilityRole="button"
                  accessibilityLabel={last ? 'Done' : 'Next'}
                >
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
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    padding: 18,
    gap: 8,
    // Reserved for transient overlays that float above live, moving
    // content (§1.7) — this tooltip is one of the two intended uses.
    ...shadow.floating,
  },
  title: { ...type.subhead } as any,
  body: { color: darkPalette.textSecondary, ...type.footnote } as any,

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
  btns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skipBtn: { paddingVertical: 6 },
  skip: { color: darkPalette.textSecondary, ...type.footnote } as any,
  nextBtn: { paddingHorizontal: 20, paddingVertical: 15, borderRadius: radii.pill, minHeight: NEXT_BTN_HEIGHT, justifyContent: 'center' },
  nextText: { color: '#fff', ...type.footnote, fontWeight: '700' } as any,

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
