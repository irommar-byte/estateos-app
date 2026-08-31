/**
 * Wspólna logika dla pushy, Universal Links i custom scheme (estateos://).
 * Ścieżka /o/:id — publiczna wizytówka oferty na www.
 */

import { API_URL } from '../config/network';

export function extractIdFromDeeplink(deeplink: string, kind: 'offer' | 'deal' | 'car'): string | null {
  if (!deeplink) return null;
  const cleaned = deeplink.trim();
  if (!cleaned) return null;

  const pathRegexes =
    kind === 'offer'
      ? [
          /^estateos:\/\/o\/([^/?#]+)/i,
          /\/o\/([^/?#]+)/i,
          /\/offer\/([^/?#]+)/i,
          /offers?\/(\d+)/i,
          /oferta\/(\d+)/i,
          /listing\/(\d+)/i,
          /property\/(\d+)/i,
        ]
      : kind === 'car'
        ? [
            /^estateos:\/\/car\/([^/?#]+)/i,
            /\/car\/([^/?#]+)/i,
            /cars?\/(\d+)/i,
            /auto\/(\d+)/i,
          ]
      : [/deals?\/(\d+)/i, /dealroom\/(\d+)/i, /chat\/(\d+)/i, /thread\/(\d+)/i, /conversation\/(\d+)/i];

  for (const rx of pathRegexes) {
    const m = cleaned.match(rx);
    if (m?.[1]) return m[1];
  }

  try {
    const normalized = cleaned.includes('://') ? cleaned : `${API_URL.replace(/\/$/, '')}/${cleaned.replace(/^\//, '')}`;
    const u = new URL(normalized);

    if (kind === 'offer') {
      if (u.protocol === 'estateos:' && String(u.hostname || '').toLowerCase() === 'o') {
        const seg = u.pathname.replace(/^\//, '');
        if (seg) return decodeURIComponent(seg);
      }
      const om = u.pathname.match(/\/o\/([^/]+)/);
      if (om?.[1]) return om[1];
      const offerAlt = u.pathname.match(/^\/(?:offer|oferta)\/([^/]+)/i);
      if (offerAlt?.[1]) return offerAlt[1];
      return (
        u.searchParams.get('offerId') ||
        u.searchParams.get('offer_id') ||
        u.searchParams.get('listingId') ||
        u.searchParams.get('propertyId') ||
        u.searchParams.get('id')
      );
    }

    if (kind === 'car') {
      if (u.protocol === 'estateos:' && String(u.hostname || '').toLowerCase() === 'car') {
        const seg = u.pathname.replace(/^\//, '');
        if (seg) return decodeURIComponent(seg);
      }
      const cm = u.pathname.match(/\/(?:car|auto)\/([^/]+)/i);
      if (cm?.[1]) return cm[1];
      return u.searchParams.get('carId') || u.searchParams.get('car_id') || u.searchParams.get('id');
    }

    const dm = u.pathname.match(/\/(?:deal|dealroom|chat)\/([^/]+)/i);
    if (dm?.[1]) return dm[1];

    return (
      u.searchParams.get('dealId') ||
      u.searchParams.get('deal_id') ||
      u.searchParams.get('chatId') ||
      u.searchParams.get('threadId') ||
      u.searchParams.get('conversationId') ||
      u.searchParams.get('id')
    );
  } catch {
    return null;
  }
}

const PORTAL_TOKEN_RE = /^[a-f0-9]{32,64}$/i;

/** Universal Link /klient/:token oraz estateos://klient/:token */
export function extractPortalTokenFromDeeplink(raw: string): string | null {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return null;
  const pathMatch = cleaned.match(/(?:^|[/:])klient\/([a-f0-9]{32,64})(?:[/?#]|$)/i);
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase();
  try {
    const normalized = cleaned.includes('://') ? cleaned : `${API_URL.replace(/\/$/, '')}/${cleaned.replace(/^\//, '')}`;
    const url = new URL(normalized);
    if (url.protocol === 'estateos:' && String(url.hostname || '').toLowerCase() === 'klient') {
      const seg = url.pathname.replace(/^\//, '').split('/')[0] || '';
      if (PORTAL_TOKEN_RE.test(seg)) return seg.toLowerCase();
    }
    const fromPath = url.pathname.match(/\/klient\/([a-f0-9]{32,64})/i);
    if (fromPath?.[1]) return fromPath[1].toLowerCase();
    const fromQuery = String(url.searchParams.get('portalToken') || url.searchParams.get('portal') || '');
    if (PORTAL_TOKEN_RE.test(fromQuery)) return fromQuery.toLowerCase();
  } catch {
    return null;
  }
  return null;
}
