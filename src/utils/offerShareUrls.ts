import { Platform, Share } from 'react-native';

export {
  SITE_ORIGIN,
  offerShareContentStamp,
  buildOfferLandingPageUrl,
  buildOfferAppDeepLink,
  buildCarLandingPageUrl,
  buildCarAppDeepLink,
  buildOfferShareMessage,
  buildCarShareMessage,
} from './offerShareLinks';

/**
 * Profesjonalny share pod Facebook / grupy:
 * wysyłamy **sam link** (bez własnego tekstu).
 * Dzięki temu FB scrapuje Open Graph i pokazuje kartę ze zdjęciem,
 * a nie goły post tekstowy z URL w treści.
 */
export async function shareListingLink(params: {
  url: string;
  /** Tytuł activity sheet (iOS) / chooser (Android) — nie trafia do treści posta FB. */
  sheetTitle?: string;
}): Promise<void> {
  const url = String(params.url || '').trim();
  if (!url) return;
  const sheetTitle = params.sheetTitle || 'EstateOS™';

  if (Platform.OS === 'ios') {
    await Share.share({ url, title: sheetTitle });
    return;
  }

  // Android: sam URL jako message — FB traktuje to jak udostępnienie linku.
  await Share.share({ message: url, title: sheetTitle });
}
