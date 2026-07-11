import { API_URL } from '../config/network';
import { normalizePriceHistoryRows, type OfferPriceHistoryPoint } from '../utils/offerPriceHistory';

export async function fetchOfferPriceHistory(
  offerId: number,
  token?: string | null,
): Promise<OfferPriceHistoryPoint[] | null> {
  if (!Number.isFinite(offerId) || offerId <= 0) return null;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const safeToken = String(token || '').trim();
  if (safeToken) {
    headers.Authorization = safeToken.startsWith('Bearer ') ? safeToken : `Bearer ${safeToken}`;
  }

  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}/price-history`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return normalizePriceHistoryRows(data?.history);
  } catch {
    return null;
  }
}
