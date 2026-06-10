import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  discountPercent: number;
  listedPriceLabel: string;
  compact?: boolean;
  isDark?: boolean;
};

export default function OfferDiscountPriceBlock({
  discountPercent,
  listedPriceLabel,
  compact = false,
  isDark = true,
}: Props) {
  if (!discountPercent || !listedPriceLabel) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>−{discountPercent}%</Text>
      </View>
      <Text
        style={[
          styles.listedPrice,
          compact && styles.listedPriceCompact,
          isDark ? styles.listedPriceDark : styles.listedPriceLight,
        ]}
        numberOfLines={1}
      >
        {listedPriceLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    marginBottom: 4,
  },
  wrapCompact: {
    gap: 4,
    marginBottom: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: 'rgba(248,113,113,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  listedPrice: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(248,113,113,0.75)',
  },
  listedPriceCompact: {
    fontSize: 12,
  },
  listedPriceDark: {
    color: 'rgba(156,163,175,0.95)',
  },
  listedPriceLight: {
    color: '#6b7280',
  },
});
