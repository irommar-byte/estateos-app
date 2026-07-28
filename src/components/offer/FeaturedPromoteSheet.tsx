import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Minus, Plus, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import { useI18n } from '../../i18n';
import { useIsDarkTheme } from '../../store/useThemeStore';

const DAYS_PER_CREDIT = 7;
const MAX_CREDITS = 12;

type Props = {
  visible: boolean;
  creditBalance: number;
  hasCredits: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (credits: number) => void;
  onTopUp: () => void;
};

/**
 * Apple-style featured promotion confirm — credit stepper + balance.
 */
export default function FeaturedPromoteSheet({
  visible,
  creditBalance,
  hasCredits,
  loading = false,
  onClose,
  onConfirm,
  onTopUp,
}: Props) {
  const { t } = useI18n();
  const isDark = useIsDarkTheme();
  const maxSelectable = Math.max(1, Math.min(MAX_CREDITS, Math.max(1, creditBalance || 1)));
  const [credits, setCredits] = useState(1);

  useEffect(() => {
    if (!visible) return;
    setCredits(hasCredits ? 1 : 1);
  }, [visible, hasCredits, creditBalance]);

  const days = credits * DAYS_PER_CREDIT;
  const canDecrease = hasCredits && credits > 1 && !loading;
  const canIncrease = hasCredits && credits < maxSelectable && !loading;

  const creditsLabel = useMemo(() => {
    if (creditBalance === 1) return t('profile.shop.creditsOnAccountCreditOne');
    if (creditBalance >= 2 && creditBalance <= 4) return t('profile.shop.creditsOnAccountCreditFew');
    return t('profile.shop.creditsOnAccountCreditMany');
  }, [creditBalance, t]);

  const balanceText = hasCredits
    ? t('profile.shop.creditsOnAccountCount', { count: creditBalance, creditsLabel })
    : t('profile.shop.creditsOnAccountEmpty');

  const creditsWord =
    credits === 1
      ? t('profile.myOffers.promote.creditsWordOne')
      : credits >= 2 && credits <= 4
        ? t('profile.myOffers.promote.creditsWordFew')
        : t('profile.myOffers.promote.creditsWordMany');

  const sheetBg = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.14)';
  const titleColor = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(60,60,67,0.72)';
  const rowBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.12)';
  const stepperBtnBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(120,120,128,0.18)';
  const stepperIcon = isDark ? '#FFFFFF' : '#000000';
  const cancelBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,128,0.14)';
  const cancelText = isDark ? '#FFFFFF' : '#000000';

  const bump = (delta: number) => {
    if (!hasCredits || loading) return;
    setCredits((prev) => {
      const next = Math.max(1, Math.min(maxSelectable, prev + delta));
      if (next !== prev) void Haptics.selectionAsync();
      return next;
    });
  };

  const handlePrimary = () => {
    if (loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!hasCredits) {
      onTopUp();
      return;
    }
    onConfirm(credits);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.38)' }]}
          onPress={loading ? undefined : onClose}
        />
        <BlurView intensity={isDark ? 92 : 84} tint={isDark ? 'dark' : 'light'} style={[styles.sheet, { backgroundColor: sheetBg, borderColor: border }]}>
          <View style={styles.iconAura}>
            <View style={styles.iconCore}>
              <Star size={22} color="#000" fill="#000" strokeWidth={0} />
            </View>
          </View>

          <Text style={[styles.title, { color: titleColor }]}>{t('profile.myOffers.promote.confirmTitle')}</Text>
          <Text style={[styles.body, { color: muted }]}>
            {t('profile.myOffers.promote.confirmBodyStepper', {
              credits,
              days,
              creditsWord,
            })}
          </Text>

          <View style={[styles.stepperCard, { backgroundColor: rowBg }]}>
            <View style={styles.stepperCopy}>
              <Text style={[styles.stepperTitle, { color: titleColor }]}>
                {t('profile.myOffers.promote.creditsStepperLabel')}
              </Text>
              <Text style={[styles.stepperHint, { color: muted }]}>
                {t('profile.myOffers.promote.creditsStepperHint', { days })}
              </Text>
            </View>
            <View style={styles.stepperControls}>
              <Pressable
                onPress={() => bump(-1)}
                disabled={!canDecrease}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  { backgroundColor: stepperBtnBg },
                  pressed && canDecrease && { opacity: 0.7 },
                  !canDecrease && { opacity: 0.35 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('profile.myOffers.promote.creditsDecreaseA11y')}
              >
                <Minus size={16} color={stepperIcon} strokeWidth={2.6} />
              </Pressable>
              <Text style={[styles.stepperValue, { color: titleColor }]}>{hasCredits ? credits : 0}</Text>
              <Pressable
                onPress={() => bump(1)}
                disabled={!canIncrease}
                style={({ pressed }) => [
                  styles.stepperBtn,
                  { backgroundColor: stepperBtnBg },
                  pressed && canIncrease && { opacity: 0.7 },
                  !canIncrease && { opacity: 0.35 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('profile.myOffers.promote.creditsIncreaseA11y')}
              >
                <Plus size={16} color={stepperIcon} strokeWidth={2.6} />
              </Pressable>
            </View>
          </View>

          <View style={styles.balanceBlock}>
            <Text style={[styles.balanceTitle, { color: muted }]}>{t('profile.shop.creditsOnAccountTitle')}</Text>
            <Text style={[styles.balanceValue, { color: titleColor }]}>{balanceText}</Text>
          </View>

          <View style={styles.actions}>
            <ApplePressable
              style={[styles.btn, styles.btnCancel, { backgroundColor: cancelBg }]}
              onPress={onClose}
              disabled={loading}
              haptic="selection"
            >
              <Text style={[styles.btnCancelText, { color: cancelText }]}>{t('common.cancel')}</Text>
            </ApplePressable>
            <ApplePressable
              style={[styles.btn, styles.btnPrimary, !hasCredits && styles.btnTopUp]}
              onPress={handlePrimary}
              disabled={loading}
              haptic="none"
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {hasCredits
                    ? t('profile.myOffers.promote.confirmAction')
                    : t('profile.myOffers.promote.topUpAction')}
                </Text>
              )}
            </ApplePressable>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  iconAura: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepperCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepperCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepperTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepperHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  balanceBlock: {
    marginBottom: 18,
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {},
  btnCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: '#FBBF24',
  },
  btnTopUp: {
    backgroundColor: '#34C759',
  },
  btnPrimaryText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
});
