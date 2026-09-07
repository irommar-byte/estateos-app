import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AuctionEventRecord } from '../../contracts/auctionContract';
import { useI18n, localeToDateFormat } from '../../i18n';
import { formatAmountWithCurrency } from '../../money/format';
import { normalizeListingCurrency } from '../../money/convert';

type Props = {
  event: AuctionEventRecord;
  isDark: boolean;
  onPress: () => void;
};

export default function AuctionOfferBanner({ event, isDark, onPress }: Props) {
  const { t, locale } = useI18n();
  const isLive = event.status === 'LIVE';
  const priceLabel = formatAmountWithCurrency(
    event.currentPrice || event.startPrice,
    normalizeListingCurrency(event.currency)
  );
  const dateLabel = new Date(event.startsAt).toLocaleString(localeToDateFormat(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        isDark ? styles.rootDark : styles.rootLight,
        isLive && styles.rootLive,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.gloss} />
      <View style={[styles.iconWrap, isDark && styles.iconWrapDark]}>
        <Ionicons name="hammer-outline" size={22} color="#8B5CF6" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {t('auction.offerBanner.title')}
          </Text>
          {isLive ? (
            <View style={styles.livePill}>
              <Text style={styles.liveText}>{t('auction.event.live')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.subtitle, { color: isDark ? 'rgba(235,235,245,0.72)' : '#4B5563' }]}>
          {isLive
            ? t('auction.offerBanner.subtitleLive', { price: priceLabel, bids: event.bidCount })
            : t('auction.offerBanner.subtitleScheduled', { date: dateLabel })}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('auction.offerBanner.cta')}</Text>
        <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  rootLight: {
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.38)',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  rootDark: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderColor: 'rgba(167,139,250,0.45)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  rootLive: {
    shadowOpacity: 0.32,
    shadowRadius: 22,
  },
  gloss: {
    position: 'absolute',
    left: 18,
    right: 48,
    top: 2,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  iconWrapDark: {
    borderColor: 'rgba(255,255,255,0.16)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800' },
  livePill: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowColor: '#EF4444',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  liveText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  subtitle: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  cta: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
