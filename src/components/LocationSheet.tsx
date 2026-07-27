import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlaceSuggestion, searchPlaces } from '../hooks/useLocation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../context/ThemeContext';
import { ACCENT, ACCENT_BORDER, ACCENT_SOFT } from '../theme/colors';
import { iconSize } from '../theme/icons';
import { duration, easing, PRESSED_OPACITY } from '../theme/motion';
import { radii } from '../theme/radii';
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
          {loading && <ActivityIndicator color={ACCENT} style={{ marginTop: 10 }} />}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Change location</Text>

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

const styles = StyleSheet.create({
  body: { padding: 20, gap: 18 },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1 },
  cardCaption: { ...type.caption2, marginBottom: 4 },
  city: { ...type.title2 },
  citySub: { ...type.footnote, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', marginLeft: 4, marginBottom: -4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 16 },
  error: { color: '#E5484D', fontSize: 13, marginTop: -8, marginLeft: 4 },
  suggestBox: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: -4 },
  suggestEmpty: { padding: 18, alignItems: 'center' },
  suggestEmptyText: { fontSize: 14 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  suggestName: { fontSize: 16, fontWeight: '600' },
  suggestSub: { fontSize: 13, marginTop: 1 },
  useCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
  } as any,
  useCurrentText: { flex: 1, fontSize: 16, fontWeight: '600' },
});
