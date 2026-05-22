import type {
  ActivateOfferPublicationResponse,
  OfferPublicationPayload,
  PublicationQuote,
} from '../contracts/offerPublicationContract';
import { t } from '../i18n';

export const PUBLICATION_ERROR_REQUIRES_PLUS = 'PUBLICATION_REQUIRES_PLUS';

/** Komunikaty UI — płatność za publiczne wystawienie tej oferty, nie slot/dni. */
export function getPublicationCopy() {
  return {
    paywallTitle: t('publication.paywallTitle'),
    paywallBody: t('publication.paywallBody'),
    paywallCta: t('publication.paywallCta'),
    archiveWarning: t('publication.archiveWarning'),
    reactivateTitle: t('publication.reactivateTitle'),
    reactivateBody: t('publication.reactivateBody'),
    publishAfterPurchase: t('publication.publishAfterPurchase'),
    restoreHint: t('publication.restoreHint'),
  };
}

function extractServerMessage(data: unknown, httpStatus: number): string | undefined {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  for (const key of ['message', 'error', 'detail'] as const) {
    const v = d[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (httpStatus > 0) return `Serwer zwrócił HTTP ${httpStatus}.`;
  return undefined;
}

function parseQuote(data: unknown, httpStatus = 0): PublicationQuote {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    offerId: d.offerId != null ? Number(d.offerId) : null,
    action: typeof d.action === 'string' ? d.action : undefined,
    requiresPayment: Boolean(d.requiresPayment),
    allowedFreeFirst: d.allowedFreeFirst === true,
    kind:
      d.kind === 'FREE_FIRST' || d.kind === 'PLUS_PAID' || d.kind === 'PLUS_CREDIT'
        ? d.kind
        : undefined,
    reason: typeof d.reason === 'string' ? d.reason : undefined,
    productId: typeof d.productId === 'string' ? d.productId : undefined,
    message: extractServerMessage(data, httpStatus),
  };
}

export type ReactivationQuoteDecision =
  | { action: 'block'; title: string; message: string }
  | { action: 'iap' }
  | { action: 'activate_free' };

/** Decyzja przed IAP przy „Wystaw ponownie” — quote jest pomocniczy, nie blokuje płatności przy awarii API. */
export function decideReactivationFromQuote(
  quoteRes: Awaited<ReturnType<typeof fetchPublicationQuote>>,
): ReactivationQuoteDecision {
  if (quoteRes.ok) {
    if (!quoteRes.quote.requiresPayment) {
      return { action: 'activate_free' };
    }
    return { action: 'iap' };
  }

  if (quoteRes.status === 0) {
    return {
      action: 'block',
      title: 'Brak połączenia',
      message: quoteRes.quote.message || 'Sprawdź internet i spróbuj ponownie.',
    };
  }

  if (quoteRes.status === 401 || quoteRes.status === 403) {
    return {
      action: 'block',
      title: 'Sesja wygasła',
      message: 'Zaloguj się ponownie i spróbuj wystawić ogłoszenie.',
    };
  }

  if (quoteRes.status === 404 || quoteRes.status === 405 || quoteRes.status >= 500) {
    return { action: 'iap' };
  }

  if (quoteRes.status === 400 || quoteRes.status === 422) {
    return {
      action: 'block',
      title: 'Nie można wystawić',
      message: quoteRes.quote.message || 'Serwer odrzucił ponowne wystawienie tej oferty.',
    };
  }

  return { action: 'iap' };
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
    return { ok: res.ok, status: res.status, quote: parseQuote(data, res.status) };
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
  iapTransactionId?: string,
): Promise<{ ok: boolean; status: number; body: ActivateOfferPublicationResponse }> {
  const base = apiUrl.replace(/\/$/, '');
  const tx = String(iapTransactionId || '').trim();
  const payload = tx
    ? { iapTransactionId: tx, consumePlusPublication: true }
    : {};
  try {
    const res = await fetch(`${base}/api/mobile/v1/offers/${offerId}/activate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
    return { kind: opts.quote.allowedFreeFirst ? 'FREE_FIRST' : 'PLUS_CREDIT' };
  }
  return undefined;
}
