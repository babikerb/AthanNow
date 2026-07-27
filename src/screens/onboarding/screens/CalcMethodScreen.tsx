import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useSettings } from '../../../context/SettingsContext';
import { AppLocation } from '../../../hooks/useLocation';
import { ACCENT, skyTextSecondary } from '../../../theme/colors';
import { PRESSED_OPACITY } from '../../../theme/motion';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { type } from '../../../theme/typography';
import { CALC_METHOD_WHY, CALC_METHODS, calcMethodForCountry, localeCountryCode } from '../../../utils/calcMethodDefaults';
import { onboardingGradient } from '../../../utils/timeOfDayGradient';
import { OnboardingLayout } from '../OnboardingLayout';
import { StaggerReveal } from '../StaggerReveal';

interface Props {
  progressTotal: number;
  location: AppLocation | null;
  /** True only for the first-run flow — a replay (plan §4.3) must never
   *  silently overwrite a calc method the user already chose. */
  applyDefault: boolean;
  onNext: () => void;
  onClose?: () => void;
}

/**
 * Screen 3 — Calculation method (plan §4.2 Screen 3), the dead tour target's
 * (`settings-calc`) real replacement. Picks a smart, region-aware default
 * instead of the app's previous unconditional `NorthAmerica` default, shows
 * it pre-selected with a one-line "why", and offers a "See all 12 methods"
 * inline expansion instead of requiring a trip to Settings.
 */
export function CalcMethodScreen({ progressTotal, location, applyDefault, onNext, onClose }: Props) {
  const gradient = useMemo(() => onboardingGradient(), []);
  const settings = useSettings();
  const [expanded, setExpanded] = useState(false);

  const countryCode = location?.countryCode ?? localeCountryCode();
  const recommended = useMemo(() => calcMethodForCountry(countryCode), [countryCode]);

  useEffect(() => {
    if (applyDefault) settings.update({ calcMethod: recommended });
    // Only re-applies if the resolved country changes mid-flow (e.g. GPS
    // resolves after this screen already mounted with the locale fallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDefault, recommended]);

  const selected = settings.calcMethod;
  const selectedLabel = CALC_METHODS.find((m) => m.key === selected)?.label ?? selected;
  const why = CALC_METHOD_WHY[selected];

  const choose = (key: typeof selected) => {
    Haptics.selectionAsync();
    settings.update({ calcMethod: key });
  };

  return (
    <OnboardingLayout
      gradient={gradient}
      progressIndex={2}
      progressTotal={progressTotal}
      onClose={onClose}
      footer={
        <StaggerReveal index={2} count={3}>
          <Pressable
            onPress={onNext}
            style={({ pressed }) => [st.btn, pressed && st.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={st.btnText}>Continue</Text>
          </Pressable>
        </StaggerReveal>
      }
    >
      <StaggerReveal index={0} count={3}>
        <Text style={st.headline}>Choose how prayer times are calculated</Text>
      </StaggerReveal>
      <StaggerReveal index={1} count={3}>
        <>
          <Text style={st.body}>
            Different regions and schools of thought calculate Fajr and Isha slightly differently. We've picked what's
            common for your area — change it anytime in Settings.
          </Text>

          <Pressable onPress={() => choose(selected)} style={st.selectedRow} accessibilityRole="button">
            <SymbolView name="checkmark.circle.fill" size={22} tintColor={ACCENT} />
            <Text style={st.selectedText}>
              <Text style={st.selectedLabel}>{selectedLabel}</Text>
              {'\n'}
              <Text style={st.selectedWhy}>{why}</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
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
                  >
                    <Text style={st.optionLabel}>{m.label}</Text>
                    {isSelected && <SymbolView name="checkmark" size={16} tintColor={ACCENT} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      </StaggerReveal>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  headline: { ...type.title1, color: '#FFFFFF' } as any,
  body: { ...type.body, color: skyTextSecondary, marginTop: spacing.sm } as any,
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  selectedText: { flex: 1 },
  selectedLabel: { ...type.bodyEmph, color: '#FFFFFF' } as any,
  selectedWhy: { ...type.footnote, color: skyTextSecondary } as any,
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.md, alignSelf: 'flex-start' },
  expandText: { ...type.footnote, color: skyTextSecondary } as any,
  list: { marginTop: spacing.sm, maxHeight: 220 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  optionLabel: { ...type.body, color: '#FFFFFF' } as any,
  btn: { backgroundColor: ACCENT, borderRadius: radii.pill, paddingVertical: spacing.lg, alignItems: 'center' },
  btnPressed: { opacity: PRESSED_OPACITY },
  btnText: { ...type.headline, color: '#FFFFFF' } as any,
});
