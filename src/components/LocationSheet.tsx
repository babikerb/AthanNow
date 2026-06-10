import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { ACCENT, ACCENT_SOFT } from '../theme/colors';
import { Sheet } from './Sheet';

interface LocationSheetProps {
  visible: boolean;
  onClose: () => void;
  cityName: string;
  isManual: boolean;
  loading: boolean;
  onRefresh: () => void;
  onSearch: (query: string) => Promise<boolean>;
}

export function LocationSheet({ visible, onClose, cityName, isManual, loading, onRefresh, onSearch }: LocationSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!query.trim()) return;
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
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
          <View style={[styles.iconBadge, { backgroundColor: ACCENT_SOFT }]}>
            <SymbolView name="location.fill" size={22} tintColor={ACCENT} />
          </View>
          <Text style={[styles.city, { color: colors.textPrimary }]} numberOfLines={1}>
            {cityName}
          </Text>
          <Text style={[styles.citySub, { color: colors.textTertiary }]}>
            {isManual ? 'Manually selected' : 'Using your device location'}
          </Text>
          {loading && <ActivityIndicator color={ACCENT} style={{ marginTop: 10 }} />}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>CHANGE LOCATION</Text>

        {/* Search field */}
        <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
          <SymbolView name="magnifyingglass" size={18} tintColor={colors.textTertiary} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Search a city"
            placeholderTextColor={colors.textTertiary}
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
            <Pressable onPress={submit} hitSlop={8}>
              <SymbolView name="arrow.up.circle.fill" size={24} tintColor={ACCENT} />
            </Pressable>
          )}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Use current location */}
        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            styles.useCurrent,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.separator, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <SymbolView name="location.circle.fill" size={22} tintColor={ACCENT} />
          <Text style={[styles.useCurrentText, { color: colors.textPrimary }]}>Use current location</Text>
          <SymbolView name="chevron.right" size={14} tintColor={colors.textTertiary} />
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  city: { fontSize: 22, fontWeight: '700' },
  citySub: { fontSize: 13, marginTop: 4 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginLeft: 4, marginBottom: -6 },
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
