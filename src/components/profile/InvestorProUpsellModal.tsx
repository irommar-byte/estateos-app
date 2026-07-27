import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';
import type { InvestorProUpsellReason } from '../../services/investorProUpsell';

type Props = {
  visible: boolean;
  reason: InvestorProUpsellReason;
  priceLine?: string | null;
  isDark: boolean;
  buying?: boolean;
  onSubscribe: () => void;
  onLater: () => void;
};

export default function InvestorProUpsellModal({
  visible,
  reason,
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

  const titleKey = `profile.shop.investorProUpsell.${reason}.title` as const;
  const bodyKey = `profile.shop.investorProUpsell.${reason}.body` as const;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.badge}>
            <Ionicons name="diamond" size={22} color="#FFFFFF" />
            <Text style={styles.badgeText}>{t('profile.shop.investorProTrialBadge')}</Text>
          </View>
          <Text style={[styles.title, { color: text }]}>{t(titleKey)}</Text>
          <Text style={[styles.body, { color: sub }]}>{t(bodyKey)}</Text>
          <Text style={[styles.creditsLine, { color: text }]}>{t('profile.shop.investorProUpsell.creditsLine')}</Text>
          <Text style={[styles.price, { color: text }]}>
            {priceLine || t('profile.shop.investorProTrialPriceFallback')}
          </Text>
          <Text style={[styles.legal, { color: sub }]}>{t('profile.shop.investorProTrialLegal')}</Text>
          <Pressable style={[styles.cta, buying && styles.ctaDisabled]} disabled={buying} onPress={onSubscribe}>
            <Text style={styles.ctaText}>
              {buying ? t('profile.shop.restoring') : t('profile.shop.investorProUpsell.cta')}
            </Text>
          </Pressable>
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
    paddingTop: 20,
    paddingBottom: 34,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  creditsLine: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  price: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  legal: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  cta: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  laterBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
