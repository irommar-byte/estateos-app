/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  EstateOS™ — IAP Manager (singleton)                                 ║
 * ║  Globalny runtime In-App Purchase. Inicjalizowany RAZ na starcie    ║
 * ║  aplikacji w `App.tsx`. Zarządza całym cyklem życia transakcji      ║
 * ║  StoreKit / Google Play Billing — od momentu uruchomienia aplikacji ║
 * ║  do `finishTransaction`.                                              ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                       ║
 * ║  Dlaczego SINGLETON, a nie wywoływanie `initConnection()` przy każdym║
 * ║  zakupie? Wymagania Apple Review:                                    ║
 * ║                                                                       ║
 * ║  ① Aplikacja musi mieć ZAREJESTROWANE listenery od momentu startu,   ║
 * ║     bo system może doręczyć transakcję ASYNCHRONICZNIE — np. po      ║
 * ║     family-share, po deferred payment (Ask to Buy), po crashu         ║
 * ║     aplikacji w trakcie zakupu, po restore.                          ║
 * ║                                                                       ║
 * ║  ② Pending transactions z poprzedniej sesji muszą zostać DRENOWANE   ║
 * ║     przy boot — inaczej pieniądze są pobrane, a dodatkowa publikacja ║
 * ║     nie zostanie naliczona.                                          ║
 * ║                                                                       ║
 * ║  ③ Retry backend notification z exponential backoff: jak backend     ║
 * ║     nie odpowie (network, 5xx), transakcja jest CACHOWANA lokalnie  ║
 * ║     w AsyncStorage i ponawiamy aż się uda. Apple nie zamyka          ║
 * ║     transakcji bo NIE wywołujemy `finishTransaction` aż do           ║
 * ║     potwierdzenia backendu.                                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  IAP_ENDPOINTS,
  IAP_INVESTOR_PRO_LEGACY_ID,
  IAP_INVESTOR_PRO_STORE_SKUS,
  IAP_PRODUCT_IDS,
  isInvestorProStoreSku,
  type IapProductId,
  type IapVerifyRequest,
  type IapVerifyResponse,
} from '../contracts/iapContract';

// ---------------------------------------------------------------------------
//  TYPY POMOCNICZE
// ---------------------------------------------------------------------------

type IapModule = typeof import('react-native-iap');
type IapPurchase = import('react-native-iap').Purchase;

type TokenProvider = () => string | null | undefined;

export type IapInitOptions = {
  /** Bazowy URL backendu, np. `https://estateos.pl`. */
  apiUrl: string;
  /**
   * Funkcja zwracająca aktualny token uwierzytelnienia użytkownika.
   * Wywoływana za każdym razem, gdy chcemy zgłosić zakup do backendu —
   * to musi być funkcja (a nie statyczna wartość), bo użytkownik może
   * zalogować/wylogować się między startem aplikacji a kupnem.
   */
  getToken: TokenProvider;
};

export type PurchaseConsumableOptions = {
  /**
   * Zakup pod publikację: verify z Apple, consume przy aktywacji oferty
   * (`POST /offers` lub `POST /offers/{id}/activate`).
   */
  deferPublicationConsume?: boolean;
  /** Opcjonalnie — reaktywacja konkretnego ogłoszenia. */
  targetOfferId?: number;
  /** Jawna zgoda: przenieś subskrypcję Apple z innego konta EstateOS na bieżące. */
  allowSubscriptionTransfer?: boolean;
};

export type SubscriptionStoreListing = {
  productId: IapProductId;
  priceLabel: string | null;
  hasFreeTrial: boolean;
  trialDays: number | null;
  trialLabel: string | null;
};

export type RestorePurchasesResult = {
  ok: boolean;
  restored: number;
  message?: string;
  /** Aktywna subskrypcja Apple jest przypisana do innego konta EstateOS. */
  subscriptionConflict?: boolean;
  errorCode?: string;
};

