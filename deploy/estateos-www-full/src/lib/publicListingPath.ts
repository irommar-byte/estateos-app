import { sanitizeOgStamp } from '@/lib/ogCardVersion';

/** Publiczne karty ogłoszeń — bez auto-escape IAB i bez pollingów tła. */
export function isPublicListingPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').split('?')[0];
  return (
    /^\/o\/\d+(\/karta)?\/?$/.test(path) ||
    /^\/oferta\/\d+\/?$/.test(path) ||
    /^\/cars\/\d+\/?$/.test(path)
  );
}

type OfferShareLinkOpts = {
  presentingAgentId?: number | null;
  portalToken?: string | null;
  /** Price + updatedAt stamp — Facebook caches the pasted URL, so it must change after a price edit. */
  ogStamp?: string | null;
};

function listingShareQuery(opts?: OfferShareLinkOpts, includeOgStamp = false): string {
  const qs = new URLSearchParams();
  const portal = String(opts?.portalToken || '').trim();
  const agentId = Number(opts?.presentingAgentId);
  if (portal) qs.set('portal', portal);
  else if (Number.isFinite(agentId) && agentId > 0) qs.set('agent', String(agentId));
  if (includeOgStamp) {
    const stamp = sanitizeOgStamp(opts?.ogStamp);
    if (stamp) qs.set('og', stamp);
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : '';
}

export function offerShareQuery(opts?: OfferShareLinkOpts): string {
  return listingShareQuery(opts, false);
}

/** Link do social / Messengera / Facebooka — pełna oferta pod tym samym URL co karta OG. */
export function offerSharePath(offerId: number, opts?: OfferShareLinkOpts): string {
  return `/o/${offerId}${listingShareQuery(opts, true)}`;
}

/** Wizytówka z QR, zdjęciem i danymi agenta — podgląd / druk, osobno od Facebooka. */
export function offerCardPreviewPath(offerId: number, opts?: OfferShareLinkOpts): string {
  return `/o/${offerId}/karta${offerShareQuery(opts)}`;
}
