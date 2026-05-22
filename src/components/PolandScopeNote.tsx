import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useI18n } from '../i18n';

type Props = {
  isDark?: boolean;
  variant?: 'inline' | 'compact';
};

/** Informacja: lista miast/dzielnic = wyłącznie rynek polski. */
export default function PolandScopeNote({ isDark, variant = 'inline' }: Props) {
  const { t } = useI18n();
  const isCompact = variant === 'compact';

  return (
    <View
      style={[
        styles.wrap,
        isCompact && styles.wrapCompact,
        {
          backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.1)',
          borderColor: isDark ? 'rgba(52,199,89,0.35)' : 'rgba(52,199,89,0.28)',
        },
      ]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('radar.polandScope.badge')}</Text>
      </View>
      <Text
        style={[
          isCompact ? styles.textCompact : styles.text,
          { color: isDark ? 'rgba(210,252,235,0.92)' : '#0B5B43' },
        ]}
      >
        {isCompact ? t('radar.polandScope.compact') : t('radar.polandScope.inline')}
      </Text>
      {!isCompact ? (
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={isDark ? 'rgba(160,245,200,0.75)' : '#15803D'}
          style={styles.icon}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  wrapCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: 'rgba(52,199,89,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 1,
  },
  badgeText: {
    color: '#34C759',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  textCompact: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  icon: {
    marginTop: 1,
  },
});
