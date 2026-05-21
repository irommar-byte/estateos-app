import type {
  ActivateOfferPublicationResponse,
  OfferPublicationPayload,
  PublicationQuote,
} from '../contracts/offerPublicationContract';

export const PUBLICATION_ERROR_REQUIRES_PLUS = 'PUBLICATION_REQUIRES_PLUS';

/** Komunikaty UI — płatność za publiczne wystawienie tej oferty, nie slot/dni. */
export const PUBLICATION_COPY = {
  paywallTitle: 'Publiczne wystawienie ogłoszenia',
  paywallBody:
    'To ogłoszenie możesz wystawić na rynek (Radar) tylko po opłacie Pakiet Plus w sklepie aplikacji. ' +
    'Płatność dotyczy aktywacji tego konkretnego ogłoszenia na 30 dni — nie jest to abonament ani „slot” na koncie. ' +
    'Pierwsze publiczne wystawienie pierwszej oferty na koncie było bezpłatne.',
  paywallCta: 'Opłać wystawienie (Pakiet Plus)',
  archiveWarning:
    'Oferta zniknie z rynku. Niewykorzystany okres publicznej publikacji przepada. ' +
    'Ponowne wystawienie tego samego ogłoszenia na rynek wymaga Pakiet Plus.',
  reactivateTitle: 'Wystaw ponownie na rynek',
  reactivateBody:
    'Aktywujesz to ogłoszenie jako publiczne na 30 dni. Opłata Pakiet Plus dotyczy wyłącznie tego ogłoszenia (tego numeru ID).',
  publishAfterPurchase: 'Wystawiam ogłoszenie na rynek po opłacie…',
  restoreHint:
    'Zakup z Apple został przyjęty. Jeśli ogłoszenie nie weszło na rynek, użyj „Przywróć zakupy” i spróbuj ponownie — bez drugiej opłaty.',
} as const;

function parseQuote(data: unknown): PublicationQuote {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    offerId: d.offerId != null ? Number(d.offerId) : null,
    action: typeof d.action === 'string' ? d.action : undefined,
    requiresPayment: Boolean(d.requiresPayment),
    allowedFreeFirst: d.allowedFreeFirst === true,
    kind: d.kind === 'FREE_FIRST' || d.kind === 'PLUS_PAID' ? d.kind : undefined,
    reason: typeof d.reason === 'string' ? d.reason : undefined,
    productId: typeof d.productId === 'string' ? d.productId : undefined,
    message: typeof d.message === 'string' ? d.message : undefined,
  };
}

export async function fetchPublicationQuote(
  apiUrl: string,
  token: string,
  offerId?: number,
): Promise<{ ok: boolean; quote: PublicationQuote; status: number }> {
  const base = apiUrl.replace(/\/$/, '');
  const q =
    offerId != null && Number.isFinite(offerId) && offerId > 0
      ? `?offerId=${encodeURIComponent(String(offerId))}`
      : '';
  try {
    const res = await fetch(`${base}/api/mobile/v1/offers/publication-quote${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, quote: parseQuote(data) };
  } catch {
    return {
      ok: false,
      status: 0,
      quote: { requiresPayment: false, message: 'Brak połączenia z serwerem.' },
    };
  }
}

export async function activateOfferPublication(
  apiUrl: string,
  token: string,
  offerId: number,
  iapTransactionId: string,
): Promise<{ ok: boolean; status: number; body: ActivateOfferPublicationResponse }> {
  const base = apiUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/mobile/v1/offers/${offerId}/activate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        iapTransactionId,
        consumePlusPublication: true,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as ActivateOfferPublicationResponse;
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: 'Brak połączenia z serwerem.' } };
  }
}

export function isPublicationRequiresPlusError(err: unknown): boolean {
  const d = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const code = String(d.errorCode || d.code || '').toUpperCase();
  if (code === PUBLICATION_ERROR_REQUIRES_PLUS) return true;
  const msg = String(d.message || d.error || '').toLowerCase();
  return msg.includes('pakiet plus') || msg.includes('publication');
}

export function buildCreatePublicationPayload(opts: {
  plusTransactionId?: string | null;
  quote?: PublicationQuote | null;
}): OfferPublicationPayload | undefined {
  const tx = String(opts.plusTransactionId || '').trim();
  if (tx) {
    return {
      kind: 'PLUS_PAID',
      iapTransactionId: tx,
      consumePlusPublication: true,
    };
  }
  if (opts.quote && !opts.quote.requiresPayment) {
    return { kind: 'FREE_FIRST' };
  }
  return undefined;
}
