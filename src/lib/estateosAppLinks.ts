export const ESTATEOS_APP_STORE_ID = '6762899098';

export const ESTATEOS_APP_STORE_URL = 'https://apps.apple.com/app/id6762899098';

/** Facebook / Instagram IAB otwiera App Store pewniej przez itms-apps niż https. */
export const ESTATEOS_APP_STORE_ITMS_URL = `itms-apps://itunes.apple.com/app/id${ESTATEOS_APP_STORE_ID}`;

export const ESTATEOS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=pl.estateos.mobile';

export const ESTATEOS_ANDROID_PACKAGE = 'pl.estateos.mobile';

export function buildOfferAppSchemeUrl(offerId: number | string): string {
  return `estateos://o/${offerId}`;
}

export function extractOfferIdFromHref(href: string): number | null {
  const raw = String(href || '').trim();
  if (!raw) return null;
  const pathMatch = raw.match(/\/(?:oferta|o|offer)\/(\d+)/i);
  if (pathMatch?.[1]) {
    const id = Number(pathMatch[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(raw, 'https://estateos.pl');
    const fromQuery = url.searchParams.get('offerId') || url.searchParams.get('offer_id');
    if (fromQuery) {
      const id = Number(fromQuery);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function buildIosAppOpenUrl(offerId?: number | null): string {
  if (offerId != null && Number(offerId) > 0) return buildOfferAppSchemeUrl(offerId);
  return 'estateos://';
}

/**
 * Ręczny CTA z IAB: najpierw custom scheme (oferta, jeśli jest w URL),
 * a gdy apka nie przejęła widoku — App Store. Nie wołać automatycznie.
 */
export function openIosAppOrAppStore(opts?: { offerId?: number | null; href?: string }): void {
  if (typeof window === 'undefined') return;
  const offerId =
    opts?.offerId ?? extractOfferIdFromHref(opts?.href || window.location.href);
  let leftPage = false;
  const markLeft = () => {
    leftPage = true;
  };
  document.addEventListener('visibilitychange', markLeft);
  window.addEventListener('pagehide', markLeft);
  window.location.href = buildIosAppOpenUrl(offerId);
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markLeft);
    window.removeEventListener('pagehide', markLeft);
    if (leftPage || document.hidden) return;
    window.location.href = ESTATEOS_APP_STORE_ITMS_URL;
  }, 1400);
}

export function buildOfferAndroidIntentUrl(offerId: number | string, fallbackUrl?: string): string {
  const fallback = encodeURIComponent(fallbackUrl || ESTATEOS_PLAY_STORE_URL);
  return `intent://o/${offerId}#Intent;scheme=estateos;package=${ESTATEOS_ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export function buildAppleItunesAppMeta(offerCanonicalUrl: string): string {
  return `app-id=${ESTATEOS_APP_STORE_ID}, app-argument=${offerCanonicalUrl}`;
}

export function detectMobileAppContext(): {
  isIOS: boolean;
  isAndroid: boolean;
  isIOSSafari: boolean;
  showCustomBanner: boolean;
} {
  if (typeof navigator === 'undefined') {
    return { isIOS: false, isAndroid: false, isIOSSafari: false, showCustomBanner: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOSSafari =
    isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury|FBAN|FBAV|Instagram/i.test(ua);
  const showCustomBanner = (isIOS && !isIOSSafari) || isAndroid;
  return { isIOS, isAndroid, isIOSSafari, showCustomBanner };
}
