import { API_URL } from '../config/network';

/** Publiczny origin serwisu (bez /api). */
export const SITE_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/?.*$/i, '') || 'https://estateos.pl';

/**
 * Wizytówka www — na produkcji Next serwuje `public/offer-landing.html` pod `/o/:id` (Ten sam origin co API).
 */
export function buildOfferLandingPageUrl(offerId: number | string): string {
  const id = encodeURIComponent(String(offerId).trim());
  return `${SITE_ORIGIN}/o/${id}`;
}

/** Zgodny z wizytówką Next: `estateos://o/{id}` (host `o`, nie ścieżka `/oferta/`). */
export function buildOfferAppDeepLink(offerId: number | string): string {
  const id = String(offerId).trim();
  return `estateos://o/${id}`;
}

/**
 * Treść pod SMS / Messenger / e-mail / social: kanoniczny link wizytówki + skrót + promocja platformy.
 * Na iOS przekaż to samo `url` do Share.share (preview / AirDrop).
 */
export function buildOfferShareMessage(params: {
  title: string;
  /** Krótka linia ceny, np. „450 000 PLN” lub „Cena na zapytanie”. */
  priceLine: string;
  offerId: number | string;
}): { message: string; url: string } {
  const url = buildOfferLandingPageUrl(params.offerId);
  const title = params.title.trim();
  const price = params.priceLine.trim();
  const promo =
    'EstateOS™ — oferty, negocjacje Dealroom i czat w jednym miejscu. Ten link działa z wiadomości, maila i social media · https://estateos.pl';

  const lines = [`${title} — ${price}`, '', url, '', promo];
  return { message: lines.join('\n'), url };
}
