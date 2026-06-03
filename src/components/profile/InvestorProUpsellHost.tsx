import React, { useCallback, useEffect, useState } from 'react';
import { Alert, InteractionManager, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import InvestorProUpsellModal from './InvestorProUpsellModal';
import { useI18n } from '../../i18n';
import { API_URL } from '../../config/network';
import { useAuthStore } from '../../store/useAuthStore';
import {
  hasActiveInvestorProMembership,
  userAfterInvestorProPurchase,
} from '../../utils/investorProMembership';
import { fetchInvestorProStoreListing } from '../../services/iapInvestorProListing';
import { presentInvestorProSubscriptionSheet } from '../../services/iapInvestorPro';
import { investorProPurchaseAlertCopy, investorProPurchaseErrorAlertCopy } from '../../utils/investorProPurchaseFeedback';
import type { SubscriptionStoreListing } from '../../services/iapManager';
import {
  dismissInvestorProUpsell,
  subscribeInvestorProUpsell,
  type InvestorProUpsellReason,
} from '../../services/investorProUpsell';

export default function InvestorProUpsellHost() {
  const { t } = useI18n();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [reason, setReason] = useState<InvestorProUpsellReason | null>(null);
  const [listing, setListing] = useState<SubscriptionStoreListing | null>(null);
  const [buying, setBuying] = useState(false);

  const hasPro = hasActiveInvestorProMembership(user);

  useEffect(() => {
    return subscribeInvestorProUpsell((request) => {
      if (!request || hasActiveInvestorProMembership(useAuthStore.getState().user)) {
        setReason(null);
        return;
      }
      setReason(request.reason);
      void fetchInvestorProStoreListing().then(setListing);
    });
  }, []);

  useEffect(() => {
    if (hasPro) setReason(null);
  }, [hasPro]);

  const priceLine =
    listing?.priceLabel != null
      ? t('profile.shop.investorProTrialPriceAfter', { price: listing.priceLabel })
      : t('profile.shop.investorProTrialPriceFallback');

  const handleLater = useCallback(() => {
    setReason(null);
    dismissInvestorProUpsell();
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (buying) return;
    if (!token) {
      Alert.alert(
        t('profile.shop.alerts.loginRequiredTitle'),
        t('profile.shop.alerts.investorProLoginBody'),
      );
      return;
    }

    setBuying(true);
    setReason(null);
    dismissInvestorProUpsell();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hadProBeforePurchase = hasActiveInvestorProMembership(user);
    try {
      const result = await presentInvestorProSubscriptionSheet(API_URL, token);
      if (!result.ok) {
        if (result.cancelled) return;
        const alertCopy = investorProPurchaseErrorAlertCopy(t, {
          errorCode: result.errorCode,
          message: result.message,
        });
        Alert.alert(alertCopy.title, alertCopy.body);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await refreshUser?.();
      const patched = userAfterInvestorProPurchase(useAuthStore.getState().user as Record<string, unknown>, {
        backendRegistered: Boolean(result.backendRegistered),
        isPro: result.isPro,
        proExpiresAt: result.proExpiresAt,
        extraListings: result.extraListings,
        plusExpiresAt: result.plusExpiresAt,
      });
      if (patched) {
        const current = useAuthStore.getState().user;
        if (current) {
          const merged = { ...current, ...patched };
          useAuthStore.setState({ user: merged });
          await AsyncStorage.setItem('user_data', JSON.stringify(merged));
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const alertCopy = investorProPurchaseAlertCopy(
        { ...result, ok: true as const },
        useAuthStore.getState().user,
        t,
        { hadProBeforePurchase },
      );
      Alert.alert(alertCopy.title, alertCopy.body);
    } finally {
      setBuying(false);
    }
  }, [buying, refreshUser, t, token]);

  if (!reason || hasPro) return null;

  return (
    <InvestorProUpsellModal
      visible={Boolean(reason)}
      reason={reason}
      priceLine={priceLine}
      isDark={isDark}
      buying={buying}
      onSubscribe={() => {
        InteractionManager.runAfterInteractions(() => {
          void handleSubscribe();
        });
      }}
      onLater={handleLater}
    />
  );
}