function readStringField(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parseSubscriptionStoreListing(
  productId: IapProductId,
  raw: Record<string, unknown>,
): SubscriptionStoreListing {
  const priceLabel =
    readStringField(raw, 'displayPrice', 'localizedPrice', 'priceString') ??
    (typeof raw.price === 'number' && raw.currency
      ? `${raw.price} ${String(raw.currency)}`
      : null);

  const subscriptionOffersRaw = raw.subscriptionOfferDetails;
  const subscriptionOffers =
    subscriptionOffersRaw && typeof subscriptionOffersRaw === 'object'
      ? subscriptionOffersRaw
      : null;
  const introDetails =
    subscriptionOffers && !Array.isArray(subscriptionOffers)
      ? (subscriptionOffers as Record<string, unknown>)
      : null;

  const introMode = String(
    raw.introductoryPricePaymentModeIOS ??
      raw.introductoryPricePaymentMode ??
      introDetails?.introductoryPricePaymentMode ??
      '',
  ).toLowerCase();

  const introPeriods = Number(
    raw.introductoryPriceNumberOfPeriodsIOS ??
      raw.introductoryPriceNumberOfPeriods ??
      introDetails?.introductoryPriceNumberOfPeriods ??
      0,
  );

  const introUnit = String(
    raw.introductoryPriceSubscriptionPeriodIOS ??
      raw.introductoryPriceSubscriptionPeriod ??
      introDetails?.introductoryPriceSubscriptionPeriod ??
      '',
  ).toLowerCase();

  const androidOffers = Array.isArray(subscriptionOffersRaw) ? subscriptionOffersRaw : [];
  const androidOffersLegacy = Array.isArray(raw.subscriptionOfferDetailsAndroid)
    ? raw.subscriptionOfferDetailsAndroid
    : [];
  const androidFreeTrial = [...androidOffers, ...androidOffersLegacy].some((offer) => {
    const o = offer as Record<string, unknown>;
    return String(o.offerTags || o.pricingPhases || '')
      .toLowerCase()
      .includes('free');
  });

  const hasFreeTrial =
    androidFreeTrial ||
    introMode.includes('freetrial') ||
    introMode.includes('free_trial') ||
    introMode === 'free';

  let trialDays: number | null = null;
  if (hasFreeTrial && introPeriods > 0) {
    if (introUnit.includes('day')) trialDays = introPeriods;
    else if (introUnit.includes('week')) trialDays = introPeriods * 7;
    else if (introUnit.includes('month')) trialDays = introPeriods * 30;
    else trialDays = introPeriods;
  }
  if (hasFreeTrial && !trialDays) trialDays = 3;

  const trialLabel = hasFreeTrial
    ? trialDays
      ? `${trialDays} ${trialDays === 1 ? 'dzień' : 'dni'}`
      : '3 dni'
    : null;

  return {
    productId,
    priceLabel,
    hasFreeTrial,
    trialDays,
    trialLabel,
  };
}

export type IapPurchaseResult =
  | {
      ok: true;
      productId: IapProductId;
      transactionId: string;
      /** Czy backend potwierdził weryfikację (true) czy jeszcze pending (false). */
      backendVerified: boolean;
      /** Liczba dodatkowych publikacji po zaksięgowaniu (jeśli backend zwrócił). */
      extraListings?: number;
      isPro?: boolean;
      proExpiresAt?: string | null;
      plusExpiresAt?: string | null;
      proCreditsGranted?: boolean;
      /** Apple ID ma już aktywną subskrypcję — zsynchronizowano bez nowego sheetu. */
      syncedExistingSubscription?: boolean;
      /** Subskrypcja przeniesiona z innego konta EstateOS na bieżące logowanie. */
      subscriptionTransferred?: boolean;
      /** Żądano odłożonego zużycia slotu (nie bumpuj extraListings w UI przed publish). */
      deferPublicationConsume?: boolean;
      publicationConsumeDeferred?: boolean;
    }
  | { ok: false; cancelled: true; message?: string }
  | { ok: false; cancelled?: false; message: string; errorCode?: string };

// ---------------------------------------------------------------------------
//  STAŁE
// ---------------------------------------------------------------------------

const PENDING_RECEIPTS_KEY = '@estateos:iap:pendingReceipts';
const PURCHASE_TIMEOUT_MS = 90_000; // App Store sheet zwykle < 60 s; bufor

type PendingReceipt = {
  /** Klucz idempotencyjny — transactionId lub purchaseToken. */
  key: string;
  /** Payload do `POST /iap/verify`. */
  payload: IapVerifyRequest;
  /** Surowy Purchase z react-native-iap (do `finishTransaction` po backend OK). */
  raw: IapPurchase;
  /** Ile razy próbowaliśmy zgłosić do backendu. */
  attempts: number;
  /** Timestamp ostatniej próby. */
  lastTry: number;
};

// ---------------------------------------------------------------------------
//  KLASA MANAGERA
// ---------------------------------------------------------------------------

class IAPManagerImpl {
  private iap: IapModule | null = null;
  private initialized = false;
  private connecting: Promise<boolean> | null = null;
  private apiUrl = '';
  private getToken: TokenProvider = () => null;
  private appStateSub: { remove: () => void } | null = null;
  private purchaseUpdateSub: { remove: () => void } | null = null;
  private purchaseErrorSub: { remove: () => void } | null = null;
  private activePurchaseOptions: PurchaseConsumableOptions | null = null;
  /** Kontekst bieżącego zakupu — do mapowania błędów StoreKit bez productId. */
  private activePurchaseContext: {
    productId: IapProductId;
    storeType: 'in-app' | 'subs';
    skus: string[];
  } | null = null;
  /** Listener'y czekające na konkretną transakcję (np. Step6 podczas zakupu). */
  private waiters = new Map<string, (r: IapPurchaseResult) => void>();

  // -------------------------------------------------------------------------
  //  PUBLIC API
  // -------------------------------------------------------------------------

  /**
   * Inicjalizuje IAP runtime. Wywołaj RAZ w `App.tsx` po starcie aplikacji
   * (po hydratacji auth store, żebyśmy mieli `getToken`). Bezpieczne do
   * wielokrotnego wywołania — kolejne call'e są no-opem.
   */
  async init(opts: IapInitOptions): Promise<boolean> {
    this.apiUrl = opts.apiUrl.replace(/\/$/, '');
    this.getToken = opts.getToken;

    if (this.initialized) return true;

    const iap = this.loadModule();
    if (!iap) {
      if (__DEV__) {
        console.log('[IAP] react-native-iap niedostępne (Expo Go / brak natywnego buildu).');
      }
      return false;
    }
    this.iap = iap;

    const connected = await this.ensureConnected();
    if (!connected) return false;

    // Globalne listenery — od teraz każda transakcja (też deferred /
    // family-share / restore) trafia do `handleIncoming`.
    this.purchaseUpdateSub = iap.purchaseUpdatedListener((p) => {
      void this.handleIncomingPurchase(p);
    });
    this.purchaseErrorSub = iap.purchaseErrorListener((err) => {
      if (__DEV__) console.log('[IAP] purchaseErrorListener:', err);
      if (this.isCancelled(err)) {
        this.resolveWaiterForError(err, true);
        return;
      }
      if (this.isDuplicatePurchaseError(err)) {
        void this.recoverDuplicatePurchase(err);
        return;
      }
      this.resolveWaiterForError(err);
    });

    // Foreground rehydration: gdy aplikacja wraca z background, próbujemy
    // dorzucić niedokończone transakcje (np. user kupił, zamknął appkę
    // zanim backend potwierdził).
    this.appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void this.drainPending();
    });

    // Drenuj wszystko co czeka z poprzednich sesji.
    await this.drainPending();
    await this.syncActiveInvestorProSubscriptions({ silent: true });
    // Rozgrzewka katalogu — Plus + Investor Pro, żeby pierwszy tap nie trafiał w zimny StoreKit.
    void this.prefetchStoreCatalog();

    this.initialized = true;
    if (__DEV__) console.log('[IAP] init OK');
    return true;
  }

  /** Ciche pobranie SKU — zmniejsza „product unavailable” przy pierwszym tapnięciu. */
  private async prefetchStoreCatalog(): Promise<void> {
    if (!this.iap) return;
    try {
      await this.fetchProductsForPurchase(
        this.iap,
        [IAP_PRODUCT_IDS.PAKIET_PLUS_30D],
        'in-app',
      );
      await this.fetchProductsForPurchase(
        this.iap,
        this.storeSkusForPurchase(IAP_PRODUCT_IDS.INVESTOR_PRO, 'subs'),
        'subs',
      );
    } catch (e) {
      if (__DEV__) console.log('[IAP] prefetchStoreCatalog soft-fail:', e);
    }
  }

  /**
   * Wykonuje natywny zakup consumable. Wynik dochodzi przez globalny
   * `purchaseUpdatedListener` → `handleIncomingPurchase` → resolver waitera.
   */
  async purchaseConsumable(
    productId: IapProductId,
    options?: PurchaseConsumableOptions,
  ): Promise<IapPurchaseResult> {
    this.activePurchaseOptions = options ?? null;
    try {
      return await this.purchaseInner(productId, 'in-app');
    } finally {
      this.activePurchaseOptions = null;
      this.activePurchaseContext = null;
    }
  }

  /** Auto-renewable subscription (Investor Pro). Trial/offers są w App Store Connect. */
  async purchaseSubscription(
    productId: IapProductId,
    options?: PurchaseConsumableOptions,
  ): Promise<IapPurchaseResult> {
    this.activePurchaseOptions = options ?? null;
    try {
      const ready = await this.ensurePurchaseReady();
      if (!ready.ok) return ready.result;
      return await this.purchaseInner(productId, 'subs');
    } finally {
      this.activePurchaseOptions = null;
      this.activePurchaseContext = null;
    }
  }

  /**
   * Synchronizuje aktywną subskrypcję Investor Pro z App Store (bez sheetu płatności).
   * Używane po jawnej zgodzie użytkownika na przeniesienie subskrypcji między kontami EstateOS.
   */
  async claimActiveInvestorProSubscription(
    options?: PurchaseConsumableOptions,
  ): Promise<IapPurchaseResult> {
    this.activePurchaseOptions = options ?? null;
    try {
      const ready = await this.ensurePurchaseReady();
      if (!ready.ok) return ready.result;

      const verifyPayload = async (
        payload: IapVerifyRequest,
        purchase?: IapPurchase,
      ): Promise<IapPurchaseResult | null> => {
        const key = this.idempotencyKey(payload);
        if (purchase) {
          await this.savePending({ key, payload, raw: purchase, attempts: 0, lastTry: 0 });
        }
        const verifyResult = await this.verifyOnBackend(payload, key);
        const tx = this.transactionIdOf(payload);

        if (verifyResult?.success) {
          if (verifyResult.verified && purchase) {
            try {
              await this.iap!.finishTransaction({
                purchase,
                isConsumable: false,
              });
            } catch (e) {
              if (__DEV__) console.log('[IAP] finishTransaction (claim) failed:', e);
            }
            await this.removePending(key);
          }
          return this.resultFromInvestorProVerify(verifyResult, payload.productId, tx, true);
        }

        if (verifyResult && verifyResult.success === false) {
          const errorCode = String(
            (verifyResult as { errorCode?: string; code?: string }).errorCode ??
              (verifyResult as { code?: string }).code ??
              '',
          ).trim() || undefined;
          return { ok: false, message: verifyResult.message, errorCode };
        }

        if (purchase) {
          return {
            ok: true,
            productId: payload.productId,
            transactionId: tx,
            backendVerified: false,
            syncedExistingSubscription: true,
          };
        }

        return null;
      };

      const buildPayloadFromSub = (sub: Record<string, unknown>): IapVerifyRequest | null => {
        const productId = String(sub.productId || '');
        if (!this.isInvestorProProductId(productId)) return null;
        const jws = sub.purchaseToken ? String(sub.purchaseToken) : '';
        const tx = sub.transactionId ? String(sub.transactionId) : '';
        if (!jws || !tx) return null;
        return {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          productId: productId as IapProductId,
          transactionId: tx,
          originalTransactionId:
            (sub as { originalTransactionIdentifierIOS?: string }).originalTransactionIdentifierIOS ??
            (sub as { originalTransactionId?: string }).originalTransactionId ??
            undefined,
          jwsRepresentation: jws,
          receipt: jws,
          receiptData: jws,
          pendingPurchaseId: `${Platform.OS}:${tx}`,
          ...(options?.allowSubscriptionTransfer ? { allowSubscriptionTransfer: true } : {}),
        };
      };

      if (this.iap && typeof this.iap.getActiveSubscriptions === 'function') {
        const activeSubs = await this.iap.getActiveSubscriptions([
          IAP_PRODUCT_IDS.INVESTOR_PRO,
          'pl.estateos.app.pakiet_investor_pro',
        ]);
        for (const sub of activeSubs || []) {
          if (sub?.isActive === false) continue;
          const payload = buildPayloadFromSub(sub as Record<string, unknown>);
          if (!payload) continue;
          const result = await verifyPayload(payload);
          if (result) return result;
        }
      }

      const recoverable = await this.getRecoverableStorePurchases();
      for (const purchase of recoverable) {
        const productId = String(purchase.productId || '');
        if (!this.isInvestorProProductId(productId)) continue;
        const payload = this.buildVerifyPayload(purchase);
        if (!payload) continue;
        if (options?.allowSubscriptionTransfer) {
          payload.allowSubscriptionTransfer = true;
        }
        const result = await verifyPayload(payload, purchase);
        if (result) return result;
      }

      const pending = await this.loadPending();
      for (const rec of Object.values(pending)) {
        if (!this.isInvestorProProductId(rec.payload.productId)) continue;
        const payload: IapVerifyRequest = {
          ...rec.payload,
          ...(options?.allowSubscriptionTransfer ? { allowSubscriptionTransfer: true } : {}),
        };
        const result = await verifyPayload(payload, rec.raw);
        if (result) return result;
      }

      return {
        ok: false,
        message:
          'Na tym Apple ID nie ma aktywnej subskrypcji Investor Pro. Jeśli masz własną subskrypcję na innym Apple ID, zmień konto w Ustawienia → Apple ID → Media i zakupy.',
      };
    } finally {
      this.activePurchaseOptions = null;
    }
  }

  /** Ponawia weryfikację zaległych paragonów (AsyncStorage + StoreKit). */
  async retryPendingEntitlements(): Promise<void> {
    await this.drainPending();
  }

  private isInvestorProProductId(productId: string): boolean {
    return isInvestorProStoreSku(productId);
  }

  /** SKU do zapytania sklepu — Investor Pro: kanoniczny + legacy (ASC może mieć tylko jeden). */
  private storeSkusForPurchase(productId: IapProductId, storeType: 'in-app' | 'subs'): string[] {
    if (storeType === 'subs' && this.isInvestorProProductId(productId)) {
      return Array.from(new Set([productId, ...IAP_INVESTOR_PRO_STORE_SKUS]));
    }
    return [productId];
  }

  private productIdOf(raw: Record<string, unknown>): string {
    return String(raw.productId ?? raw.id ?? raw.productIdentifier ?? '').trim();
  }

  private pickFetchedProductId(
    requested: IapProductId,
    products: unknown[] | null | undefined,
  ): IapProductId | null {
    if (!products?.length) return null;
    const ids = products
      .map((p) => this.productIdOf(p as Record<string, unknown>))
      .filter(Boolean);
    if (ids.includes(requested)) return requested;
    if (this.isInvestorProProductId(requested)) {
      const preferred = IAP_INVESTOR_PRO_STORE_SKUS.find((sku) => ids.includes(sku));
      if (preferred) return preferred as IapProductId;
    }
    const first = ids[0];
    return first ? (first as IapProductId) : null;
  }

  /** StoreKit czasem zwraca produkt tylko pod innym `type` — próbujemy preferred → all → drugi bucket. */
  private async fetchProductsForPurchase(
    iap: IapModule,
    skus: string[],
    storeType: 'in-app' | 'subs',
  ): Promise<unknown[] | null | undefined> {
    const timeoutMsg =
      storeType === 'subs'
        ? 'Sklep nie zwrócił subskrypcji Investor Pro. Sprawdź App Store Connect (Subscription + Intro Offer) i spróbuj ponownie.'
        : 'Sklep nie zwrócił produktu Pakiet Plus. Sprawdź, czy produkt IAP jest dodany do tej wersji w App Store Connect i spróbuj ponownie.';

    const primary = await this.withTimeout(
      iap.fetchProducts({ skus, type: storeType }),
      15_000,
      timeoutMsg,
    );
    if (primary?.length) return primary;

    // Alias 'inapp' (bez myślnika) — niektóre buildy Nitro wolą ten wariant.
    if (storeType === 'in-app') {
      try {
        const inapp = await this.withTimeout(
          iap.fetchProducts({ skus, type: 'inapp' as 'in-app' }),
          12_000,
          timeoutMsg,
        );
        if (inapp?.length) return inapp;
      } catch (e) {
        if (__DEV__) console.log('[IAP] fetchProducts(type=inapp) fallback failed:', e);
      }
    }

    try {
      const all = await this.withTimeout(
        iap.fetchProducts({ skus, type: 'all' }),
        12_000,
        timeoutMsg,
      );
      if (all?.length) return all;
    } catch (e) {
      if (__DEV__) console.log('[IAP] fetchProducts(type=all) fallback failed:', e);
    }

    const altType: 'in-app' | 'subs' = storeType === 'subs' ? 'in-app' : 'subs';
    try {
      const alt = await this.withTimeout(
        iap.fetchProducts({ skus, type: altType }),
        12_000,
        timeoutMsg,
      );
      if (alt?.length) return alt;
    } catch (e) {
      if (__DEV__) console.log(`[IAP] fetchProducts(type=${altType}) fallback failed:`, e);
    }

    return primary;
  }

  private resolvePurchaseStoreType(
    requested: 'in-app' | 'subs',
    products: unknown[] | null | undefined,
    productId: string,
  ): 'in-app' | 'subs' {
    const match = (products || []).find((p) => {
      const id = this.productIdOf(p as Record<string, unknown>);
      return id === productId;
    }) as Record<string, unknown> | undefined;
    if (!match) return requested;

    const t = String(match.type || '').toLowerCase();
    if (t === 'subs' || t === 'in-app') return t;

    const typeIOS = String(match.typeIOS || '').toLowerCase();
    if (typeIOS.includes('subscription')) return 'subs';
    if (typeIOS === 'consumable' || typeIOS === 'non-consumable') return 'in-app';
    return requested;
  }

  private productUnavailableMessage(productId: IapProductId, skus: string[], storeType: 'in-app' | 'subs'): string {
    if (Platform.OS !== 'ios') {
      return (
        `Produkt „${productId}" nie jest teraz dostępny w sklepie. ` +
        `Spróbuj ponownie za chwilę albo użyj „Przywróć zakupy”.`
      );
    }
    if (__DEV__) {
      console.warn('[IAP] product unavailable', { productId, skus, storeType });
    }
    const sandboxHint = __DEV__
      ? '\n• Ustawienia → App Store → konto Sandbox (testy z Xcode)\n• Scheme EstateOS musi mieć StoreKit Configuration.storekit'
      : '';
    if (storeType === 'subs' || this.isInvestorProProductId(productId)) {
      return (
        'Subskrypcja Investor Pro nie jest teraz dostępna w App Store na tym koncie.\n\n' +
        'Spróbuj:\n' +
        '• Przywróć zakupy\n' +
        '• Połączenie z internetem i ponowna próba za chwilę' +
        sandboxHint
      );
    }
    return (
      'Pakiet Plus nie jest teraz dostępny w App Store na tym koncie.\n\n' +
      'Spróbuj:\n' +
      '• Przywróć zakupy\n' +
      '• Połączenie z internetem i ponowna próba za chwilę\n' +
      '• Jeśli masz kupon powitalny — użyj go przy publikacji oferty' +
      sandboxHint
    );
  }

  private resultFromInvestorProVerify(
    verifyResult: Extract<IapVerifyResponse, { success: true }>,
    productId: IapProductId,
    transactionId: string,
    syncedExisting: boolean,
  ): IapPurchaseResult {
    return {
      ok: true,
      productId,
      transactionId,
      backendVerified: Boolean(verifyResult.verified),
      extraListings: verifyResult.extraListings,
      isPro: verifyResult.isPro,
      proExpiresAt: verifyResult.proExpiresAt,
      plusExpiresAt: verifyResult.plusExpiresAt,
      proCreditsGranted: verifyResult.proCreditsGranted,
      syncedExistingSubscription: syncedExisting && !verifyResult.subscriptionTransferred,
      subscriptionTransferred: verifyResult.subscriptionTransferred,
    };
  }

  /** Cena i trial z App Store / Play — do UI (sheet Apple i tak decyduje o trialu). */
  async getSubscriptionListing(productId: IapProductId): Promise<SubscriptionStoreListing | null> {
    if (!this.iap) {
      const ok = await this.init({ apiUrl: this.apiUrl, getToken: this.getToken });
      if (!ok) return null;
    }
    const connected = await this.ensureConnected();
    if (!connected || !this.iap) return null;

    try {
      const skus = this.storeSkusForPurchase(productId, 'subs');
      const products = await this.fetchProductsForPurchase(this.iap, skus, 'subs');
      const resolvedId = this.pickFetchedProductId(productId, products);
      if (!resolvedId || !products?.length) return null;
      const raw =
        (products.find((p) => {
          const r = p as Record<string, unknown>;
          const id = String(r.productId ?? r.id ?? r.productIdentifier ?? '');
          return id === resolvedId;
        }) as Record<string, unknown> | undefined) ??
        (products[0] as Record<string, unknown> | undefined);
      if (!raw) return null;
      return parseSubscriptionStoreListing(resolvedId, raw);
    } catch (e) {
      if (__DEV__) console.log('[IAP] getSubscriptionListing failed:', e);
      return null;
    }
  }

  private async ensurePurchaseReady(): Promise<
    { ok: true } | { ok: false; result: IapPurchaseResult }
  > {
    if (!this.iap || !this.initialized) {
      const reInit = await this.init({ apiUrl: this.apiUrl, getToken: this.getToken });
      if (!reInit) {
        return {
          ok: false,
          result: {
            ok: false,
            message:
              'Sklep In-App nie jest dostępny. Uruchom aplikację z natywnego buildu (`npx expo run:ios`/`run:android`), Expo Go nie obsługuje IAP.',
          },
        };
      }
    }

    const connected = await this.ensureConnected();
    if (!connected) {
      return {
        ok: false,
        result: { ok: false, message: 'Brak połączenia ze sklepem. Spróbuj ponownie za chwilę.' },
      };
    }

    return { ok: true };
  }

  private async purchaseInner(
    productId: IapProductId,
    storeType: 'in-app' | 'subs',
  ): Promise<IapPurchaseResult> {
    const ready = await this.ensurePurchaseReady();
    if (!ready.ok) return ready.result;

    const iap = this.iap;
    if (!iap) {
      return { ok: false, message: 'Sklep In-App nie jest dostępny.' };
    }

    const skus = this.storeSkusForPurchase(productId, storeType);
    let purchaseType = storeType;
    let resolvedFromStore = false;
    this.activePurchaseContext = { productId, storeType, skus };

    try {
      // StoreKit bywa „zimny” tuż po init — kilka prób z rosnącym backoffiem.
      let products = await this.fetchProductsForPurchase(iap, skus, storeType);
      for (const waitMs of [500, 1200, 2200]) {
        if (products?.length) break;
        await new Promise((r) => setTimeout(r, waitMs));
        // Czasem pomaga świeże połączenie przed kolejnym fetch.
        if (waitMs >= 1200) {
          try {
            await this.ensureConnected();
          } catch {
            // ignore
          }
        }
        products = await this.fetchProductsForPurchase(iap, skus, storeType);
      }
      const resolvedProductId = this.pickFetchedProductId(productId, products);
      if (resolvedProductId) {
        // SKU faktycznie zwrócone przez sklep (może być legacy) + typ z metadanych.
        productId = resolvedProductId;
        purchaseType = this.resolvePurchaseStoreType(storeType, products, resolvedProductId);
        resolvedFromStore = true;
        this.activePurchaseContext = { productId, storeType: purchaseType, skus };
      } else if (__DEV__) {
        // StoreKit Testing / Sandbox: sheet czasem otwiera się po samym SKU mimo pustego katalogu.
        console.log('[IAP] fetchProducts empty — attempting requestPurchase with SKU', productId, skus);
      }
      // iOS: nie abortujemy przy pustym katalogu — StoreKit 2 potrafi sprzedać po SKU.
      // Android: bez produktu w Play Billing sheet niemal zawsze pada.
      if (!resolvedProductId && Platform.OS === 'android') {
        return {
          ok: false,
          message: this.productUnavailableMessage(productId, skus, storeType),
        };
      }
    } catch (e) {
      return {
        ok: false,
        message: this.errMessage(e, 'Nie udało się pobrać produktów ze sklepu.'),
      };
    }

    // Rejestrujemy waitera ZANIM wystrzelimy `requestPurchase`, bo na
    // szybkich połączeniach `purchaseUpdated` przychodzi mikrosekundę po
    // resolved promise.
    const result = await new Promise<IapPurchaseResult>((resolve) => {
      const waiterKey = `pending:${productId}:${Date.now()}`;
      this.waiters.set(waiterKey, resolve);

      const timeout = setTimeout(() => {
        if (this.waiters.delete(waiterKey)) {
          resolve({
            ok: false,
            message: 'Sklep nie zwrócił odpowiedzi w czasie. Sprawdź w App Store, czy zakup został pobrany — jeśli tak, otwórz aplikację ponownie, dokończymy automatycznie.',
          });
        }
      }, PURCHASE_TIMEOUT_MS);

      // Patch resolve żeby clearTimeout przy normalnym zakończeniu.
      const original = this.waiters.get(waiterKey)!;
      this.waiters.set(waiterKey, (r) => {
        clearTimeout(timeout);
        original(r);
      });

      // Wystrzeliwujemy natywny sheet StoreKit / Play.
      const req =
        Platform.OS === 'ios'
          ? {
              // apple = kanoniczne API RN-IAP 14; ios = alias dla starszych buildów.
              apple: { sku: productId },
              ios: { sku: productId },
            }
          : { google: { skus: [productId] } };

      this.iap!.requestPurchase({ request: req, type: purchaseType }).catch((err) => {
        // User cancelled — odróżniamy od błędu.
        if (this.isCancelled(err)) {
          if (this.waiters.delete(waiterKey)) {
            clearTimeout(timeout);
            resolve({ ok: false, cancelled: true });
          }
          return;
        }
        if (this.isRecoverablePurchaseError(err)) {
          void this.recoverExistingPurchase(err, purchaseType);
          return;
        }
        if (this.waiters.delete(waiterKey)) {
          clearTimeout(timeout);
          const raw = this.toUserPurchaseMessage(err, 'Zakup nie powiódł się.', purchaseType);
          const looksMissing =
            !resolvedFromStore ||
            /not available|nie jest dostępny|couldn't be found|cannot be found|invalid.?product|no product|unknown product|sku/i.test(
              raw,
            );
          resolve({
            ok: false,
            message: looksMissing
              ? this.productUnavailableMessage(productId, skus, storeType)
              : raw,
          });
        }
      });
    });

    return result;
  }

  /**
   * Restore Purchases (App Store Review Guideline 3.1.1).
   * Pobiera wszystkie historyczne zakupy non-consumable / subscriptions
   * i zgłasza je do backendu. Pakiet Plus jest consumable: jedna dodatkowa
   * nowa oferta na 30 dni. Apple może zwrócić pustą listę, ale wymaga żeby przycisk DZIAŁAŁ —
   * dlatego return value to zawsze obiekt z liczbą restored.
   */
  async restorePurchases(): Promise<RestorePurchasesResult> {
    if (!this.iap || !this.initialized) {
      return { ok: false, restored: 0, message: 'Sklep In-App nie jest dostępny.' };
    }
    const connected = await this.ensureConnected();
    if (!connected) {
      return { ok: false, restored: 0, message: 'Brak połączenia ze sklepem.' };
    }

    try {
      const purchases = await this.getRecoverableStorePurchases();
      let restored = 0;
      for (const purchase of purchases || []) {
        const reported = await this.handleIncomingPurchase(purchase, { silent: true });
        if (reported) restored++;
      }
      const syncResult = await this.syncActiveInvestorProSubscriptions({ silent: true });
      restored += syncResult.synced;
      // Plus: jeszcze raz drenujemy lokalny cache (mogły dojść).
      await this.drainPending();
      return {
        ok: true,
        restored,
        subscriptionConflict: syncResult.subscriptionConflict,
        errorCode: syncResult.errorCode,
        message: syncResult.message,
      };
    } catch (e) {
      return {
        ok: false,
        restored: 0,
        message: this.errMessage(e, 'Nie udało się przywrócić zakupów.'),
      };
    }
  }

  // -------------------------------------------------------------------------
  //  INTERNAL — connection lifecycle
  // -------------------------------------------------------------------------

  private loadModule(): IapModule | null {
    try {
      return require('react-native-iap') as IapModule;
    } catch {
      return null;
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.iap) return false;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        const c = await this.iap!.initConnection();
        return Boolean(c);
      } catch (e) {
        if (__DEV__) console.log('[IAP] initConnection failed:', e);
        return false;
      } finally {
        // Pozwól na kolejny `initConnection` w przyszłości, bo niektóre
        // platformy mogą rozłączyć się w background.
        setTimeout(() => {
          this.connecting = null;
        }, 1500);
      }
    })();

    return this.connecting;
  }

  private isCancelled(err: unknown): boolean {
    if (!this.iap) return false;
    try {
      if (this.iap.isUserCancelledError?.(err as any)) return true;
    } catch {}
    const code = (err as { code?: string })?.code;
    return code === this.iap.ErrorCode?.UserCancelled;
  }

  private isRecoverablePurchaseError(err: unknown): boolean {
    const code = String((err as { code?: unknown })?.code || '').toLowerCase();
    const message = String((err as { message?: unknown })?.message || '').toLowerCase();
    return (
      code === 'duplicate-purchase' ||
      code === 'already-owned' ||
      message.includes('duplicate purchase') ||
      message.includes('already owned') ||
      message.includes('item already owned')
    );
  }

  /** @deprecated alias */
  private isDuplicatePurchaseError(err: unknown): boolean {
    return this.isRecoverablePurchaseError(err);
  }

  private isSkuNotFoundError(err: unknown): boolean {
    const code = String((err as { code?: unknown })?.code || '').toLowerCase();
    const message = String((err as { message?: unknown })?.message || '').toLowerCase();
    return (
      code === 'sku-not-found' ||
      message.includes('sku not found') ||
      message.includes('sku-not-found') ||
      message.includes("couldn't be found") ||
      message.includes('cannot be found') ||
      message.includes('invalid product')
    );
  }

  private toUserPurchaseMessage(err: unknown, fallback: string, storeType: 'in-app' | 'subs' = 'in-app'): string {
    const code = String((err as { code?: unknown })?.code || '').toLowerCase();
    const message = String((err as { message?: unknown })?.message || '').toLowerCase();

    if (this.isCancelled(err)) {
      return fallback;
    }
    if (this.isSkuNotFoundError(err)) {
      const ctx = this.activePurchaseContext;
      const productId =
        (typeof (err as { productId?: unknown })?.productId === 'string' &&
        (err as { productId: string }).productId
          ? ((err as { productId: string }).productId as IapProductId)
          : null) ||
        ctx?.productId ||
        (storeType === 'subs' ? IAP_PRODUCT_IDS.INVESTOR_PRO : IAP_PRODUCT_IDS.PAKIET_PLUS_30D);
      const skus = ctx?.skus?.length ? ctx.skus : [productId];
      const type = ctx?.storeType || storeType;
      return this.productUnavailableMessage(productId, skus, type);
    }
    if (code === 'already-owned' || message.includes('already owned') || message.includes('item already owned')) {
      return storeType === 'subs'
        ? 'Subskrypcja Investor Pro jest już aktywna w App Store. Synchronizujemy dostęp z Twoim kontem EstateOS…'
        : 'Ten zakup jest już przypisany do Twojego Apple ID. Synchronizujemy go z kontem EstateOS…';
    }
    if (code === 'duplicate-purchase' || message.includes('duplicate purchase')) {
      return storeType === 'subs'
        ? 'Apple zgłasza aktywną subskrypcję Investor Pro. Przywracamy dostęp na koncie…'
        : 'Apple ma niedokończony zakup Pakietu Plus. Przywracamy go na koncie…';
    }

    const raw = this.errMessage(err, fallback);
    if (/^item already owned/i.test(raw) || /^already[- ]owned/i.test(raw)) {
      return storeType === 'subs'
        ? 'Subskrypcja Investor Pro jest już aktywna w App Store. Synchronizujemy dostęp z Twoim kontem EstateOS…'
        : 'Ten zakup jest już przypisany do Twojego Apple ID. Synchronizujemy go z kontem EstateOS…';
    }
    return raw.replace(/\nKod: already-owned/i, '').trim() || fallback;
  }

  private errMessage(e: unknown, fallback: string): string {
    if (e instanceof Error && e.message) return e.message;
    if (e && typeof e === 'object') {
      const obj = e as {
        message?: unknown;
        code?: unknown;
        debugMessage?: unknown;
        responseCode?: unknown;
        productId?: unknown;
      };
      const parts = [
        typeof obj.message === 'string' && obj.message.trim() ? obj.message.trim() : null,
        typeof obj.code === 'string' && obj.code.trim() ? `Kod: ${obj.code.trim()}` : null,
        typeof obj.debugMessage === 'string' && obj.debugMessage.trim() ? obj.debugMessage.trim() : null,
        obj.responseCode != null ? `Response: ${String(obj.responseCode)}` : null,
        typeof obj.productId === 'string' && obj.productId.trim() ? `Produkt: ${obj.productId.trim()}` : null,
      ].filter((x): x is string => Boolean(x));
      if (parts.length > 0) return parts.join('\n');
    }
    if (typeof e === 'string' && e) return e;
    return fallback;
  }

  // -------------------------------------------------------------------------
  //  INTERNAL — incoming purchase pipeline
  // -------------------------------------------------------------------------

  /**
   * Każda transakcja przechodzi tym pipeline'em:
   *  1. Budujemy payload weryfikacyjny (`IapVerifyRequest`).
   *  2. Zapisujemy w pending receipts (AsyncStorage).
   *  3. Zgłaszamy do backendu z retry.
   *  4. Jeśli backend zwrócił `verified: true` — wywołujemy `finishTransaction`
   *     i usuwamy z pending. Jeśli `false` — zostawiamy, ponowimy później.
   *  5. Resolvujemy waitera (jeśli aktualny zakup).
   */
  private async handleIncomingPurchase(
    purchase: IapPurchase,
    opts?: { silent?: boolean },
  ): Promise<boolean> {
    const payload = this.buildVerifyPayload(purchase);
    if (!payload) {
      if (__DEV__) console.log('[IAP] purchase z brakującym JWS/token — pomijam:', purchase);
      return false;
    }

    const key = this.idempotencyKey(payload);

    // Cache w AsyncStorage zanim cokolwiek wyślemy — jakby aplikacja
    // crashowała w trakcie verify, dorzucimy przy następnym boot.
    await this.savePending({ key, payload, raw: purchase, attempts: 0, lastTry: 0 });

    const verifyResult = await this.verifyOnBackend(payload, key);

    if (verifyResult?.success && verifyResult.verified) {
      // Backend potwierdził — zamykamy transakcję po stronie sklepu.
      try {
        await this.iap!.finishTransaction({
          purchase,
          isConsumable: this.isConsumable(payload.productId),
        });
      } catch (e) {
        if (__DEV__) console.log('[IAP] finishTransaction failed (ok, ponowimy):', e);
      }
      await this.removePending(key);
      this.resolveWaiterFor(payload.productId, {
        ok: true,
        productId: payload.productId,
        transactionId: this.transactionIdOf(payload),
        backendVerified: true,
        extraListings: verifyResult.extraListings,
        isPro: verifyResult.isPro,
        proExpiresAt: verifyResult.proExpiresAt,
        plusExpiresAt: verifyResult.plusExpiresAt,
        proCreditsGranted: verifyResult.proCreditsGranted,
        subscriptionTransferred: verifyResult.subscriptionTransferred,
        deferPublicationConsume: Boolean(
          'deferPublicationConsume' in payload && payload.deferPublicationConsume,
        ),
        publicationConsumeDeferred: verifyResult.publicationConsumeDeferred,
      });
      return true;
    }

    if (verifyResult?.success && !verifyResult.verified) {
      // Backend przyjął, ale jeszcze weryfikuje z Apple/Google.
      // Pozostawiamy w pending — drenowanie spróbuje ponownie.
      this.resolveWaiterFor(payload.productId, {
        ok: true,
        productId: payload.productId,
        transactionId: this.transactionIdOf(payload),
        backendVerified: false,
        extraListings: verifyResult.extraListings,
        isPro: verifyResult.isPro,
        proExpiresAt: verifyResult.proExpiresAt,
        plusExpiresAt: verifyResult.plusExpiresAt,
        proCreditsGranted: verifyResult.proCreditsGranted,
        deferPublicationConsume: Boolean(
          'deferPublicationConsume' in payload && payload.deferPublicationConsume,
        ),
        publicationConsumeDeferred: verifyResult.publicationConsumeDeferred,
      });
      return true;
    }

    // Backend rejected (success: false) lub nieosiągalny.
    // Transakcja zostaje w pending — ponowimy w tle.
    if (!opts?.silent) {
      const errorCode =
        verifyResult && !verifyResult.success
          ? String(
              (verifyResult as { errorCode?: string; code?: string }).errorCode ??
                (verifyResult as { code?: string }).code ??
                '',
            ).trim() || undefined
          : undefined;

      if (!verifyResult || (verifyResult.success === false && verifyResult.shouldRetry)) {
        // Apple potwierdził — backend chwilowo niedostępny lub jeszcze weryfikuje.
        this.resolveWaiterFor(payload.productId, {
          ok: true,
          productId: payload.productId,
          transactionId: this.transactionIdOf(payload),
          backendVerified: false,
        });
        void this.drainPending();
        return true;
      }

      this.resolveWaiterFor(payload.productId, {
        ok: false,
        message: verifyResult.message,
        errorCode,
      });
    }
    return false;
  }

  private buildVerifyPayload(p: IapPurchase): IapVerifyRequest | null {
    const productId = p.productId as IapProductId;
    if (!this.isKnownProductId(productId)) return null;

    if (Platform.OS === 'ios') {
      const jws = (p as any).purchaseToken ?? (p as any).jwsRepresentation ?? null;
      const tx = (p as any).transactionId ?? (p as any).id ?? null;
      if (!jws || !tx) return null;
      const transactionId = String(tx);
      const receipt = String(jws);
      const deferPublicationConsume = Boolean(this.activePurchaseOptions?.deferPublicationConsume);
      const targetOfferId = this.activePurchaseOptions?.targetOfferId;
      return {
        platform: 'ios',
        productId,
        transactionId,
        originalTransactionId:
          (p as any).originalTransactionIdentifierIOS ??
          (p as any).originalTransactionId ??
          undefined,
        jwsRepresentation: receipt,
        receipt,
        receiptData: receipt,
        pendingPurchaseId: `ios:${transactionId}`,
        ...(this.activePurchaseOptions?.allowSubscriptionTransfer
          ? { allowSubscriptionTransfer: true }
          : {}),
        ...(deferPublicationConsume
          ? {
              deferPublicationConsume: true,
              publicationIntent: 'NEW_OFFER' as const,
              ...(targetOfferId != null && targetOfferId > 0 ? { targetOfferId } : {}),
            }
          : {}),
      };
    }

    const token = (p as any).purchaseToken ?? null;
    if (!token) return null;
    const deferPublicationConsume = Boolean(this.activePurchaseOptions?.deferPublicationConsume);
    const targetOfferId = this.activePurchaseOptions?.targetOfferId;
    return {
      platform: 'android',
      productId,
      purchaseToken: String(token),
      transactionId: (p as any).transactionId ?? undefined,
      ...(deferPublicationConsume
        ? {
            deferPublicationConsume: true,
            publicationIntent: 'NEW_OFFER' as const,
            ...(targetOfferId != null && targetOfferId > 0 ? { targetOfferId } : {}),
          }
        : {}),
    };
  }

  private idempotencyKey(payload: IapVerifyRequest): string {
    return payload.platform === 'ios'
      ? `ios:${payload.transactionId}`
      : `android:${payload.purchaseToken}`;
  }

  private transactionIdOf(payload: IapVerifyRequest): string {
    return payload.platform === 'ios' ? payload.transactionId : (payload.transactionId ?? payload.purchaseToken);
  }

  private isKnownProductId(productId: string): productId is IapProductId {
    return (
      Object.values(IAP_PRODUCT_IDS).includes(productId as IapProductId) ||
      productId === IAP_INVESTOR_PRO_LEGACY_ID
    );
  }

  private isConsumable(productId: IapProductId): boolean {
    return productId === IAP_PRODUCT_IDS.PAKIET_PLUS_30D;
  }

  private resolveWaiterFor(productId: IapProductId, result: IapPurchaseResult): void {
    // Wybieramy NAJSTARSZEGO waitera dla tego productId (FIFO).
    for (const [key, fn] of this.waiters) {
      if (key.startsWith(`pending:${productId}:`)) {
        this.waiters.delete(key);
        fn(result);
        return;
      }
    }
  }

  private resolveWaiterForError(
    err: unknown,
    cancelled = false,
    storeType: 'in-app' | 'subs' = 'in-app',
  ): void {
    const productId = (err as { productId?: string })?.productId;
    const effectiveType = this.activePurchaseContext?.storeType || storeType;
    const message = this.toUserPurchaseMessage(err, 'Zakup nie powiódł się.', effectiveType);
    const result: IapPurchaseResult = cancelled ? { ok: false, cancelled: true } : { ok: false, message };
    if (productId && this.isKnownProductId(productId)) {
      this.resolveWaiterFor(productId, result);
      return;
    }
    // Niektóre błędy StoreKit z Nitro przychodzą bez productId. Wtedy zwracamy
    // błąd do najstarszego oczekującego zakupu, żeby UI nie wisiał 90 sekund.
    const oldest = this.waiters.entries().next().value as [string, (r: IapPurchaseResult) => void] | undefined;
    if (!oldest) return;
    const [key, fn] = oldest;
    this.waiters.delete(key);
    fn(result);
  }

  private async recoverExistingPurchase(
    err: unknown,
    storeType: 'in-app' | 'subs' = 'in-app',
  ): Promise<void> {
    const productIdFromError = String((err as { productId?: unknown })?.productId || '');
    try {
      const purchases = await this.getRecoverableStorePurchases();
      const matching = purchases.filter((p) => {
        if (productIdFromError) return p.productId === productIdFromError;
        return this.isKnownProductId(String(p.productId));
      });

      for (const purchase of matching) {
        const handled = await this.handleIncomingPurchase(purchase);
        if (handled) return;
      }

      if (storeType === 'subs' && typeof this.iap?.getActiveSubscriptions === 'function') {
        const skus = productIdFromError
          ? [productIdFromError]
          : [IAP_PRODUCT_IDS.INVESTOR_PRO, 'pl.estateos.app.pakiet_investor_pro'];
        const activeSubs = await this.iap.getActiveSubscriptions(skus);
        for (const sub of activeSubs || []) {
          if (!sub?.isActive) continue;
          const productId = String(sub.productId || '');
          if (!this.isKnownProductId(productId) && productId !== 'pl.estateos.app.pakiet_investor_pro') {
            continue;
          }
          const jws = sub.purchaseToken ? String(sub.purchaseToken) : '';
          const tx = sub.transactionId ? String(sub.transactionId) : '';
          if (!jws || !tx) continue;

          const payload: IapVerifyRequest = {
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            productId: productId as IapProductId,
            transactionId: tx,
            originalTransactionId:
              (sub as { originalTransactionIdentifierIOS?: string }).originalTransactionIdentifierIOS ??
              (sub as { originalTransactionId?: string }).originalTransactionId ??
              undefined,
            jwsRepresentation: jws,
            receipt: jws,
            receiptData: jws,
            pendingPurchaseId: `${Platform.OS}:${tx}`,
            ...(this.activePurchaseOptions?.allowSubscriptionTransfer
              ? { allowSubscriptionTransfer: true }
              : {}),
          };
          const key = this.idempotencyKey(payload);
          const verifyResult = await this.verifyOnBackend(payload, key);
          if (verifyResult?.success) {
            this.resolveWaiterFor(productId as IapProductId, {
              ok: true,
              productId: productId as IapProductId,
              transactionId: tx,
              backendVerified: Boolean(verifyResult.verified),
              extraListings: verifyResult.extraListings,
              isPro: verifyResult.isPro,
              proExpiresAt: verifyResult.proExpiresAt,
              plusExpiresAt: verifyResult.plusExpiresAt,
              proCreditsGranted: verifyResult.proCreditsGranted,
              syncedExistingSubscription: true,
              subscriptionTransferred: verifyResult.subscriptionTransferred,
            });
            return;
          }
          if (verifyResult && verifyResult.success === false) {
            const errorCode = String(
              (verifyResult as { errorCode?: string; code?: string }).errorCode ??
                (verifyResult as { code?: string }).code ??
                '',
            ).trim() || undefined;
            this.resolveWaiterFor(productId as IapProductId, {
              ok: false,
              message: verifyResult.message,
              errorCode,
            });
            return;
          }
        }
      }
    } catch (recoverError) {
      if (__DEV__) console.log('[IAP] recoverExistingPurchase failed:', recoverError);
    }

    this.resolveWaiterForError(
      {
        ...(err && typeof err === 'object' ? (err as Record<string, unknown>) : {}),
        message:
          storeType === 'subs'
            ? 'Subskrypcja Investor Pro jest aktywna w App Store, ale synchronizacja konta nie powiodła się od razu. Dotknij „Przywróć zakupy” w Profilu lub uruchom aplikację ponownie.'
            : 'Apple ma niedokończony wcześniejszy zakup Pakietu Plus. Dotknij „Przywróć zakupy” w Profilu lub uruchom aplikację ponownie.',
      },
      false,
      storeType,
    );
  }

  /** Synchronizuje aktywną subskrypcję Investor Pro z backendem (restore / boot). */
  private async syncActiveInvestorProSubscriptions(opts?: {
    silent?: boolean;
  }): Promise<{
    synced: number;
    subscriptionConflict?: boolean;
    errorCode?: string;
    message?: string;
  }> {
    if (!this.iap || typeof this.iap.getActiveSubscriptions !== 'function') {
      return { synced: 0 };
    }

    let synced = 0;
    let subscriptionConflict = false;
    let conflictErrorCode: string | undefined;
    let conflictMessage: string | undefined;

    try {
      const activeSubs = await this.iap.getActiveSubscriptions([
        IAP_PRODUCT_IDS.INVESTOR_PRO,
        'pl.estateos.app.pakiet_investor_pro',
      ]);
      for (const sub of activeSubs || []) {
        if (!sub?.isActive) continue;
        const productId = String(sub.productId || '');
        if (!this.isKnownProductId(productId) && productId !== 'pl.estateos.app.pakiet_investor_pro') {
          continue;
        }
        const jws = sub.purchaseToken ? String(sub.purchaseToken) : '';
        const tx = sub.transactionId ? String(sub.transactionId) : '';
        if (!jws || !tx) continue;

        const payload: IapVerifyRequest = {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          productId: productId as IapProductId,
          transactionId: tx,
          originalTransactionId:
            (sub as { originalTransactionIdentifierIOS?: string }).originalTransactionIdentifierIOS ??
            (sub as { originalTransactionId?: string }).originalTransactionId ??
            undefined,
          jwsRepresentation: jws,
          receipt: jws,
          receiptData: jws,
          pendingPurchaseId: `${Platform.OS}:${tx}`,
        };
        const key = this.idempotencyKey(payload);
        const verifyResult = await this.verifyOnBackend(payload, key);
        if (verifyResult?.success && verifyResult.verified) {
          synced++;
          continue;
        }
        if (verifyResult && verifyResult.success === false) {
          const errorCode = String(
            (verifyResult as { errorCode?: string; code?: string }).errorCode ??
              (verifyResult as { code?: string }).code ??
              '',
          ).trim() || undefined;
          if (
            errorCode === 'SUBSCRIPTION_LINKED_TO_OTHER_ACCOUNT' ||
            /innego konta estateos/i.test(String(verifyResult.message || ''))
          ) {
            subscriptionConflict = true;
            conflictErrorCode = errorCode;
            conflictMessage = verifyResult.message;
          } else if (!opts?.silent && __DEV__) {
            console.log('[IAP] syncActiveInvestorProSubscriptions verify failed:', productId);
          }
        }
      }
    } catch (error) {
      if (__DEV__) console.log('[IAP] syncActiveInvestorProSubscriptions failed:', error);
    }

    return {
      synced,
      subscriptionConflict,
      errorCode: conflictErrorCode,
      message: conflictMessage,
    };
  }

  /** @deprecated */
  private async recoverDuplicatePurchase(err: unknown): Promise<void> {
    await this.recoverExistingPurchase(err, 'in-app');
  }

  private async getRecoverableStorePurchases(): Promise<IapPurchase[]> {
    if (!this.iap) return [];
    const byKey = new Map<string, IapPurchase>();
    const add = (items: IapPurchase[] | null | undefined) => {
      for (const purchase of items || []) {
        const productId = String(purchase.productId || '');
        if (!this.isKnownProductId(productId)) continue;
        const key =
          String((purchase as any).transactionId || (purchase as any).id || (purchase as any).purchaseToken || '') ||
          `${productId}:${byKey.size}`;
        byKey.set(key, purchase);
      }
    };

    try {
      add(await this.iap.getAvailablePurchases());
    } catch (error) {
      if (__DEV__) console.log('[IAP] getAvailablePurchases failed:', error);
    }

    if (Platform.OS === 'ios' && typeof this.iap.getPendingTransactionsIOS === 'function') {
      try {
        add(await this.iap.getPendingTransactionsIOS());
      } catch (error) {
        if (__DEV__) console.log('[IAP] getPendingTransactionsIOS failed:', error);
      }
    }

    return Array.from(byKey.values());
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  // -------------------------------------------------------------------------
  //  INTERNAL — backend communication
  // -------------------------------------------------------------------------

  private async verifyOnBackend(
    payload: IapVerifyRequest,
    key: string,
    attempt = 0,
  ): Promise<IapVerifyResponse | null> {
    const token = this.getToken();
    if (!token) {
      if (__DEV__) console.log('[IAP] brak tokenu, nie mogę verify — zostawiam w pending');
      return null;
    }

    const url = `${this.apiUrl}${IAP_ENDPOINTS.VERIFY}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      // 404/501 — backend nie ma jeszcze endpointu. Traktujemy jako pending.
      if (res.status === 404 || res.status === 501) {
        await this.bumpPendingAttempts(key);
        return null;
      }
      const data = (await res.json().catch(() => null)) as IapVerifyResponse | null;
      if (!data) {
        await this.bumpPendingAttempts(key);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          return this.verifyOnBackend(payload, key, attempt + 1);
        }
        return null;
      }
      if (data.success === false && !data.shouldRetry) {
        // Trwały błąd (np. INVALID_RECEIPT, DUPLICATE_TRANSACTION).
        // Usuwamy z pending — nie ma sensu retry. Ale finishTransaction
        // i tak zrobimy, żeby Apple nie wisiał (DUPLICATE = już zaksięgowane prawo publikacji).
        await this.removePending(key);
      } else {
        await this.bumpPendingAttempts(key);
      }
      return data;
    } catch (e) {
      if (__DEV__) console.log('[IAP] verify network error:', e);
      await this.bumpPendingAttempts(key);
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
        return this.verifyOnBackend(payload, key, attempt + 1);
      }
      return null;
    }
  }

  // -------------------------------------------------------------------------
  //  INTERNAL — pending receipts (AsyncStorage)
  // -------------------------------------------------------------------------

  private async loadPending(): Promise<Record<string, PendingReceipt>> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_RECEIPTS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, PendingReceipt>;
    } catch {
      return {};
    }
  }

  private async writePending(map: Record<string, PendingReceipt>): Promise<void> {
    try {
      await AsyncStorage.setItem(PENDING_RECEIPTS_KEY, JSON.stringify(map));
    } catch {
      // ignore — w najgorszym wypadku stracimy retry, ale Apple i tak
      // doręczy event przy następnym otwarciu (`getAvailablePurchases`).
    }
  }

  private async savePending(rec: PendingReceipt): Promise<void> {
    const map = await this.loadPending();
    map[rec.key] = rec;
    await this.writePending(map);
  }

  private async removePending(key: string): Promise<void> {
    const map = await this.loadPending();
    if (map[key]) {
      delete map[key];
      await this.writePending(map);
    }
  }

  private async bumpPendingAttempts(key: string): Promise<void> {
    const map = await this.loadPending();
    const rec = map[key];
    if (rec) {
      rec.attempts += 1;
      rec.lastTry = Date.now();
      map[key] = rec;
      await this.writePending(map);
    }
  }

  /**
   * Próbuje dokończyć wszystkie zaległe transakcje z poprzednich sesji.
   * Wywoływane przy boot oraz przy każdym foreground.
   */
  private async drainPending(): Promise<void> {
    if (!this.iap) return;

    // (1) StoreKit/Play — drainuj transakcje które system trzyma natywnie.
    // iOS potrafi zgłosić duplicate-purchase dla transakcji widocznej dopiero
    // w `getPendingTransactionsIOS`, więc używamy wspólnego recovery helpera.
    const native = await this.getRecoverableStorePurchases();
    for (const p of native || []) {
      await this.handleIncomingPurchase(p, { silent: true });
    }

    // (2) AsyncStorage — drainuj te które backend wcześniej odrzucił/timeoutował.
    const map = await this.loadPending();
    for (const rec of Object.values(map)) {
      // Exponential backoff: 30 s, 1 min, 5 min, 15 min, 1 h, max 6 h.
      const backoffs = [30_000, 60_000, 300_000, 900_000, 3_600_000, 21_600_000];
      const delay = backoffs[Math.min(rec.attempts, backoffs.length - 1)];
      if (Date.now() - rec.lastTry < delay) continue;

      const result = await this.verifyOnBackend(rec.payload, rec.key);
      if (result?.success && result.verified) {
        try {
          await this.iap.finishTransaction({
            purchase: rec.raw,
            isConsumable: this.isConsumable(rec.payload.productId),
          });
        } catch {
          // best-effort
        }
        await this.removePending(rec.key);
      }
    }
  }

  // -------------------------------------------------------------------------
  //  TEARDOWN (np. dla testów / dev-reload)
  // -------------------------------------------------------------------------

  /** Czy App Store / Play zgłasza aktywną subskrypcję Investor Pro na tym urządzeniu. */
  async hasActiveInvestorProOnDevice(): Promise<boolean> {
    if (!this.iap) {
      const ok = await this.init({ apiUrl: this.apiUrl, getToken: this.getToken });
      if (!ok) return false;
    }
    const connected = await this.ensureConnected();
    if (!connected) return false;

    if (typeof this.iap!.getActiveSubscriptions === 'function') {
      try {
        const activeSubs = await this.iap!.getActiveSubscriptions([
          IAP_PRODUCT_IDS.INVESTOR_PRO,
          'pl.estateos.app.pakiet_investor_pro',
        ]);
        const hasActive = (activeSubs || []).some((sub) => {
          if (!sub?.isActive) return false;
          const productId = String(sub.productId || '');
          return this.isInvestorProProductId(productId);
        });
        if (hasActive) return true;
      } catch {
        // Sandbox często zwraca pustą listę — sprawdzamy fallbacki poniżej.
      }
    }

    const recoverable = await this.getRecoverableStorePurchases();
    if (recoverable.some((p) => this.isInvestorProProductId(String(p.productId || '')))) {
      return true;
    }

    const pending = await this.loadPending();
    return Object.values(pending).some((rec) =>
      this.isInvestorProProductId(String(rec.payload.productId || '')),
    );
  }

  async teardown(): Promise<void> {
    try {
      this.purchaseUpdateSub?.remove();
      this.purchaseErrorSub?.remove();
      this.appStateSub?.remove();
    } catch {}
    this.purchaseUpdateSub = null;
    this.purchaseErrorSub = null;
    this.appStateSub = null;
    if (this.iap) {
      try {
        await this.iap.endConnection();
      } catch {}
    }
    this.initialized = false;
    this.connecting = null;
  }
}

// Singleton
export const IAPManager = new IAPManagerImpl();

// Re-export typów dla wygody konsumentów.
export type { IapProductId };
export { IAP_PRODUCT_IDS };
