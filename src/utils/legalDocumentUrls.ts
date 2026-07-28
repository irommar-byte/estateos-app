import { Linking } from 'react-native';

import type { AppLocale } from '../i18n/types';
import { getEffectiveAppLocale } from '../store/useAppLocaleStore';
import { SITE_ORIGIN } from './offerShareUrls';

/** Ścieżki WWW: PL (root), EN (`/en`), UA (`/uk`) — app locale `ru` → `/uk`. */
export type LegalWebLocale = 'pl' | 'en' | 'uk';

export function legalWebLocale(appLocale?: AppLocale): LegalWebLocale {
  const locale = appLocale ?? getEffectiveAppLocale();
  if (locale === 'en') return 'en';
  if (locale === 'ru') return 'uk';
  return 'pl';
}

function withWebLocale(path: string, webLocale: LegalWebLocale): string {
  const base = `${SITE_ORIGIN}${path}`;
  if (webLocale === 'pl') return base;
  return `${base}/${webLocale}`;
}

export function termsDocumentUrl(appLocale?: AppLocale): string {
  return withWebLocale('/regulamin', legalWebLocale(appLocale));
}

export function privacyDocumentUrl(appLocale?: AppLocale): string {
  return withWebLocale('/polityka-prywatnosci', legalWebLocale(appLocale));
}

export async function openLegalDocument(
  kind: 'terms' | 'privacy',
  appLocale?: AppLocale,
): Promise<void> {
  const url = kind === 'terms' ? termsDocumentUrl(appLocale) : privacyDocumentUrl(appLocale);
  await Linking.openURL(url);
}
