import { sanitizeOgStamp } from '@/lib/ogCardVersion';

/** Publiczne karty ogłoszeń — bez auto-escape IAB i bez pollingów tła. */
export function isPublicListingPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').split('?')[0];
  return (
    /^\/o\/\d+(\/karta)?\/?$/.test(path) ||
    /^\/o\/\d+\/og\/[a-zA-Z0-9-]+\/?$/.test(path) ||
    /^\/oferta\/\d+\/?$/.test(path) ||
    /^\/cars\/\d+\/?$/.test(path)
  );
}

type OfferShareLinkOpts = {
  presentingAgentId?: number | null;
  portalToken?: string | null;
  /** Price + title + updatedAt — must live in the PATH; Facebook ignores ?og= on the page URL. */
  ogStamp?: string | null;
};

function listingShareQuery(opts?: OfferShareLinkOpts): string {
  const qs = new URLSearchParams();
  const portal = String(opts?.portalToken || '').trim();
  const agentId = Number(opts?.presentingAgentId);
  if (portal) qs.set('portal', portal);
  else if (Number.isFinite(agentId) && agentId > 0) qs.set('agent', String(agentId));
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : '';
}

export function offerShareQuery(opts?: OfferShareLinkOpts): string {
  return listingShareQuery(opts);
}

/** Link do social / Messengera / Facebooka — pełna oferta pod tym samym URL co karta OG. */
export function offerSharePath(offerId: number, opts?: OfferShareLinkOpts): string {
  const stamp = sanitizeOgStamp(opts?.ogStamp);
  const qs = listingShareQuery(opts);
  if (stamp) return `/o/${offerId}/og/${stamp}${qs}`;
  return `/o/${offerId}${qs}`;
}

/** Wizytówka z QR, zdjęciem i danymi agenta — podgląd / druk, osobno od Facebooka. */
export function offerCardPreviewPath(offerId: number, opts?: OfferShareLinkOpts): string {
  return `/o/${offerId}/karta${offerShareQuery(opts)}`;
}
