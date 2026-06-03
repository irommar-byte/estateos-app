import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';

type Props = {
  visible: boolean;
  priceLine?: string | null;
  buying?: boolean;
  onSubscribe: () => void;
  onLater: () => void;
  isDark: boolean;
};

export default function InvestorProTrialIntroModal({
  visible,
  priceLine,
  buying = false,
  onSubscribe,
  onLater,
  isDark,
}: Props) {
  const { t } = useI18n();
  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111111';
  const sub = isDark ? '#8E8E93' : '#6B7280';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.badge}>
            <Ionicons name="gift" size={22} color="#FFFFFF" />
            <Text style={styles.badgeText}>{t('profile.shop.investorProTrialBadge')}</Text>
          </View>
          <Text style={[styles.title, { color: text }]}>{t('profile.shop.investorProTrialIntroTitle')}</Text>
          <Text style={[styles.body, { color: sub }]}>{t('profile.shop.investorProTrialIntroBody')}</Text>
          {priceLine ? <Text style={[styles.price, { color: text }]}>{priceLine}</Text> : null}
          <Pressable style={[styles.cta, buying && styles.ctaDisabled]} disabled={buying} onPress={onSubscribe}>
            <Text style={styles.ctaText}>
              {buying ? t('profile.shop.restoring') : t('profile.shop.investorProTrialIntroCta')}
            </Text>
          </Pressable>
          <Pressable onPress={onLater} disabled={buying} style={styles.laterBtn}>
            <Text style={[styles.laterText, { color: sub }]}>{t('profile.shop.investorProTrialIntroLater')}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
