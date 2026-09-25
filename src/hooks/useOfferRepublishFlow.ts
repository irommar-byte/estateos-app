import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../config/network';
import type { CreatePublicationRedemption } from '../contracts/offerPublicationContract';
import type { PublicationChoiceConfirm } from '../components/publication/PublicationChoiceModal';
import { gatherPublicationBonusCoupons } from '../services/publicationBonusCoupons';
import { purchasePakietPlusConsumable, PAKIET_PLUS_PRICE_LABEL } from '../services/iapPakietPlus';
import {
  activateOfferPublication,
  decideReactivationFromQuote,
  fetchPublicationQuote,
  getPublicationCopy,
  isPublicationRequiresPlusError,
} from '../services/offerPublicationService';
import { useAuthStore } from '../store/useAuthStore';
import {
  getAdditionalListingSlots,
  hasAdditionalPlusPublication,
} from '../utils/listingQuota';
import { readUserFirstFreePublicationUsed } from '../utils/userPublicationFlags';
import { markProfilePromoCouponUsed } from '../services/profilePromoService';
import { useI18n } from '../i18n';

type Args = {
  /** Po udanym wystawieniu — odśwież ofertę / zdejmij zaślepkę. */
  onActivated?: (endsAt: string) => void | Promise<void>;
};

/**
 * Wspólny flow „Wystaw ponownie na rynek” — z zaślepki OfferDetail albo z Moje ogłoszenia.
 */
export function useOfferRepublishFlow({ onActivated }: Args = {}) {
  const { t, locale } = useI18n();
  const publicationCopy = useMemo(() => getPublicationCopy(), [locale]);
  const { user, token, refreshUser } = useAuthStore() as any;

  const [reactivating, setReactivating] = useState(false);
  const [choiceVisible, setChoiceVisible] = useState(false);
  const [choiceLoading, setChoiceLoading] = useState(false);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [plusSlots, setPlusSlots] = useState(0);
  const [hasPlusCredit, setHasPlusCredit] = useState(false);
  const pendingRef = useRef<{ offerId: number; offerTitle: string } | null>(null);

  const dismissChoice = useCallback(() => {
    setChoiceVisible(false);
    setChoiceLoading(false);
    pendingRef.current = null;
  }, []);

  const activate = useCallback(
    async (
      offerId: number,
      offerTitle: string,
      opts?: { redemption?: CreatePublicationRedemption | null },
    ) => {
      if (!token || reactivating) return;
      setReactivating(true);
      try {
        const res = await activateOfferPublication(API_URL, token, offerId, {
          redemption: opts?.redemption ?? null,
        });
        if (!res.ok) {
          if (res.status === 422 && isPublicationRequiresPlusError(res.body)) {
            const latestUser = useAuthStore.getState().user ?? user;
            const gathered = await gatherPublicationBonusCoupons({
              apiUrl: API_URL,
              token,
              userId: user?.id,
              email: latestUser?.email,
              firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
              t,
            });
            pendingRef.current = { offerId, offerTitle };
            setCoupons(gathered.coupons);
            setPlusSlots(getAdditionalListingSlots(latestUser));
            setHasPlusCredit(hasAdditionalPlusPublication(latestUser));
            setChoiceVisible(true);
            return;
          }
          throw new Error(
            res.body?.message ||
              res.body?.error ||
              t('profile.myOffers.alerts.activationRejected', { status: res.status }),
          );
        }

        const endsAt =
          typeof res.body?.publication?.endsAt === 'string'
            ? res.body.publication.endsAt
            : null;
        if (res.body?.awaitingModeration || !endsAt) {
          throw new Error(
            'Publikacja nie została przedłużona. Spróbuj „Wystaw ponownie” jeszcze raz — kredyt nie powinien zostać pobrany drugi raz.',
          );
        }

        if (opts?.redemption?.source === 'bonus_coupon' && user?.id) {
          await markProfilePromoCouponUsed(user.id, opts.redemption.couponId, token);
        }
        await refreshUser?.();
        await onActivated?.(endsAt);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('profile.myOffers.alerts.onMarketTitle'),
          t('profile.myOffers.alerts.onMarketBody', { title: offerTitle }),
        );
      } catch (e: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t('profile.myOffers.alerts.publishFailedTitle'),
          e?.message || t('profile.myOffers.alerts.publishFailedBody'),
        );
      } finally {
        setReactivating(false);
      }
    },
    [token, reactivating, user, t, refreshUser, onActivated],
  );

  const openChoice = useCallback(
    async (offerId: number, offerTitle: string) => {
      if (reactivating || choiceLoading) return;
      if (!token || !user?.id) {
        Alert.alert(
          t('profile.myOffers.alerts.publishFailedTitle'),
          t('profile.myOffers.alerts.publishFailedBody'),
        );
        return;
      }
      setChoiceLoading(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const quoteRes = await fetchPublicationQuote(API_URL, token, offerId);
        const decision = decideReactivationFromQuote(quoteRes);
        if (decision.action === 'block') {
          Alert.alert(decision.title, decision.message);
          return;
        }

        const latestUser = useAuthStore.getState().user ?? user;
        const gathered = await gatherPublicationBonusCoupons({
          apiUrl: API_URL,
          token,
          userId: user.id,
          email: latestUser?.email,
          firstFreePublicationUsed: readUserFirstFreePublicationUsed(latestUser),
          t,
        });
        const plusCredit = hasAdditionalPlusPublication(latestUser);
        const hasCoupons = gathered.coupons.length > 0;

        if (decision.action === 'activate_free' && !hasCoupons && !plusCredit) {
          await activate(offerId, offerTitle, {});
          return;
        }

        pendingRef.current = { offerId, offerTitle };
        setCoupons(gathered.coupons);
        setPlusSlots(getAdditionalListingSlots(latestUser));
        setHasPlusCredit(plusCredit);
        setChoiceVisible(true);
      } catch (e: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t('profile.myOffers.alerts.publishFailedTitle'),
          e?.message || t('profile.myOffers.alerts.publishFailedBody'),
        );
      } finally {
        setChoiceLoading(false);
      }
    },
    [token, user, reactivating, choiceLoading, t, activate],
  );

  const onConfirmChoice = useCallback(
    (result: PublicationChoiceConfirm) => {
      const pending = pendingRef.current;
      dismissChoice();
      if (!pending || result.action === 'cancel') return;

      if (result.action === 'buy_plus') {
        void (async () => {
          const r = await purchasePakietPlusConsumable(API_URL, token, {
            deferPublicationConsume: true,
            targetOfferId: pending.offerId,
          });
          if (!r.ok) {
            if (r.cancelled) return;
            if (r.message) Alert.alert(t('profile.myOffers.alerts.storeTitle'), r.message);
            return;
          }
          const tx = r.transactionId ?? '';
          if (!tx) {
            Alert.alert(t('profile.myOffers.alerts.plusTitle'), publicationCopy.restoreHint);
            return;
          }
          await activate(pending.offerId, pending.offerTitle, {
            redemption: { source: 'plus_iap', transactionId: tx },
          });
        })();
        return;
      }

      void activate(pending.offerId, pending.offerTitle, {
        redemption: result.redemption,
      });
    },
    [dismissChoice, token, t, publicationCopy.restoreHint, activate],
  );

  return {
    busy: reactivating || choiceLoading,
    choiceVisible,
    coupons,
    plusSlots,
    hasPlusCredit,
    publicationCopy,
    plusPriceLabel: PAKIET_PLUS_PRICE_LABEL,
    openChoice,
    onConfirmChoice,
    dismissChoice,
  };
}
