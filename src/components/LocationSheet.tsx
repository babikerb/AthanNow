import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

export function LocationSheet({
  visible,
  onClose,
  cityName,
  isManual,
  loading,
  onRefresh,
  onSearch,
}: LocationSheetProps) {
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
        {/* Current location row */}
        <View style={[styles.currentCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.separator }]}>
          <View style={styles.currentRow}>
            <View style={[styles.iconBadge, { backgroundColor: ACCENT_SOFT }]}>
              <SymbolView name="location.fill" size={18} tintColor={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.currentCity, { color: colors.textPrimary }]} numberOfLines={1}>
                {cityName}
              </Text>
              <Text style={[styles.currentSub, { color: colors.textTertiary }]}>
                {isManual ? 'Manually selected' : 'From your device'}
              </Text>
            </View>
            {loading && <ActivityIndicator color={ACCENT} />}
          </View>
        </View>

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
        </View>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Use current location */}
        <Pressable onPress={refresh} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <SymbolView name="location.circle.fill" size={22} tintColor={ACCENT} />
          <Text style={[styles.actionText, { color: ACCENT }]}>Use current location</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  currentCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  currentCity: { fontSize: 17, fontWeight: '600' },
  currentSub: { fontSize: 13, marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 16 },
  error: { color: '#E5484D', fontSize: 13, marginTop: -8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
