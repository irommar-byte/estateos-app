import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OpenHouseEventRecord } from '../../contracts/openHouseContract';
import { useI18n, localeToDateFormat } from '../../i18n';

type Props = {
  event: OpenHouseEventRecord;
  isDark: boolean;
  onPress: () => void;
};

export default function OpenHouseOfferBanner({ event, isDark, onPress }: Props) {
  const { t, locale } = useI18n();
  const dateLabel = event.nextSlotStartsAt
    ? new Date(event.nextSlotStartsAt).toLocaleString(localeToDateFormat(locale), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.12)',
          borderColor: isDark ? 'rgba(251,191,36,0.45)' : 'rgba(245,158,11,0.35)',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="door-open-outline" size={22} color="#F59E0B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {t('openHouse.offerBanner.title')}
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? 'rgba(235,235,245,0.65)' : '#6B7280' }]}>
          {t('openHouse.offerBanner.subtitle', { date: dateLabel, spots: event.totalSpotsLeft })}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('openHouse.offerBanner.cta')}</Text>
        <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  cta: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ctaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
