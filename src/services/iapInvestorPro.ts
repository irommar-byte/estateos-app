import Constants from 'expo-constants';
import { InteractionManager } from 'react-native';
import { IAP_PRODUCT_IDS } from '../contracts/iapContract';
import { IAPManager, type IapProductId } from './iapManager';

const DEFAULT_PRODUCT_ID: IapProductId = IAP_PRODUCT_IDS.INVESTOR_PRO;
const STORE_SHEET_PRESENT_DELAY_MS = 320;

export function getInvestorProProductId(): IapProductId {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const id = extra?.iapInvestorProProductId;
  if (typeof id === 'string' && id.length > 0) {
    if (id === IAP_PRODUCT_IDS.PAKIET_PLUS_30D) {
      console.warn(
        '[IAP] iapInvestorProProductId wskazuje Pakiet Plus — używam domyślnej subskrypcji Investor Pro.',
      );
      return DEFAULT_PRODUCT_ID;
    }
    if (id === IAP_PRODUCT_IDS.INVESTOR_PRO || id === 'pl.estateos.app.pakiet_investor_pro') {
      return id as IapProductId;
    }
  }
  return DEFAULT_PRODUCT_ID;
}

export type PurchaseInvestorProResult =
  | {
      ok: true;
      backendRegistered: boolean;
      isPro?: boolean;
      proExpiresAt?: string | null;
      extraListings?: number;
      plusExpiresAt?: string | null;
      proCreditsGranted?: boolean;
      syncedExistingSubscription?: boolean;
      subscriptionTransferred?: boolean;
      transactionId?: string;
    }
  | { ok: false; cancelled?: boolean; message?: string; errorCode?: string };

/** Auto-renewable subscription — trial 3 dni konfiguruje się w App Store Connect. */
export async function purchaseInvestorProSubscription(
  _apiUrl: string,
  _token: string,
  options?: { allowSubscriptionTransfer?: boolean },
): Promise<PurchaseInvestorProResult> {
  const productId = getInvestorProProductId();
  const result = await IAPManager.purchaseSubscription(productId, {
    allowSubscriptionTransfer: options?.allowSubscriptionTransfer,
  });

  if (result.ok) {
    return {
      ok: true,
      backendRegistered: result.backendVerified,
      isPro: result.isPro,
      proExpiresAt: result.proExpiresAt,
      extraListings: result.extraListings,
      plusExpiresAt: result.plusExpiresAt,
      proCreditsGranted: result.proCreditsGranted,
      syncedExistingSubscription: result.syncedExistingSubscription,
      subscriptionTransferred: result.subscriptionTransferred,
      transactionId: result.transactionId,
    };
  }
  if (result.cancelled) {
    return { ok: false, cancelled: true };
  }
  return { ok: false, message: result.message, errorCode: result.errorCode };
}

/** Aktywna subskrypcja w App Store — sync / przeniesienie bez sheetu płatności. */
export async function claimInvestorProSubscription(options?: {
  allowSubscriptionTransfer?: boolean;
}): Promise<PurchaseInvestorProResult> {
  await IAPManager.retryPendingEntitlements();
  const result = await IAPManager.claimActiveInvestorProSubscription({
    allowSubscriptionTransfer: options?.allowSubscriptionTransfer,
  });

  if (result.ok) {
    return {
      ok: true,
      backendRegistered: result.backendVerified,
      isPro: result.isPro,
      proExpiresAt: result.proExpiresAt,
      extraListings: result.extraListings,
      plusExpiresAt: result.plusExpiresAt,
      proCreditsGranted: result.proCreditsGranted,
      syncedExistingSubscription: result.syncedExistingSubscription,
      subscriptionTransferred: result.subscriptionTransferred,
      transactionId: result.transactionId,
    };
  }
  if (result.cancelled) {
    return { ok: false, cancelled: true };
  }
  return { ok: false, message: result.message, errorCode: result.errorCode };
}

function isNoAppleSubMessage(message?: string): boolean {
  const text = String(message || '').trim();
  return (
    /nie ma aktywnej subskrypcji investor pro/i.test(text) ||
    /no active investor pro subscription/i.test(text) ||
    /нет активной подписки investor pro/i.test(text)
  );
}

/**
 * Przeniesienie subskrypcji Investor Pro na bieżące konto EstateOS.
 * Najpierw sync aktywnej subskrypcji z App Store; jeśli wygasła — ponowny zakup z flagą transferu.
 */
export async function transferInvestorProToCurrentAccount(
  apiUrl: string,
  token: string,
): Promise<PurchaseInvestorProResult> {
  await IAPManager.retryPendingEntitlements();
  const claim = await claimInvestorProSubscription({ allowSubscriptionTransfer: true });
  if (claim.ok) return claim;

  if (isNoAppleSubMessage(claim.message)) {
    return purchaseInvestorProSubscription(apiUrl, token, {
      allowSubscriptionTransfer: true,
    });
  }

  return claim;
}

export async function syncInvestorProEntitlement(options?: {
  allowSubscriptionTransfer?: boolean;
}): Promise<PurchaseInvestorProResult> {
  return claimInvestorProSubscription(options);
}

/**
 * natywny sheet subskrypcji App Store (StoreKit) bez konfliktu z Modal RN.
 */
export async function presentInvestorProSubscriptionSheet(
  apiUrl: string,
  token: string,
): Promise<PurchaseInvestorProResult> {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise((resolve) => setTimeout(resolve, STORE_SHEET_PRESENT_DELAY_MS));
  return purchaseInvestorProSubscription(apiUrl, token);
}

/** @deprecated Użyj purchaseInvestorProSubscription */
export const purchaseInvestorProConsumable = purchaseInvestorProSubscription;

export async function restoreInvestorProPurchases(): Promise<{
  ok: boolean;
  restored: number;
  message?: string;
}> {
  return IAPManager.restorePurchases();
}
