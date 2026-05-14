import { API_URL } from '../config/network';

/** Kształty odpowiedzi GET/PATCH/PUT — różne wersje backendu. */
export function extractMobileOfferJson(json: any): any | null {
  if (!json || typeof json !== 'object') return null;
  return (
    json.offer ??
    json.data?.offer ??
    (json.data && typeof json.data === 'object' && json.data.id != null ? json.data : null) ??
    (json.id != null ? json : null)
  );
}

export async function readMobileOfferResponseBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/**
 * Zapis oferty na mobile — backend w dokumentacji: PATCH `/offers/:id`;
 * starsze wdrożenia: PUT `/offers` lub PUT `/offers/:id`.
 */
export async function persistMobileOfferUpdate(options: {
  offerId: number;
  token: string;
  payload: Record<string, any>;
}): Promise<Response> {
  const { offerId, token, payload } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const id = Number(payload.id ?? offerId);
  if (!Number.isFinite(id) || id <= 0) {
    return new Response(null, { status: 400, statusText: 'Bad offer id' });
  }

  const patchBody = { ...payload };
  delete patchBody.id;

  let res = await fetch(`${API_URL}/api/mobile/v1/offers/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchBody),
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${API_URL}/api/mobile/v1/offers/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
  }
  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${API_URL}/api/mobile/v1/offers`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
  }
  return res;
}

export function isExplicitMobileOfferSaveFailure(data: any, resOk: boolean): boolean {
  if (!resOk) return true;
  if (data?.success === false || data?.ok === false) return true;
  return false;
}
