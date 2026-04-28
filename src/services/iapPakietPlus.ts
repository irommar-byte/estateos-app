/**
 * Pakiet Plus — zakup konsumowalnego „slotu” przez App Store / Google Play.
 * WAŻNE: `react-native-iap` ładuje Nitro — nie importuj tego pakietu statycznie na poziomie pliku,
 * bo App.tsx importuje Step6 → i tak startuje cały graf; lazy import chroni Expo Go i zwykły start bez IAP.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Purchase } from 'react-native-iap';

const DEFAULT_PRODUCT_ID = 'pl.estateos.app.pakiet_plus_30d';

export function getPakietPlusProductId(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const id = extra?.iapPakietPlusProductId;
  return typeof id === 'string' && id.length > 0 ? id : DEFAULT_PRODUCT_ID;
}

/** Tekst marketingowy — rzeczywista kwota pochodzi ze sklepu (tier / Play). */
export const PAKIET_PLUS_PRICE_LABEL = '49 zł';

async function notifyBackendPakietPlusPurchase(
  apiUrl: string,
  token: string,
  purchase: Purchase
): Promise<boolean> {
  const base = apiUrl.replace(/\/$/, '');
  const body =
    Platform.OS === 'ios'
      ? {
          platform: 'ios',
          productId: purchase.productId,
          transactionId: 'transactionId' in purchase ? purchase.transactionId : undefined,
          jwsRepresentation: purchase.purchaseToken ?? undefined,
        }
      : {
          platform: 'android',
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken ?? undefined,
          transactionId: 'transactionId' in purchase ? purchase.transactionId : undefined,
        };

  try {
    const res = await fetch(`${base}/api/mobile/v1/iap/pakiet-plus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 404 || res.status === 501) return false;
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Boolean(data?.success ?? data?.ok ?? true);
  } catch {
    return false;
  }
}

export type PurchasePakietPlusResult =
  | { ok: true; backendRegistered: boolean }
  | { ok: false; cancelled?: boolean; message?: string };

type IapModule = typeof import('react-native-iap');

/** Expo Go (skan QR) — `storeClient`; dev client z `expo run:ios` / Xcode to zwykle `bare`. */
function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

/** `require` zamiast `import()` — Metro bywa gubi numer chunka („unknown module 3511”) przy async imporcie. */
function loadIapModule(): IapModule | null {
  try {
    return require('react-native-iap') as IapModule;
  } catch {
    return null;
  }
}

function nitroOrNativeHint(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('nitro') ||
    m.includes('turbo/native-module') ||
    m.includes('runtime not ready') ||
    (m.includes('native') && m.includes('could not be found'))
  );
}

/**
 * Uruchamia natywny sheet App Store / Google Play dla consumable Pakiet Plus,
 * kończy transakcję (finishTransaction) i opcjonalnie powiadamia backend.
 */
export async function purchasePakietPlusConsumable(apiUrl: string, token: string): Promise<PurchasePakietPlusResult> {
  const iap = loadIapModule();
  if (!iap) {
    if (isRunningInExpoGo()) {
      return {
        ok: false,
        message:
          'W Expo Go nie ma sklepu In-App — to normalne. Wybierz „Wykup na stronie (Stripe)” albo zbuduj aplikację z IAP: w katalogu projektu uruchom `npx expo run:ios` i otwórz ten build (nie Expo Go).',
      };
    }
    return {
      ok: false,
      message:
        'Sklep In-App się nie podłączył. Zwykle: uruchamiasz ten sam JS przez aplikację „Expo Go” (QR) — wtedy nie ma IAP. Otwórz **EstateOS** z ikony po `expo run:ios` / z Xcode (Run), nie Expo Go. Jeśli na pewno z niej korzystasz: Clean Build w Xcode, `cd ios && pod install`, przebuduj.',
    };
  }

  const {
    ErrorCode,
    fetchProducts,
    finishTransaction,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    isUserCancelledError,
  } = iap;

  const productId = getPakietPlusProductId();

  let connected = false;
  try {
    connected = await initConnection();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (nitroOrNativeHint(msg)) {
      return {
        ok: false,
        message:
          'In-App Purchase wymaga aplikacji zbudowanej natywnie (np. npx expo run:ios lub EAS Build). Po dodaniu IAP uruchom: npx expo prebuild --clean, potem ponowny build i instalację na urządzeniu. Expo Go nie zawiera NitroModules.',
      };
    }
    return { ok: false, message: msg || 'Nie udało się połączyć ze sklepem.' };
  }

  if (!connected) {
    return { ok: false, message: 'Brak połączenia ze sklepem (sprawdź ustawienia lub spróbuj ponownie).' };
  }

  try {
    const products = await fetchProducts({ skus: [productId], type: 'in-app' });
    if (!products?.length) {
      return {
        ok: false,
        message:
          `Produkt „${productId}” nie jest dostępny w sklepie. Utwórz consumable w App Store Connect / Play Console i zsynchronizuj.`,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg || 'Nie udało się pobrać produktów ze sklepu.' };
  }

  let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener> | undefined;
  let purchaseErrSub: ReturnType<typeof purchaseErrorListener> | undefined;

  const outcome = await new Promise<{ purchase: Purchase } | { error: unknown }>((resolve) => {
    let settled = false;

    const done = (v: { purchase: Purchase } | { error: unknown }) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    purchaseUpdateSub = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== productId) return;
      done({ purchase });
    });

    purchaseErrSub = purchaseErrorListener((error) => {
      done({ error });
    });

    requestPurchase({
      request:
        Platform.OS === 'ios'
          ? { apple: { sku: productId } }
          : { google: { skus: [productId] } },
      type: 'in-app',
    }).catch((err) => done({ error: err }));
  });

  purchaseUpdateSub?.remove();
  purchaseErrSub?.remove();

  if ('error' in outcome && outcome.error != null) {
    const err = outcome.error as { code?: string; message?: string };
    if (isUserCancelledError(outcome.error) || err?.code === ErrorCode.UserCancelled) {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      message: typeof err?.message === 'string' ? err.message : 'Zakup został przerwany lub nie powiódł się.',
    };
  }

  const purchase = (outcome as { purchase: Purchase }).purchase;

  let backendRegistered = false;
  try {
    backendRegistered = await notifyBackendPakietPlusPurchase(apiUrl, token, purchase);
  } catch {
    backendRegistered = false;
  }

  try {
    await finishTransaction({ purchase, isConsumable: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Transakcja sklepowa wymaga domknięcia: ${msg}. Skontaktuj się z pomocą lub spróbuj przywrócić zakupy.`,
    };
  }

  return { ok: true, backendRegistered };
}
