import React, { useCallback, useEffect, useState } from 'react';
import { Alert, InteractionManager, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import InvestorProTrialIntroModal from './InvestorProTrialIntroModal';
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

const STORAGE_KEY = '@estateos:investorProTrialIntroShown:v1';
const SHOW_DELAY_MS = 2200;

export default function InvestorProTrialIntroHost() {
  const { t } = useI18n();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [visible, setVisible] = useState(false);
  const [listing, setListing] = useState<SubscriptionStoreListing | null>(null);
  const [buying, setBuying] = useState(false);

  const hasPro = hasActiveInvestorProMembership(user);

  const priceLine =
    listing?.priceLabel != null
      ? t('profile.shop.investorProTrialPriceAfter', { price: listing.priceLabel })
      : t('profile.shop.investorProTrialPriceFallback');

  const dismiss = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  }, []);

  useEffect(() => {
    if (!token || !user?.id || hasPro) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      const shown = await AsyncStorage.getItem(STORAGE_KEY);
      if (cancelled || shown) return;

      const storeListing = await fetchInvestorProStoreListing();
      if (cancelled) return;
      setListing(storeListing);

      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, SHOW_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, user?.id, hasPro]);

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
    setVisible(false);
    void AsyncStorage.setItem(STORAGE_KEY, '1');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hadProBeforePurchase = hasActiveInvestorProMembership(user);
    try {
      const result = await presentInvestorProSubscriptionSheet(API_URL, token);
      if (!result.ok) {
        if (result.cancelled) return;
        const alertCopy = investorProPurchaseErrorAlertCopy(t, {
          errorCode: result.errorCode,
          message: result.message,
          alreadyHasEstateOsPro: hasActiveInvestorProMembership(useAuthStore.getState().user),
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
        patched ?? useAuthStore.getState().user,
        t,
        { hadProBeforePurchase },
      );
      Alert.alert(alertCopy.title, alertCopy.body);
    } finally {
      setBuying(false);
    }
  }, [buying, refreshUser, t, token]);

  if ((!visible && !buying) || hasPro) return null;

  return (
    <InvestorProTrialIntroModal
      visible={visible}
      priceLine={priceLine}
      isDark={isDark}
      buying={buying}
      onSubscribe={() => {
        InteractionManager.runAfterInteractions(() => {
          void handleSubscribe();
        });
      }}
      onLater={() => {
        void dismiss();
      }}
    />
  );
}
