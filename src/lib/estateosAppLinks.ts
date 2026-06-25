export const ESTATEOS_APP_STORE_ID = '6762899098';

export const ESTATEOS_APP_STORE_URL = 'https://apps.apple.com/app/id6762899098';

export const ESTATEOS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=pl.estateos.mobile';

export const ESTATEOS_ANDROID_PACKAGE = 'pl.estateos.mobile';

export function buildOfferAppSchemeUrl(offerId: number | string): string {
  return `estateos://o/${offerId}`;
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
