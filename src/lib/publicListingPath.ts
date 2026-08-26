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
};

export function offerShareQuery(opts?: OfferShareLinkOpts): string {
  const qs = new URLSearchParams();
  const portal = String(opts?.portalToken || '').trim();
  const agentId = Number(opts?.presentingAgentId);
  if (portal) qs.set('portal', portal);
  else if (Number.isFinite(agentId) && agentId > 0) qs.set('agent', String(agentId));
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : '';
}

/** Link do social / Messengera / Facebooka — pełna oferta pod tym samym URL co karta OG. */
export function offerSharePath(offerId: number, opts?: OfferShareLinkOpts): string {
  return `/o/${offerId}${offerShareQuery(opts)}`;
}

/** Wizytówka z QR, zdjęciem i danymi agenta — podgląd / druk, osobno od Facebooka. */
export function offerCardPreviewPath(offerId: number, opts?: OfferShareLinkOpts): string {
  return `/o/${offerId}/karta${offerShareQuery(opts)}`;
}
