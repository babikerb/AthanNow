import { SymbolView } from 'expo-symbols';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Labelled input on surface2. Focus lifts the fill to surface3 with a brighter hairline (accent stays for the caret); errors speak in words, not just colour. */
export function TextField({ label, error, hint, onFocus, onBlur, ...rest }: TextFieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? (
        <Text variant="footnote" color="textSecondary" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label ?? rest.placeholder}
        accessibilityHint={error ?? hint}
        placeholderTextColor={t.c.textSecondary}
        selectionColor={t.c.accent}
        keyboardAppearance={t.scheme}
        allowFontScaling
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          { ...t.type('body'), lineHeight: undefined },
          {
            minHeight: 48,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radii.control,
            borderCurve: 'continuous',
            backgroundColor: focused ? t.c.surface3 : t.c.surface2,
            color: t.c.text,
            borderWidth: 1,
            borderColor: error ? t.c.danger : focused ? t.c.glyphQuiet : t.c.hairline,
          },
        ]}
      />
      {error || hint ? (
        <Text variant="caption" color={error ? 'danger' : 'textSecondary'} accessibilityElementsHidden>
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface SearchBarProps extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value' | 'placeholder'> {
  /** Name what is being searched, e.g. "Search surahs". No generic default. */
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}

/** Search field with leading glyph and clear button. */
export function SearchBar({ value, onChangeText, placeholder, ...rest }: SearchBarProps) {
  const t = useTheme();
  return (
    <View
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.control,
        borderCurve: 'continuous',
        backgroundColor: t.c.surface2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.c.hairline,
      }}
    >
      <SymbolView name="magnifyingglass" size={16} tintColor={t.c.textSecondary} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={t.c.textSecondary}
        selectionColor={t.c.accent}
        keyboardAppearance={t.scheme}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        {...rest}
        value={value}
        onChangeText={onChangeText}
        style={[{ ...t.type('body'), lineHeight: undefined }, { flex: 1, color: t.c.text, paddingVertical: 10 }]}
      />
      {value.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={14} onPress={() => onChangeText('')}>
          <SymbolView name="xmark.circle.fill" size={16} tintColor={t.c.glyphQuiet} />
        </Pressable>
      ) : null}
    </View>
  );
}
