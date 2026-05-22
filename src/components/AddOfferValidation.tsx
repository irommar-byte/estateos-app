import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';
import { charsRemainingLabel } from '../i18n/units';

const DANGER = '#FF3B30';

type FieldHintProps = {
  current: number;
  min?: number;
  max?: number;
  /** Gdy false — nie pokazuj podpowiedzi przy pustym polu. */
  showWhenEmpty?: boolean;
};

/** Krótka czerwona linia pod polem — tylko dopóki minimum nie spełnione. */
export function AddOfferFieldHint({
  current,
  min,
  max,
  showWhenEmpty = true,
}: FieldHintProps) {
  const { t } = useI18n();

  if (!showWhenEmpty && current === 0) return null;

  if (max != null && current > max) {
    const over = current - max;
    return (
      <Text style={styles.hint}>
        {t('addOffer.fieldHint.shortenBy', { count: over, unit: charsRemainingLabel(over) })}
      </Text>
    );
  }

  if (min != null && current < min) {
    const left = min - current;
    return (
      <Text style={styles.hint}>
        {t('addOffer.fieldHint.missingChars', {
          count: left,
          unit: charsRemainingLabel(left),
          min,
        })}
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  hint: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
    marginLeft: 4,
  },
});
