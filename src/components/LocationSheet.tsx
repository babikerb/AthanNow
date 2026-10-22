import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { haptic } from '../design/haptics';
import { Text } from '../design/Text';
import { useTheme } from '../design/theme';
import { textStyle } from '../design/tokens';
import { AppLocation, PlaceSuggestion, searchPlaces } from '../hooks/useLocation';
import { Sheet } from './Sheet';

type Search = { state: 'idle' } | { state: 'searching' } | { state: 'done'; places: PlaceSuggestion[] } | { state: 'offline' };

/**
 * Choose where prayer times are calculated for. Search is pinned at the top; while typing, results
 * replace the Current location and Recent sections (Apple Weather's pattern).
 */
export function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { location, status, permission, recents, refreshLocation, setLocationByPlace, selectRecent, removeRecent } = useLocation();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ state: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) {
      setSearch({ state: 'idle' });
      return;
    }
    setSearch({ state: 'searching' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const res = await searchPlaces(q, controller.signal);
      if (controller.signal.aborted) return;
      setSearch(res.ok ? { state: 'done', places: res.places } : { state: 'offline' });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, attempt]);

  const close = () => {
    setQuery('');
    setEditing(false);
    onClose();
  };
  const pickPlace = (p: PlaceSuggestion) => {
    haptic.success();
    setLocationByPlace(p);
    close();
  };
  const pickRecent = (loc: AppLocation) => {
    haptic.success();
    selectRecent(loc);
    close();
  };
  const useCurrent = async () => {
    if (permission === 'denied') {
      Linking.openSettings().catch(() => {});
      return;
    }
    haptic.light();
    await refreshLocation();
  };

  // Current location row copy for each state.
  const usingGps = !location.isManual && status === 'ready';
  const gpsSubtitle =
    permission === 'denied'
      ? 'Location is off for AthanNow'
      : status === 'loading' && !location.isManual
        ? 'Finding you…'
        : status === 'error' && !location.isManual
          ? "Couldn't get a fix. Tap to try again."
          : permission === 'undetermined'
            ? 'Allow access to find your city'
            : usingGps
              ? location.city
              : 'Use where you are now';

  const groupStyle = [styles.group, { backgroundColor: t.c.surface1 }];
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.hairline };

  return (
    <Sheet visible={visible} onClose={close} title="Location">
      <View style={[styles.searchWrap]}>
        <View style={[styles.field, { backgroundColor: t.c.surface2 }]}>
          <SymbolView name="magnifyingglass" size={16} tintColor={t.c.textTertiary} />
          <TextInput
            style={[styles.input, { color: t.c.text }]}
            placeholder="Search city or town"
            placeholderTextColor={t.c.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => search.state === 'done' && search.places[0] && pickPlace(search.places[0])}
            autoCorrect={false}
            autoFocus={visible && status !== 'ready'}
            clearButtonMode="while-editing"
            accessibilityLabel="Search city or town"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        {q.length >= 2 ? (
          search.state === 'searching' || search.state === 'idle' ? (
            <View style={styles.state}>
              <ActivityIndicator color={t.c.textTertiary} />
            </View>
          ) : search.state === 'offline' ? (
            <View style={styles.state}>
              <Text variant="subhead" color="textSecondary" style={styles.center}>
                Can't search offline. Your recent cities still work.
              </Text>
              <Pressable onPress={() => setAttempt((a) => a + 1)} hitSlop={8} accessibilityRole="button" style={styles.textButton}>
                <Text variant="subhead" color="accentText">
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : search.places.length === 0 ? (
            <View style={styles.state}>
              <Text variant="subhead" color="textSecondary" style={styles.center}>
                No places called “{q}”. Try a nearby city.
              </Text>
            </View>
          ) : (
            <View style={groupStyle}>
              {search.places.map((p, i) => (
                <Row key={p.id} title={p.name} subtitle={[p.admin1, p.country].filter(Boolean).join(', ')} onPress={() => pickPlace(p)} style={i > 0 && divider} />
              ))}
            </View>
          )
        ) : (
          <>
            <View style={groupStyle}>
              <Row
                icon="location.fill"
                title="Current location"
                subtitle={gpsSubtitle}
                selected={usingGps}
                busy={status === 'loading' && !location.isManual}
                onPress={useCurrent}
                trailing={
                  permission === 'denied' ? (
                    <Text variant="subhead" color="accentText">
                      Settings
                    </Text>
                  ) : undefined
                }
              />
            </View>

            {recents.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text variant="footnote" color="textSecondary" header>
                    Recent
                  </Text>
                  <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10} accessibilityRole="button">
                    <Text variant="footnote" color="accentText">
                      {editing ? 'Done' : 'Edit'}
                    </Text>
                  </Pressable>
                </View>
                <View style={groupStyle}>
                  {recents.map((r, i) => {
                    const active = location.isManual && Math.abs(r.latitude - location.latitude) < 0.01 && Math.abs(r.longitude - location.longitude) < 0.01;
                    return (
                      <Row
                        key={`${r.latitude},${r.longitude}`}
                        title={r.city}
                        subtitle={r.region}
                        selected={active && !editing}
                        onPress={() => (editing ? removeRecent(r) : pickRecent(r))}
                        style={i > 0 && divider}
                        trailing={
                          editing ? (
                            <Text variant="subhead" color="danger">
                              Remove
                            </Text>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Row({
  icon,
  title,
  subtitle,
  selected,
  busy,
  trailing,
  onPress,
  style,
}: {
  icon?: 'location.fill';
  title: string;
  subtitle?: string;
  selected?: boolean;
  busy?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected: !!selected, busy: !!busy }}
      style={({ pressed }) => [styles.row, style, pressed && { backgroundColor: t.c.surface3 }]}
    >
      {icon && <SymbolView name={icon} size={16} tintColor={t.c.textSecondary} />}
      <View style={styles.rowText}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {busy ? <ActivityIndicator color={t.c.textTertiary} /> : trailing ?? (selected ? <SymbolView name="checkmark" size={15} tintColor={t.c.accent} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 12, paddingHorizontal: 12 },
  // No lineHeight on a single-line TextInput: it shifts the baseline on iOS.
  input: { flex: 1, ...textStyle('body'), lineHeight: undefined, height: 40 },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  group: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 },
  rowText: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  state: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 8 },
  center: { textAlign: 'center' },
  textButton: { minHeight: 44, justifyContent: 'center' },
});
