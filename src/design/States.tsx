import { SymbolView } from 'expo-symbols';
import React from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

interface StateProps {
  /** Say what is missing in this place, in plain words. No generic fallback on purpose. */
  title: string;
  /** What the person can do or what happens next. */
  message: string;
  icon?: SFSymbol;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state, left-aligned and editorial: a Fraunces line, one plain sentence, at most one action.
 * Copy is required so every empty state names its own thing (BRAND.md section 8).
 */
export function EmptyState({ title, message, icon, actionLabel, onAction }: StateProps) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: t.spacing.xxxl, gap: t.spacing.md }}>
      <View accessible accessibilityLabel={`${title}. ${message}`} style={{ gap: t.spacing.sm }}>
        {icon ? <SymbolView name={icon} size={28} type="hierarchical" tintColor={t.c.textSecondary} /> : null}
        <Text variant="title1" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text variant="body" color="textSecondary">
          {message}
        </Text>
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

/** Error state: names what failed, says what is still true, offers a retry. */
export function ErrorState({ title, message, onRetry, retryLabel = 'Try again' }: { title: string; message: string; onRetry?: () => void; retryLabel?: string }) {
  return <EmptyState icon="exclamationmark.triangle" title={title} message={message} actionLabel={onRetry ? retryLabel : undefined} onAction={onRetry} />;
}
