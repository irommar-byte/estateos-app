import type { PurchaseInvestorProResult } from '../services/iapInvestorPro';
import { hasActiveInvestorProMembership } from './investorProMembership';
import { Alert } from 'react-native';

type TFn = (key: string, params?: Record<string, unknown>) => string;

const SUBSCRIPTION_OTHER_ACCOUNT = 'SUBSCRIPTION_LINKED_TO_OTHER_ACCOUNT';

export function isNoAppleInvestorProSubscriptionMessage(message?: string): boolean {
  const text = String(message || '').trim();
  return (
    /nie ma aktywnej subskrypcji investor pro/i.test(text) ||
    /no active investor pro subscription/i.test(text) ||
    /нет активной подписки investor pro/i.test(text)
  );
}

export function investorProSubscriptionNeedsTransfer(errorCode?: string, message?: string): boolean {
  const code = String(errorCode || '').trim().toUpperCase();
  const text = String(message || '').trim();
  return (
    code === SUBSCRIPTION_OTHER_ACCOUNT ||
    /innego konta estateos/i.test(text) ||
    /przypisan[aą].*innego konta/i.test(text) ||
    /already assigned to another estateos/i.test(text) ||
    /linked to another estateos/i.test(text)
  );
}

export function investorProPurchaseErrorAlertCopy(
  t: TFn,
  opts?: { errorCode?: string; message?: string; alreadyHasEstateOsPro?: boolean },
): { title: string; body: string } {
  const code = String(opts?.errorCode || '').trim().toUpperCase();
  const message = String(opts?.message || '').trim();
  if (
    code === SUBSCRIPTION_OTHER_ACCOUNT ||
    /przypisana do innego konta estateos/i.test(message) ||
    /already assigned to another estateos/i.test(message) ||
    /innego konta estateos/i.test(message)
  ) {
    return {
      title: t('profile.shop.alerts.investorProOtherAccountTitle'),
      body: t('profile.shop.alerts.investorProOtherAccountBody'),
    };
  }
  if (isNoAppleInvestorProSubscriptionMessage(message)) {
    if (opts?.alreadyHasEstateOsPro) {
      return {
        title: t('profile.shop.alerts.investorProAlreadyActiveTitle'),
        body: t('profile.shop.alerts.investorProRestoreNoAppleSubBody'),
      };
    }
    return {
      title: t('profile.shop.alerts.investorProSyncAppStoreTitle'),
      body: message || t('profile.shop.alerts.investorProNoAppleSubBody'),
    };
  }
  return {
    title: t('profile.shop.alerts.investorProPurchaseTitle'),
    body: message || t('profile.shop.alerts.purchaseFailed'),
  };
}

export function promptInvestorProTransferAlert(t: TFn, onTransfer: () => void): void {
  Alert.alert(
    t('profile.shop.alerts.investorProTransferConfirmTitle'),
    t('profile.shop.alerts.investorProTransferConfirmBody'),
    [
      { text: t('profile.shop.alerts.investorProTransferCancel'), style: 'cancel' },
      { text: t('profile.shop.alerts.investorProTransferConfirmCta'), onPress: onTransfer },
    ],
  );
}

export function investorProPurchaseAlertCopy(
  result: Extract<PurchaseInvestorProResult, { ok: true }>,
  user: Record<string, unknown> | null | undefined,
  t: TFn,
  opts?: { hadProBeforePurchase?: boolean },
): { title: string; body: string } {
  if (result.subscriptionTransferred) {
    return {
      title: t('profile.shop.alerts.investorProTransferredTitle'),
      body: t('profile.shop.alerts.investorProTransferredBody'),
    };
  }

  if (result.syncedExistingSubscription) {
    if (opts?.hadProBeforePurchase) {
      return {
        title: t('profile.shop.alerts.investorProAlreadyActiveTitle'),
        body: t('profile.shop.alerts.investorProAlreadyActiveBody'),
      };
    }
    return {
      title: t('profile.shop.alerts.investorProLinkedTitle'),
      body: t('profile.shop.alerts.investorProLinkedBody'),
    };
  }

  if (!hasActiveInvestorProMembership(user) && !result.isPro) {
    return {
      title: t('profile.shop.alerts.investorProActiveTitle'),
      body: t('profile.shop.alerts.investorProActivePending'),
    };
  }

  if (result.proCreditsGranted) {
    return {
      title: t('profile.shop.alerts.investorProActiveTitle'),
      body: t('profile.shop.alerts.investorProActiveBodyWithCredits'),
    };
  }

  return {
    title: t('profile.shop.alerts.investorProActiveTitle'),
    body: t('profile.shop.alerts.investorProActiveBody'),
  };
}
