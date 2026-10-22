import { colorTokens } from '../../../design/tokens.generated';
import { haptic } from '../../../design/haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useSettings } from '../../../context/SettingsContext';
import { AppLocation } from '../../../hooks/useLocation';
import { skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing as space } from '../../../design/tokens';
import { textStyle } from '../../../design/tokens';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../../../utils/calcMethodDefaults';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingBeacon } from '../OnboardingBeacon';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  index: number;
  total: number;
  location: AppLocation | null;
  /** True only for the first-run flow — a replay must never silently
   *  overwrite a calc method the user already chose. */
  applyDefault: boolean;
  onNext: () => void;
  onClose?: () => void;
}

/**
 * Calculation-method step: picks a smart, region-aware default and shows it
 * pre-selected with a one-line "why", plus an inline "See all 12 methods"
 * expansion instead of requiring a trip to Settings. No real element to
 * spotlight (see `steps.ts`'s doc comment on why this doesn't target the
 * Settings row), so it centers over the dimmed current tab.
 */
export function CalcMethodStep({ index, total, location, applyDefault, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const settings = useSettings();
  const [expanded, setExpanded] = useState(false);

  const countryCode = location?.countryCode ?? localeCountryCode();
  const recommended = useMemo(() => calcMethodForCountry(countryCode), [countryCode]);

  useEffect(() => {
    if (applyDefault) settings.update({ calcMethod: recommended });
    // Only re-applies if the resolved country changes mid-flow (e.g. GPS
    // resolves after this step already mounted with the locale fallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDefault, recommended]);

  const selected = settings.calcMethod;
  const selectedLabel = CALC_METHODS.find((m) => m.key === selected)?.label ?? selected;
  const why = CALC_METHOD_WHY[selected];

  const choose = (key: typeof selected) => {
    haptic.select();
    settings.update({ calcMethod: key });
  };

  return (
    <OnboardingBeacon
      index={index}
      total={total}
      gradient={gradient}
      onClose={onClose}
      content={
        <>
          <StaggerReveal index={0} count={2}>
            <Text style={st.title}>Choose how prayer times are calculated</Text>
          </StaggerReveal>
          <StaggerReveal index={1} count={2}>
            <>
              <Text style={st.body}>
                Different regions and schools of thought calculate Fajr and Isha slightly differently. We've picked
                what's common for your area — change it anytime in Settings.
              </Text>

              <Pressable onPress={() => choose(selected)} style={st.selectedRow} accessibilityRole="button">
                <SymbolView name="checkmark.circle.fill" size={22} tintColor={colorTokens.dark.accent} />
                <Text style={st.selectedText}>
                  <Text style={st.selectedLabel}>{selectedLabel}</Text>
                  {'\n'}
                  <Text style={st.selectedWhy}>{why}</Text>
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  haptic.select();
                  setExpanded((e) => !e);
                }}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Hide all methods' : 'See all 12 methods'}
                style={st.expandRow}
              >
                <Text style={st.expandText}>{expanded ? 'Hide all methods' : 'See all 12 methods'}</Text>
                <SymbolView name={expanded ? 'chevron.up' : 'chevron.down'} size={14} tintColor={skyTextSecondary} />
              </Pressable>

              {expanded && (
                <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
                  {CALC_METHODS.map((m) => {
                    const isSelected = m.key === selected;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => choose(m.key)}
                        style={({ pressed }) => [st.optionRow, pressed && { opacity: PRESSED_OPACITY }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={st.optionLabel}>{m.label}</Text>
                        {isSelected && <SymbolView name="checkmark" size={16} tintColor={colorTokens.dark.accent} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </>
          </StaggerReveal>
        </>
      }
      primaryLabel="Continue"
      onPrimary={onNext}
    />
  );
}

const st = StyleSheet.create({
  title: { ...textStyle('title3'), color: colorTokens.dark.skyText } as any,
  body: { ...textStyle('body'), color: skyTextSecondary, marginTop: space.xs } as any,
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radii.md,
    backgroundColor: colorTokens.dark.skyWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colorTokens.dark.skyHairline,
  },
  selectedText: { flex: 1 },
  selectedLabel: { ...textStyle('bodyEmph'), color: colorTokens.dark.skyText } as any,
  selectedWhy: { ...textStyle('footnote'), color: skyTextSecondary } as any,
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md, alignSelf: 'flex-start' },
  expandText: { ...textStyle('footnote'), color: skyTextSecondary } as any,
  list: { marginTop: space.sm, maxHeight: 200 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorTokens.dark.skyHairline,
  },
  optionLabel: { ...textStyle('body'), color: colorTokens.dark.skyText } as any,
});
