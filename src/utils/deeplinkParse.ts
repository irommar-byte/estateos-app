/**
 * Wspólna logika dla pushy, Universal Links i custom scheme (estateos://).
 * Ścieżka /o/:id — publiczna wizytówka oferty na www.
 */

export function extractIdFromDeeplink(deeplink: string, kind: 'offer' | 'deal'): string | null {
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
      : [/deals?\/(\d+)/i, /dealroom\/(\d+)/i, /chat\/(\d+)/i, /thread\/(\d+)/i, /conversation\/(\d+)/i];

  for (const rx of pathRegexes) {
    const m = cleaned.match(rx);
    if (m?.[1]) return m[1];
  }

  try {
    const normalized = cleaned.includes('://') ? cleaned : `https://estateos.pl/${cleaned.replace(/^\//, '')}`;
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
