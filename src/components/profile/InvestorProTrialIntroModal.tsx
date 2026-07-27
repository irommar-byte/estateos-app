import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';

type Props = {
  visible: boolean;
  priceLine?: string | null;
  buying?: boolean;
  onSubscribe: () => void;
  onLater: () => void;
  isDark: boolean;
};

/**
 * Dolny panel (bez RN Modal) — nie przyciemnia ani nie blokuje całego ekranu.
 * Górna część profilu pozostaje przewijalna i klikalna.
 */
export default function InvestorProTrialIntroModal({
  visible,
  priceLine,
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
        <View style={styles.badge}>
          <Ionicons name="gift" size={22} color="#FFFFFF" />
          <Text style={styles.badgeText}>{t('profile.shop.investorProTrialBadge')}</Text>
        </View>
        <Text style={[styles.title, { color: text }]}>{t('profile.shop.investorProTrialIntroTitle')}</Text>
        <Text style={[styles.body, { color: sub }]}>{t('profile.shop.investorProTrialIntroBody')}</Text>
        <Text style={[styles.price, { color: text }]}>
          {priceLine || t('profile.shop.investorProTrialPriceFallback')}
        </Text>
        <Text style={[styles.legal, { color: sub }]}>{t('profile.shop.investorProTrialLegal')}</Text>
        <Pressable
          style={[styles.cta, buying && styles.ctaDisabled]}
          disabled={buying}
          onPress={onSubscribe}
          accessibilityRole="button"
        >
          {buying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>{t('profile.shop.investorProTrialIntroCta')}</Text>
          )}
        </Pressable>
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
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 16,
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  price: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
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
  ctaDisabled: { opacity: 0.85 },
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
