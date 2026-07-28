import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import type { InvestorProUpsellReason } from '../../services/investorProUpsell';
import InvestorProHeroBrand from './InvestorProHeroBrand';

type Props = {
  visible: boolean;
  reason: InvestorProUpsellReason;
  priceLabel?: string | null;
  priceLine?: string | null;
  billedHeadline?: string | null;
  isDark: boolean;
  buying?: boolean;
  onSubscribe: () => void;
  onLater: () => void;
};

export default function InvestorProUpsellModal({
  visible,
  reason,
  priceLabel,
  priceLine,
  isDark,
  buying = false,
  onSubscribe,
  onLater,
}: Props) {
  const { t } = useI18n();
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111111';
  const sub = isDark ? '#8E8E93' : '#6B7280';
  const hasPrice = Boolean(priceLabel);

  const titleKey = `profile.shop.investorProUpsell.${reason}.title` as const;
  const bodyKey = `profile.shop.investorProUpsell.${reason}.body` as const;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <InvestorProHeroBrand isDark={isDark} lit />
          {!hasPrice ? (
            <View style={styles.priceLoading}>
              <ActivityIndicator color={isDark ? '#F59E0B' : '#B45309'} />
              <Text style={[styles.priceLoadingText, { color: sub }]}>
                {t('profile.shop.investorProPriceLoading')}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.title, { color: text }]}>{t(titleKey)}</Text>
          <Text style={[styles.body, { color: sub }]}>{t(bodyKey)}</Text>
          <Text style={[styles.creditsLine, { color: text }]}>{t('profile.shop.investorProUpsell.creditsLine')}</Text>

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
          <Pressable onPress={onLater} style={styles.laterBtn}>
            <Text style={[styles.laterText, { color: sub }]}>{t('profile.shop.investorProUpsell.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 34,
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
  title: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  creditsLine: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
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
