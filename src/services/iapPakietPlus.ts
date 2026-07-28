/**
 * Pakiet Plus — wrapper na `IAPManager` zachowujący ZWROTNĄ kompatybilność
 * z istniejącym wywołaniem w `Step6_Summary.tsx`.
 *
 * Cały „mózg" IAP siedzi teraz w `IAPManager` (singleton): connection
 * lifecycle, globalne listenery, persistence pending receipts, retry
 * backendu, finish-transaction po backend-verify. Ten plik tylko
 * udostępnia ergonomiczne API dla konkretnego produktu.
 */

import Constants from 'expo-constants';
import { IAP_PRODUCT_IDS } from '../contracts/iapContract';
import {
  IAPManager,
  type IapProductId,
  type PurchaseConsumableOptions,
  type RestorePurchasesResult,
  type StoreProductListing,
} from './iapManager';

const DEFAULT_PRODUCT_ID: IapProductId = IAP_PRODUCT_IDS.PAKIET_PLUS_30D;

export function getPakietPlusProductId(): IapProductId {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const id = extra?.iapPakietPlusProductId;
  if (typeof id === 'string' && id.length > 0) {
    if (id === IAP_PRODUCT_IDS.INVESTOR_PRO || id === 'pl.estateos.app.pakiet_investor_pro') {
      console.warn('[IAP] iapPakietPlusProductId wskazuje Investor Pro — używam domyślnego Pakietu Plus.');
    } else if ((Object.values(IAP_PRODUCT_IDS) as string[]).includes(id)) {
      return id as IapProductId;
    }
  }
  return DEFAULT_PRODUCT_ID;
}

/** Fallback marketingowy — UI preferuje cenę ze StoreKit (`fetchPakietPlusStoreListing`). */
export const PAKIET_PLUS_PRICE_LABEL = '49 zł';

export async function fetchPakietPlusStoreListing(): Promise<StoreProductListing | null> {
  return IAPManager.getProductListing(getPakietPlusProductId(), 'in-app');
}

export type PurchasePakietPlusResult =
  | {
      ok: true;
      backendRegistered: boolean;
      extraListings?: number;
      transactionId?: string;
      deferPublicationConsume?: boolean;
      publicationConsumeDeferred?: boolean;
    }
  | { ok: false; cancelled?: boolean; message?: string };

/**
 * Uruchamia natywny sheet App Store / Google Play dla consumable Pakiet
 * Plus: jedna dodatkowa nowa oferta na 30 dni. To nie jest subskrypcja,
 * plan konta ani przedłużenie istniejącego ogłoszenia.
 *
 * NOTE: parametry `apiUrl` / `token` są nadal w sygnaturze dla
 * kompatybilności z istniejącym kodem, ALE w runtime używany jest
 * `IAPManager` zainicjalizowany w `App.tsx` (token bierze przez
 * `getToken` callback, więc jest zawsze świeży nawet po relogin).
 */
export async function purchasePakietPlusConsumable(
  _apiUrl: string,
  _token: string,
  options?: PurchaseConsumableOptions & { targetOfferId?: number },
): Promise<PurchasePakietPlusResult> {
  const productId = getPakietPlusProductId();
  const result = await IAPManager.purchaseConsumable(productId, options);

  if (result.ok) {
    return {
      ok: true,
      backendRegistered: result.backendVerified,
      extraListings: result.extraListings,
      transactionId: result.transactionId,
      deferPublicationConsume: result.deferPublicationConsume,
      publicationConsumeDeferred: result.publicationConsumeDeferred,
    };
  }
  if (result.cancelled) {
    return { ok: false, cancelled: true };
  }
  return { ok: false, message: result.message };
}

/**
 * Przywróć zakupy (App Store Review Guideline 3.1.1).
 * Wystawiamy jako reusowalny helper dla Profile screen.
 */
export async function restorePakietPlusPurchases(): Promise<RestorePurchasesResult> {
  return IAPManager.restorePurchases();
}
