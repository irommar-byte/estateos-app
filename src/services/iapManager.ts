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
 * ║     przy boot — inaczej pieniądze są pobrane, a slot nie naliczony.  ║
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
  IAP_PRODUCT_IDS,
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

export type IapPurchaseResult =
  | {
      ok: true;
      productId: IapProductId;
      transactionId: string;
      /** Czy backend potwierdził weryfikację (true) czy jeszcze pending (false). */
      backendVerified: boolean;
      /** Liczba dodatkowych slotów po zaksięgowaniu (jeśli backend zwrócił). */
      extraListings?: number;
    }
  | { ok: false; cancelled: true; message?: string }
  | { ok: false; cancelled?: false; message: string };

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
    });

    // Foreground rehydration: gdy aplikacja wraca z background, próbujemy
    // dorzucić niedokończone transakcje (np. user kupił, zamknął appkę
    // zanim backend potwierdził).
    this.appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void this.drainPending();
    });

    // Drenuj wszystko co czeka z poprzednich sesji.
    await this.drainPending();

    this.initialized = true;
    if (__DEV__) console.log('[IAP] init OK');
    return true;
  }

  /**
   * Wykonuje natywny zakup consumable. Wynik dochodzi przez globalny
   * `purchaseUpdatedListener` → `handleIncomingPurchase` → resolver waitera.
   */
  async purchaseConsumable(productId: IapProductId): Promise<IapPurchaseResult> {
    const iap = this.iap;
    if (!iap || !this.initialized) {
      const reInit = await this.init({ apiUrl: this.apiUrl, getToken: this.getToken });
      if (!reInit) {
        return {
          ok: false,
          message:
            'Sklep In-App nie jest dostępny. Uruchom aplikację z natywnego buildu (`npx expo run:ios`/`run:android`), Expo Go nie obsługuje IAP.',
        };
      }
    }

    const connected = await this.ensureConnected();
    if (!connected) {
      return { ok: false, message: 'Brak połączenia ze sklepem. Spróbuj ponownie za chwilę.' };
    }

    // Walidacja: produkt musi istnieć w sklepie.
    try {
      const products = await this.iap!.fetchProducts({ skus: [productId], type: 'in-app' });
      if (!products?.length) {
        return {
          ok: false,
          message: `Produkt „${productId}" nie jest skonfigurowany w sklepie. Sprawdź App Store Connect / Play Console.`,
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
          ? { apple: { sku: productId } }
          : { google: { skus: [productId] } };

      this.iap!.requestPurchase({ request: req, type: 'in-app' }).catch((err) => {
        // User cancelled — odróżniamy od błędu.
        if (this.isCancelled(err)) {
          if (this.waiters.delete(waiterKey)) {
            clearTimeout(timeout);
            resolve({ ok: false, cancelled: true });
          }
          return;
        }
        if (this.waiters.delete(waiterKey)) {
          clearTimeout(timeout);
          resolve({
            ok: false,
            message: this.errMessage(err, 'Zakup nie powiódł się.'),
          });
        }
      });
    });

    return result;
  }

  /**
   * Restore Purchases (App Store Review Guideline 3.1.1).
   * Pobiera wszystkie historyczne zakupy non-consumable / subscriptions
   * i zgłasza je do backendu. Dla pure-consumable'ów (jak Pakiet Plus
   * 30d) zwraca pustą listę, ale Apple wymaga żeby przycisk DZIAŁAŁ —
   * dlatego return value to zawsze obiekt z liczbą restored.
   */
  async restorePurchases(): Promise<{ ok: boolean; restored: number; message?: string }> {
    if (!this.iap || !this.initialized) {
      return { ok: false, restored: 0, message: 'Sklep In-App nie jest dostępny.' };
    }
    const connected = await this.ensureConnected();
    if (!connected) {
      return { ok: false, restored: 0, message: 'Brak połączenia ze sklepem.' };
    }

    try {
      const purchases = await this.iap.getAvailablePurchases();
      let restored = 0;
      for (const purchase of purchases || []) {
        const reported = await this.handleIncomingPurchase(purchase, { silent: true });
        if (reported) restored++;
      }
      // Plus: jeszcze raz drenujemy lokalny cache (mogły dojść).
      await this.drainPending();
      return { ok: true, restored };
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

  private errMessage(e: unknown, fallback: string): string {
    if (e instanceof Error && e.message) return e.message;
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
      });
      return true;
    }

    // Backend rejected (success: false) lub nieosiągalny.
    // Wszystko jedno — transakcja JEST w pending i ponowimy.
    if (!opts?.silent) {
      this.resolveWaiterFor(payload.productId, {
        ok: false,
        message:
          verifyResult && !verifyResult.success
            ? verifyResult.message
            : 'Zakup potwierdzony przez Apple, ale serwer EstateOS™ jeszcze go nie zaksięgował. Dokończymy automatycznie, gdy odzyskamy łączność.',
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
      };
    }

    const token = (p as any).purchaseToken ?? null;
    if (!token) return null;
    return {
      platform: 'android',
      productId,
      purchaseToken: String(token),
      transactionId: (p as any).transactionId ?? undefined,
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
    return Object.values(IAP_PRODUCT_IDS).includes(productId as IapProductId);
  }

  private isConsumable(productId: IapProductId): boolean {
    // Wszystkie obecne produkty to consumable.
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

  // -------------------------------------------------------------------------
  //  INTERNAL — backend communication
  // -------------------------------------------------------------------------

  private async verifyOnBackend(
    payload: IapVerifyRequest,
    key: string,
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
        return null;
      }
      if (data.success === false && !data.shouldRetry) {
        // Trwały błąd (np. INVALID_RECEIPT, DUPLICATE_TRANSACTION).
        // Usuwamy z pending — nie ma sensu retry. Ale finishTransaction
        // i tak zrobimy, żeby Apple nie wisiał (DUPLICATE = już dostał slot).
        await this.removePending(key);
      } else {
        await this.bumpPendingAttempts(key);
      }
      return data;
    } catch (e) {
      if (__DEV__) console.log('[IAP] verify network error:', e);
      await this.bumpPendingAttempts(key);
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
    try {
      const native = await this.iap.getAvailablePurchases();
      for (const p of native || []) {
        await this.handleIncomingPurchase(p, { silent: true });
      }
    } catch (e) {
      if (__DEV__) console.log('[IAP] getAvailablePurchases failed:', e);
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
