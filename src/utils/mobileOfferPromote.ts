import { API_URL } from '../config/network';

export type PromoteOfferResult =
  | { ok: true; promotedUntil: string }
  | { ok: false; status: number; message: string };

async function postPromote(url: string, token: string): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body };
}

export async function promoteMobileOfferListing(
  token: string,
  offerId: number,
): Promise<PromoteOfferResult> {
  const candidates = [
    `${API_URL}/api/offers/${offerId}/promote`,
    `${API_URL}/api/mobile/v1/offers/${offerId}/promote`,
  ];

  let lastStatus = 0;
  let lastMessage = 'Nie udało się wyróżnić ogłoszenia.';

  for (const url of candidates) {
    const { res, body } = await postPromote(url, token);
    if (res.status === 404) continue;

    if (res.ok && body?.success !== false) {
      const until = String(body?.promotedUntil || '').trim();
      if (until) return { ok: true, promotedUntil: until };
      return { ok: true, promotedUntil: new Date(Date.now() + 7 * 86400000).toISOString() };
    }

    lastStatus = res.status;
    lastMessage = String(body?.error || body?.message || lastMessage);
    if (res.status !== 404) break;
  }

  return { ok: false, status: lastStatus, message: lastMessage };
}
