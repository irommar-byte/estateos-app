import type { Locale } from '@/i18n/config';
import { numberFormatLocale } from '@/i18n/config';
import { PORTAL_EN } from '@/i18n/portal/en';
import { PORTAL_UK } from '@/i18n/portal/uk';

export type PortalVars = Record<string, string | number | null | undefined>;

const DICTS: Record<Locale, Record<string, string> | null> = { pl: null, en: PORTAL_EN, uk: PORTAL_UK };

function fill(text: string, vars?: PortalVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (vars[key] == null ? match : String(vars[key])));
}

/**
 * Tekst panelu klienta w wybranym języku. Kluczem jest polskie zdanie (tak, jak stoi w kodzie),
 * więc brak tłumaczenia zawsze pokazuje poprawny polski, a nie pusty klucz.
 */
export function portalTranslate(locale: Locale, text: string, vars?: PortalVars): string {
  const dict = DICTS[locale];
  return fill((dict && dict[text]) || text, vars);
}

/** Polska i ukraińska odmiana: 1 / 2–4 / 5+ (z wyjątkiem 12–14). */
function slavicIndex(n: number): 0 | 1 | 2 {
  const abs = Math.abs(n);
  if (abs === 1) return 0;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2;
}

/**
 * Liczebnik z odmianą: `plural('pl', 3, 'oferta|oferty|ofert')` → „oferty”.
 * Słownik EN ma dla tego klucza „offer|offers”, UK — trzy formy jak polski.
 */
export function portalPlural(locale: Locale, n: number, plForms: string): string {
  const forms = portalTranslate(locale, plForms).split('|');
  if (locale === 'en') return forms[n === 1 ? 0 : 1] ?? forms[0];
  return forms[slavicIndex(n)] ?? forms[forms.length - 1];
}

export function portalDateLocale(locale: Locale): string {
  return numberFormatLocale(locale);
}

/** Funkcje tłumaczące panelu — przekazywane do funkcji pomocniczych spoza Reacta (domyślnie polski). */
export type PortalTr = { t: (text: string, vars?: PortalVars) => string; p: (n: number, forms: string) => string; dateLocale: string };

export function portalTr(locale: Locale): PortalTr {
  return {
    t: (text, vars) => portalTranslate(locale, text, vars),
    p: (n, forms) => portalPlural(locale, n, forms),
    dateLocale: portalDateLocale(locale),
  };
}

export const PORTAL_TR_PL: PortalTr = portalTr('pl');
