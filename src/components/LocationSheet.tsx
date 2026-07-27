import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlaceSuggestion, searchPlaces } from '../hooks/useLocation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../context/ThemeContext';
import { ACCENT, ACCENT_BORDER, ACCENT_SOFT, ERROR } from '../theme/colors';
import { iconSize } from '../theme/icons';
import { duration, easing, PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { type } from '../theme/typography';
import { Sheet } from './Sheet';

interface LocationSheetProps {
  visible: boolean;
  onClose: () => void;
  cityName: string;
  isManual: boolean;
  loading: boolean;
  onRefresh: () => void;
  onSearch: (query: string) => Promise<boolean>;
  onSelectPlace: (place: PlaceSuggestion) => void;
}

export function LocationSheet({ visible, onClose, cityName, isManual, loading, onRefresh, onSearch, onSelectPlace }: LocationSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const reducedMotion = useReducedMotion();

  // Debounced autocomplete: fetch named place suggestions as the user types.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const results = await searchPlaces(q, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query]);

  // Fade the suggestion box in the moment it pops into existence, so it
  // doesn't feel jumpy (plan §3.8) — instant if reduced motion is on.
  const suggestVisible = query.trim().length >= 2;
  const suggestFade = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const wasSuggestVisible = useRef(false);
  useEffect(() => {
    if (suggestVisible && !wasSuggestVisible.current) {
      if (reducedMotion) {
        suggestFade.setValue(1);
      } else {
        suggestFade.setValue(0);
        Animated.timing(suggestFade, {
          toValue: 1,
          duration: duration.fast,
          easing: easing.standard,
          useNativeDriver: true,
        }).start();
      }
    }
    wasSuggestVisible.current = suggestVisible;
  }, [suggestVisible, reducedMotion, suggestFade]);

  const pick = (place: PlaceSuggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectPlace(place);
    setQuery('');
    setSuggestions([]);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!query.trim()) return;
    // Prefer the first suggestion (named + timezone) when available.
    if (suggestions.length > 0) {
      pick(suggestions[0]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await onSearch(query);
    if (ok) {
      setQuery('');
      setError(null);
      onClose();
    } else {
      setError('Could not find that place. Try a city name.');
    }
  };

  const refresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRefresh();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Location">
      <View style={styles.body}>
        {/* Current location hero card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
          <View style={[styles.iconBadge, { backgroundColor: ACCENT_SOFT, borderColor: ACCENT_BORDER }]}>
            <SymbolView name="location.fill" size={iconSize.lg} tintColor={ACCENT} />
          </View>
          <Text style={[styles.cardCaption, { color: colors.textSecondary }]}>CURRENT LOCATION</Text>
          <Text style={[styles.city, { color: colors.textPrimary }]} numberOfLines={1}>
            {cityName}
          </Text>
          <Text style={[styles.citySub, { color: colors.textSecondary }]}>
            {isManual ? 'Manually selected' : 'Using your device location'}
          </Text>
          {loading && <ActivityIndicator color={ACCENT} style={{ marginTop: spacing.sm }} />}
        </View>

        {/* Same uppercase-tracked micro-label treatment Settings' section
            titles use, not a one-off bold-13px style local to this sheet. */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>CHANGE LOCATION</Text>

        {/* Search field */}
        <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
          <SymbolView name="magnifyingglass" size={18} tintColor={colors.textQuaternary} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Search a city"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (error) setError(null);
            }}
            returnKeyType="search"
            onSubmitEditing={submit}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable
              onPress={submit}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <SymbolView name="arrow.up.circle.fill" size={24} tintColor={ACCENT} />
            </Pressable>
          )}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Live suggestions while typing — fades in on appearance instead of
            popping (plan §3.8), gated by `useReducedMotion()`. */}
        {suggestVisible && (
          <Animated.View style={[styles.suggestBox, { backgroundColor: colors.surface, borderColor: colors.separator, opacity: suggestFade }]}>
            {searching && suggestions.length === 0 ? (
              <View style={styles.suggestEmpty}>
                <ActivityIndicator color={colors.textQuaternary} />
              </View>
            ) : suggestions.length === 0 ? (
              <View style={styles.suggestEmpty}>
                <Text style={[styles.suggestEmptyText, { color: colors.textSecondary }]}>No matches yet</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                {suggestions.map((p, i) => {
                  const region = [p.admin1, p.country].filter(Boolean).join(', ');
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => pick(p)}
                      accessibilityRole="button"
                      accessibilityLabel={region ? `Select ${p.name}, ${region}` : `Select ${p.name}`}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
                        pressed && { backgroundColor: ACCENT_SOFT },
                      ]}
                    >
                      <SymbolView name="mappin.circle.fill" size={20} tintColor={ACCENT} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {region ? (
                          <Text style={[styles.suggestSub, { color: colors.textSecondary }]} numberOfLines={1}>
                            {region}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* Use current location */}
        <Pressable
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          style={({ pressed }) => [
            styles.useCurrent,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.separator, opacity: pressed ? PRESSED_OPACITY : 1 },
          ]}
        >
          <SymbolView name="location.circle.fill" size={22} tintColor={ACCENT} />
          <Text style={[styles.useCurrentText, { color: colors.textPrimary }]}>Use current location</Text>
          <SymbolView name="chevron.right" size={14} tintColor={colors.textQuaternary} />
        </Pressable>
      </View>
    </Sheet>
  );
}

// Token migration (per explicit feedback this sheet should look like the
// rest of the app, not a one-off): every literal below used to be a bespoke
// number invented for this file alone. Now sourced from the same
// type/spacing/radii scales every other redesigned screen uses. `radii.sm`
// for the compact controls (search row, suggestion box, "use current
// location" row) is literally that token's own documented use case
// (radii.ts: "compact controls (search rows, segment container)").
const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing.xl + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm + 2, borderWidth: 1 },
  cardCaption: { ...type.caption2, marginBottom: spacing.xxs } as any,
  city: { ...type.title2 } as any,
  citySub: { ...type.footnote, marginTop: spacing.xxs } as any,
  label: { ...type.caption2, marginLeft: spacing.xxs, marginBottom: -spacing.xxs } as any,
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm + 2,
    height: 50,
  },
  input: { flex: 1, ...type.body } as any,
  error: { ...type.footnote, color: ERROR, marginTop: -spacing.xs, marginLeft: spacing.xxs } as any,
  suggestBox: { borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: -spacing.xxs },
  suggestEmpty: { padding: spacing.lg, alignItems: 'center' },
  suggestEmptyText: { ...type.footnote } as any,
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm },
  suggestName: { ...type.bodyEmph } as any,
  suggestSub: { ...type.footnote, marginTop: 1 } as any,
  useCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as any,
  useCurrentText: { flex: 1, ...type.bodyEmph } as any,
});
