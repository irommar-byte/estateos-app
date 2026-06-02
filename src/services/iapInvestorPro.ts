import Constants from 'expo-constants';
import { IAP_PRODUCT_IDS } from '../contracts/iapContract';
import { IAPManager, type IapProductId } from './iapManager';

const DEFAULT_PRODUCT_ID: IapProductId = IAP_PRODUCT_IDS.INVESTOR_PRO;

export function getInvestorProProductId(): IapProductId {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const id = extra?.iapInvestorProProductId;
  if (typeof id === 'string' && id.length > 0) {
    if ((Object.values(IAP_PRODUCT_IDS) as string[]).includes(id)) {
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
      transactionId?: string;
    }
  | { ok: false; cancelled?: boolean; message?: string };

export async function purchaseInvestorProConsumable(
  _apiUrl: string,
  _token: string,
): Promise<PurchaseInvestorProResult> {
  const productId = getInvestorProProductId();
  const result = await IAPManager.purchaseConsumable(productId);

  if (result.ok) {
    return {
      ok: true,
      backendRegistered: result.backendVerified,
      isPro: result.isPro,
      proExpiresAt: result.proExpiresAt,
      transactionId: result.transactionId,
    };
  }
  if (result.cancelled) {
    return { ok: false, cancelled: true };
  }
  return { ok: false, message: result.message };
}

export async function restoreInvestorProPurchases(): Promise<{
  ok: boolean;
  restored: number;
  message?: string;
}> {
  return IAPManager.restorePurchases();
}
