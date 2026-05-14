/**
 * ====================================================================
 *  EstateOS™ — Klient REST dla weryfikacji prawnej oferty
 * ====================================================================
 *
 *  Cienka warstwa nad `fetch` — opakowuje endpointy z
 *  `contracts/legalVerificationContract.ts`, dodaje token, parsuje
 *  odpowiedź zgodnie z kontraktem. Cała logika domenowa (state machine,
 *  walidacja) siedzi w kontrakcie; tutaj tylko I/O.
 *
 *  Założenia:
 *    • Funkcje są fire-and-throw — w razie błędu HTTP rzucają z `message`
 *      jakie UI może pokazać użytkownikowi.
 *    • Nigdy nie loguje pełnych odpowiedzi w produkcji — wrażliwe pola
 *      (numer KW, nr mieszkania) NIE LĄDUJĄ w consoli.
 *    • Network errors są mapowane na `LegalVerificationServiceError`
 *      z `code: 'NETWORK'`, żeby warstwa wyżej mogła pokazać retry.
 */

import { API_URL } from '../config/network';
import {
  LEGAL_VERIFICATION_ENDPOINTS,
  type AdminApproveLegalVerificationPayload,
  type AdminLegalVerificationQueueItem,
  type AdminLegalVerificationQueueResponse,
  type AdminRejectLegalVerificationPayload,
  type LegalVerificationStatus,
  type OfferLegalVerificationView,
  type SubmitLegalVerificationPayload,
  parseOfferLegalVerificationView,
} from '../contracts/legalVerificationContract';

export type LegalVerificationServiceErrorCode =
  | 'NETWORK'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SERVER'
  | 'UNKNOWN';

export class LegalVerificationServiceError extends Error {
  readonly code: LegalVerificationServiceErrorCode;
  readonly status: number | null;

  constructor(code: LegalVerificationServiceErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'LegalVerificationServiceError';
    this.code = code;
    this.status = status;
  }
}

function mapHttpStatusToCode(status: number): LegalVerificationServiceErrorCode {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (init.token) headers['Authorization'] = `Bearer ${init.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (err: any) {
    throw new LegalVerificationServiceError(
      'NETWORK',
      err?.message || 'Brak połączenia z serwerem',
      null,
    );
  }

  if (!response.ok) {
    const status = response.status;
    let serverMsg: string | null = null;
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string' && body.message.trim()) serverMsg = body.message.trim();
      else if (body && typeof body.error === 'string' && body.error.trim()) serverMsg = body.error.trim();
      else if (typeof body?.detail === 'string' && body.detail.trim()) serverMsg = body.detail.trim();
    } catch {
      /* ignore — brak ciała / nie JSON (np. strona HTML przy 404) */
    }
    const fallback =
      status === 401
        ? 'Sesja wygasła lub brak autoryzacji. Wyloguj się i zaloguj ponownie.'
        : status === 403
          ? 'Brak uprawnień administratora do weryfikacji prawnej.'
          : status === 404
            ? 'Nie znaleziono zasobu (404). Sprawdź, czy na backendzie jest wdrożony endpoint /api/mobile/v1/admin/legal-verification.'
          : status >= 500
            ? 'Błąd serwera. Spróbuj ponownie za chwilę.'
            : `Żądanie nie powiodło się (HTTP ${status}).`;
    throw new LegalVerificationServiceError(
      mapHttpStatusToCode(status),
      serverMsg || fallback,
      status,
    );
  }

  // Endpointy mogą zwracać 204 No Content (np. po approve).
  if (response.status === 204) return undefined as unknown as T;

  try {
    return (await response.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}

// ====================================================================
//  OWNER endpoints
// ====================================================================

/**
 * Pobiera aktualny stan weryfikacji dla danej oferty.
 *
 * Backend MOŻE zwrócić 404, jeśli oferta jeszcze nie ma żadnej weryfikacji
 * w tabeli audytu — wtedy front sam tworzy „pusty" widok ze statusem 'NONE'.
 * To wygodniejsze niż wymuszać po stronie back-endu seedowanie pustych
 * rekordów dla każdej oferty.
 */
export async function fetchOwnerLegalVerification(
  offerId: number,
  token: string | null,
): Promise<OfferLegalVerificationView> {
  try {
    const raw = await request<any>(LEGAL_VERIFICATION_ENDPOINTS.ownerStatus(offerId), {
      method: 'GET',
      token,
    });
    return parseOfferLegalVerificationView(raw ?? {}, offerId);
  } catch (err) {
    if (err instanceof LegalVerificationServiceError && err.code === 'NOT_FOUND') {
      return parseOfferLegalVerificationView({ offerId, status: 'NONE' }, offerId);
    }
    throw err;
  }
}

/**
 * Właściciel zgłasza KW + nr mieszkania do weryfikacji.
 * Idempotentne: jeśli już PENDING, backend zwraca aktualny widok bez
 * tworzenia duplikatu wpisu (patrz `deploy/HANDOFF_LEGAL_VERIFICATION.md`).
 */
export async function submitOwnerLegalVerification(
  offerId: number,
  payload: SubmitLegalVerificationPayload,
  token: string | null,
): Promise<OfferLegalVerificationView> {
  const raw = await request<any>(LEGAL_VERIFICATION_ENDPOINTS.ownerSubmit(offerId), {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
  return parseOfferLegalVerificationView(raw ?? {}, offerId);
}

// ====================================================================
//  ADMIN endpoints — wymagają `user.role === 'ADMIN'`
// ====================================================================

export async function fetchAdminLegalVerificationQueue(
  status: LegalVerificationStatus,
  token: string | null,
): Promise<AdminLegalVerificationQueueItem[]> {
  const raw = await request<any>(LEGAL_VERIFICATION_ENDPOINTS.adminQueue(status), {
    method: 'GET',
    token,
  });
  if (!raw || !Array.isArray(raw.items)) return [];
  return (raw as AdminLegalVerificationQueueResponse).items;
}

export async function approveLegalVerification(
  offerId: number,
  payload: AdminApproveLegalVerificationPayload,
  token: string | null,
): Promise<OfferLegalVerificationView> {
  const raw = await request<any>(LEGAL_VERIFICATION_ENDPOINTS.adminApprove(offerId), {
    method: 'POST',
    token,
    body: JSON.stringify(payload ?? {}),
  });
  return parseOfferLegalVerificationView(raw ?? {}, offerId);
}

export async function rejectLegalVerification(
  offerId: number,
  payload: AdminRejectLegalVerificationPayload,
  token: string | null,
): Promise<OfferLegalVerificationView> {
  const raw = await request<any>(LEGAL_VERIFICATION_ENDPOINTS.adminReject(offerId), {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
  return parseOfferLegalVerificationView(raw ?? {}, offerId);
}
