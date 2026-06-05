import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import InvestorProTrialIntroModal from './InvestorProTrialIntroModal';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/useAuthStore';
import { hasActiveInvestorProMembership } from '../../utils/investorProMembership';
import { fetchInvestorProStoreListing } from '../../services/iapInvestorProListing';
import type { SubscriptionStoreListing } from '../../services/iapManager';

const STORAGE_KEY = '@estateos:investorProTrialIntroShown:v1';
const SHOW_DELAY_MS = 2200;
/** Krótka przerwa po zamknięciu panelu przed sheetem App Store (bez RN Modal). */
const SHEET_HANDOFF_MS = 280;

type Props = {
  /** Tylko na aktywnej zakładce Profil — nie pokazuj na innych ekranach. */
  enabled?: boolean;
  isDark?: boolean;
  /** Ten sam flow co „Wypróbuj 3 dni” w sekcji sklepu profilu. */
  onPurchase: () => Promise<void>;
};

export default function InvestorProTrialIntroHost({
  enabled = true,
  isDark = false,
  onPurchase,
}: Props) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

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
    if (!enabled || !token || !user?.id || hasPro) {
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
  }, [enabled, token, user?.id, hasPro]);

  const handleSubscribe = useCallback(async () => {
    if (buying) return;
    setBuying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    try {
      await new Promise((resolve) => setTimeout(resolve, SHEET_HANDOFF_MS));
      await onPurchase();
    } finally {
      setBuying(false);
    }
  }, [buying, onPurchase]);

  if (hasPro || (!visible && !buying)) return null;

  return (
    <InvestorProTrialIntroModal
      visible={visible}
      priceLine={priceLine}
      isDark={isDark}
      buying={buying}
      onSubscribe={() => {
        void handleSubscribe();
      }}
      onLater={() => {
        void dismiss();
      }}
    />
  );
}
