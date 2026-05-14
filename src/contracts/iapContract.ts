/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  EstateOS™ — KONTRAKT IN-APP PURCHASE                                ║
 * ║  Single source of truth między aplikacją mobilną a backendem.        ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                       ║
 * ║  Plik definiuje WSZYSTKIE typy + endpointy które backend (Vercel,    ║
 * ║  Next.js API) musi mieć, żeby Apple App Store i Google Play          ║
 * ║  zaakceptowały aplikację.                                             ║
 * ║                                                                       ║
 * ║  GWARANCJE OD STRONY BACKENDU (wymagania Apple Review 3.1.1 / 3.1.2):║
 * ║                                                                       ║
 * ║  ① WALIDACJA TRANSAKCJI NATYWNIE:                                    ║
 * ║     - iOS:     weryfikacja `jwsRepresentation` (StoreKit 2 JWT)     ║
 * ║                 przez Apple App Store Server API                      ║
 * ║                 (https://api.storekit.itunes.apple.com).              ║
 * ║     - Android: weryfikacja `purchaseToken` przez Google Play          ║
 * ║                 Developer API (purchases.products.get).               ║
 * ║                                                                       ║
 * ║  ② IDEMPOTENCJA: ten sam `transactionId` (iOS) lub `purchaseToken`   ║
 * ║     (Android) nie może być policzony dwa razy. Backend trzyma         ║
 * ║     unique constraint w bazie.                                        ║
 * ║                                                                       ║
 * ║  ③ ATOMOWOŚĆ: po WERYFIKACJI z Apple/Google backend ZAPISUJE          ║
 * ║     transakcję w bazie i ZWIĘKSZA `extraListings` użytkownika         ║
 * ║     (lub przedłuża `plusExpiresAt`) w jednej transakcji DB.           ║
 * ║                                                                       ║
 * ║  ④ ODPOWIEDŹ ≤ 5 s. Jeśli weryfikacja Apple/Google trwa dłużej,      ║
 * ║     backend musi zwrócić `202 Pending` z `pendingPurchaseId` —        ║
 * ║     aplikacja będzie pollować `GET /iap/status/{id}`.                 ║
 * ║                                                                       ║
 * ║  Jeśli backend NIE potwierdzi zakupu w 30 s, frontend ZAPISUJE       ║
 * ║  niezakończoną transakcję w AsyncStorage i ponawia w tle             ║
 * ║  (przy starcie, przy foreground, co 60 s w background). Apple        ║
 * ║  NIE zamknie tej transakcji (`finishTransaction` jest wstrzymany),   ║
 * ║  więc system sam zwróci event przy następnym otwarciu aplikacji.     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ---------------------------------------------------------------------------
//  PRODUKTY (zarejestrowane w App Store Connect / Play Console)
// ---------------------------------------------------------------------------

/** Identyfikatory produktów wg konwencji `pl.estateos.app.<typ>_<okres>`. */
export const IAP_PRODUCT_IDS = {
  /** Consumable: dodaje 1 slot publikacji na 30 dni. */
  PAKIET_PLUS_30D: 'pl.estateos.app.pakiet_plus_30d',
} as const;

export type IapProductId = (typeof IAP_PRODUCT_IDS)[keyof typeof IAP_PRODUCT_IDS];

/** Logiczna nazwa produktu — używana do mapowania backend → UI. */
export type IapProductKind = 'PAKIET_PLUS_30D';

export function getProductKind(productId: string): IapProductKind | null {
  if (productId === IAP_PRODUCT_IDS.PAKIET_PLUS_30D) return 'PAKIET_PLUS_30D';
  return null;
}

// ---------------------------------------------------------------------------
//  REQUEST: zgłoszenie zakupu do backendu po sukcesie StoreKit/Play
// ---------------------------------------------------------------------------

/**
 * Body dla `POST /api/mobile/v1/iap/verify`.
 * Frontend wysyła PO sukcesie z natywnego sklepu, PRZED `finishTransaction`.
 * Backend musi zweryfikować z Apple/Google i zapisać slot/wpis.
 */
export type IapVerifyRequest =
  | {
      platform: 'ios';
      productId: IapProductId;
      /** UUID transakcji App Store (StoreKit 2: `transaction.id`). */
      transactionId: string;
      /** Original transaction ID — dla subscription renewals. Dla
       *  consumable zwykle równa się `transactionId`. */
      originalTransactionId?: string;
      /** JWS Representation (StoreKit 2) — JWT podpisany przez Apple.
       *  TO JEST KLUCZOWE DO WERYFIKACJI po stronie backendu! */
      jwsRepresentation: string;
      /** Aliasy dla backendu mobile: ten sam StoreKit JWS pod nazwą receipt/receiptData. */
      receipt?: string;
      receiptData?: string;
      /** Opcjonalne ID pending, jeśli frontend ponawia wcześniej zapisany zakup. */
      pendingPurchaseId?: string;
      /** Identyfikator urządzenia dla anti-fraud (opcjonalne). */
      deviceId?: string;
    }
  | {
      platform: 'android';
      productId: IapProductId;
      /** Token zakupu z Google Play Billing. */
      purchaseToken: string;
      /** Order ID z Google Play (jeśli dostępne). */
      transactionId?: string;
      deviceId?: string;
    };

// ---------------------------------------------------------------------------
//  RESPONSE: potwierdzenie backendu
// ---------------------------------------------------------------------------

export type IapVerifyResponse =
  | {
      success: true;
      /** ECHO produktu — frontend potwierdza zgodność. */
      productId: IapProductId;
      /** ECHO transakcji — frontend zapisuje, żeby nie wysłać 2x. */
      transactionId: string;
      /** Aktualna liczba dodatkowych slotów po zaksięgowaniu zakupu. */
      extraListings?: number;
      /** Data wygaśnięcia Pakietu Plus (ISO 8601) — gdy plan time-based. */
      plusExpiresAt?: string | null;
      /** Czy backend POTWIERDZIŁ weryfikację z Apple/Google.
       *  - true → transakcja zaksięgowana atomowo, można `finishTransaction`
       *  - false → backend przyjął zgłoszenie, ale czeka na Apple/Google */
      verified: boolean;
      /** Gdy `verified=false`, ID do pollingu statusu. */
      pendingPurchaseId?: string;
    }
  | {
      success: false;
      /** Kod błędu — kontrakt: */
      errorCode:
        | 'INVALID_RECEIPT'        // JWS nie przeszedł walidacji Apple
        | 'DUPLICATE_TRANSACTION'  // Idempotencja: ten transactionId już zaksięgowany
        | 'PRODUCT_MISMATCH'       // productId w receipt nie zgadza się z body
        | 'USER_NOT_FOUND'         // Token JWT użytkownika niepoprawny
        | 'INTERNAL_ERROR'         // Backend padł
        | 'VERIFY_TIMEOUT';        // Apple/Google nie odpowiedziało
      message: string;
      /** Czy frontend powinien retry. true = network/timeout, false = trwały błąd. */
      shouldRetry: boolean;
    };

// ---------------------------------------------------------------------------
//  RESPONSE dla `GET /api/mobile/v1/iap/status/{pendingPurchaseId}`
// ---------------------------------------------------------------------------

export type IapStatusResponse =
  | { status: 'PENDING'; pendingPurchaseId: string }
  | { status: 'VERIFIED'; pendingPurchaseId: string; result: Extract<IapVerifyResponse, { success: true }> }
  | { status: 'FAILED'; pendingPurchaseId: string; errorCode: string; message: string };

// ---------------------------------------------------------------------------
//  ENDPOINTY
// ---------------------------------------------------------------------------

export const IAP_ENDPOINTS = {
  /**
   * Weryfikacja zakupu po sukcesie StoreKit/Play.
   * Body: `IapVerifyRequest`. Wymaga Bearer token użytkownika.
   * Backend MUSI:
   *  1. Zweryfikować `jwsRepresentation` z Apple App Store Server API.
   *  2. Sprawdzić idempotencję po `transactionId`.
   *  3. Atomowo zaksięgować slot/wpis w DB.
   *  4. Zwrócić `IapVerifyResponse`.
   */
  VERIFY: '/api/mobile/v1/iap/verify',

  /**
   * Status pending purchase (gdy backend nie zdążył zweryfikować w 5 s).
   * Frontend pollluje co 3 s do 60 s max.
   */
  STATUS: (pendingPurchaseId: string) =>
    `/api/mobile/v1/iap/status/${encodeURIComponent(pendingPurchaseId)}`,
} as const;
