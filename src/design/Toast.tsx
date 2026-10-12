import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from './haptics';
import { Text } from './Text';
import { useTheme } from './theme';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastCtx = createContext<{ show: (message: string, tone?: ToastTone) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

/** Mount once near the app root. Shows a single toast at a time, below the status bar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    idRef.current += 1;
    if (tone === 'success') haptic.success();
    else if (tone === 'warning' || tone === 'danger') haptic.warning();
    AccessibilityInfo.announceForAccessibility(message);
    setItem({ id: idRef.current, message, tone });
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {item ? <ToastView key={item.id} item={item} onDone={() => setItem((cur) => (cur?.id === item.id ? null : cur))} /> : null}
    </ToastCtx.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const d = t.motion.duration;
    Animated.timing(v, { toValue: 1, duration: t.reduceMotion ? d.reducedFade : d.standard, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(v, { toValue: 0, duration: d.standard, useNativeDriver: true }).start(onDone);
    }, 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tint = item.tone === 'neutral' ? t.c.textSecondary : t.c[item.tone];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + t.spacing.sm,
        left: t.spacing.xl,
        right: t.spacing.xl,
        alignItems: 'center',
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [t.reduceMotion ? 0 : -12, 0] }) }],
      }}
    >
      <View
        accessible
        accessibilityLabel={item.message}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.md,
          borderRadius: t.radii.pill,
          backgroundColor: t.c.surface3,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.c.hairline,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
        <Text variant="subhead" style={{ flexShrink: 1 }}>
          {item.message}
        </Text>
      </View>
    </Animated.View>
  );
}
