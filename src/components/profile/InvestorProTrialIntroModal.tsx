import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import InvestorProHeroBrand from './InvestorProHeroBrand';

type Props = {
  visible: boolean;
  /** Localized StoreKit price, e.g. "49,99 zł" or "$9.99". Required for Apple 3.1.2(c). */
  priceLabel?: string | null;
  priceLine?: string | null;
  billedHeadline?: string | null;
  buying?: boolean;
  onSubscribe: () => void;
  onLater: () => void;
  isDark: boolean;
};

/**
 * Dolny panel (bez RN Modal) — nie przyciemnia ani nie blokuje całego ekranu.
 * Hierarchia: branded hero → copy → trial (podrzędny) → CTA z ceną.
 */
export default function InvestorProTrialIntroModal({
  visible,
  priceLabel,
  priceLine,
  billedHeadline: _billedHeadline,
  buying = false,
  onSubscribe,
  onLater,
  isDark,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111111';
  const sub = isDark ? '#8E8E93' : '#6B7280';
  const hasPrice = Boolean(priceLabel);

  if (!visible) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: bg,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          },
        ]}
        pointerEvents="auto"
      >
        <InvestorProHeroBrand isDark={isDark} lit />
        {!hasPrice ? (
          <View style={styles.priceLoading}>
            <ActivityIndicator color={isDark ? '#F59E0B' : '#B45309'} />
            <Text style={[styles.priceLoadingText, { color: sub }]}>
              {t('profile.shop.investorProPriceLoading')}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.body, { color: sub }]}>{t('profile.shop.investorProTrialIntroBody')}</Text>

        {hasPrice ? (
          <Text style={[styles.price, { color: text }]}>
            {priceLine ||
              t('profile.shop.investorProTrialPriceAfter', { price: priceLabel as string })}
          </Text>
        ) : null}

        <Text style={[styles.trialNote, { color: sub }]}>
          {t('profile.shop.investorProTrialSubordinate')}
        </Text>
        <Text style={[styles.legal, { color: sub }]}>{t('profile.shop.investorProTrialLegal')}</Text>

        <Pressable
          style={[styles.cta, (buying || !hasPrice) && styles.ctaDisabled]}
          disabled={buying || !hasPrice}
          onPress={onSubscribe}
          accessibilityRole="button"
        >
          {buying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>
              {hasPrice
                ? t('profile.shop.investorProSubscribeCta', { price: priceLabel as string })
                : t('profile.shop.investorProPriceLoading')}
            </Text>
          )}
        </Pressable>
        <Text style={[styles.ctaSub, { color: sub }]}>
          {t('profile.shop.investorProSubscribeCtaSub')}
        </Text>
        <Pressable onPress={onLater} disabled={buying} style={styles.laterBtn} accessibilityRole="button">
          <Text style={[styles.laterText, { color: sub }]}>{t('profile.shop.investorProTrialIntroLater')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 32,
    elevation: 32,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 16,
  },
  priceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
    minHeight: 28,
  },
  priceLoadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  price: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trialNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  legal: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  cta: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  ctaSub: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  laterBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
