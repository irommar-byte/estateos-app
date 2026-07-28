import { API_URL } from '../config/network';

export type PromoteOfferResult =
  | { ok: true; promotedUntil: string; credits: number; days: number }
  | { ok: false; status: number; message: string };

async function postPromote(
  url: string,
  token: string,
  credits: number,
): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credits }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body };
}

export async function promoteMobileOfferListing(
  token: string,
  offerId: number,
  credits = 1,
): Promise<PromoteOfferResult> {
  const safeCredits = Math.max(1, Math.min(12, Math.floor(Number(credits) || 1)));
  const candidates = [
    `${API_URL}/api/offers/${offerId}/promote`,
    `${API_URL}/api/mobile/v1/offers/${offerId}/promote`,
  ];

  let lastStatus = 0;
  let lastMessage = 'Nie udało się wyróżnić ogłoszenia.';

  for (const url of candidates) {
    const { res, body } = await postPromote(url, token, safeCredits);
    if (res.status === 404) continue;

    if (res.ok && body?.success !== false) {
      const until = String(body?.promotedUntil || '').trim();
      const days = Math.max(7, Math.floor(Number(body?.days) || safeCredits * 7));
      const used = Math.max(1, Math.floor(Number(body?.credits) || safeCredits));
      if (until) return { ok: true, promotedUntil: until, credits: used, days };
      return {
        ok: true,
        promotedUntil: new Date(Date.now() + days * 86400000).toISOString(),
        credits: used,
        days,
      };
    }

    lastStatus = res.status;
    lastMessage = String(body?.error || body?.message || lastMessage);
    if (res.status !== 404) break;
  }

  return { ok: false, status: lastStatus, message: lastMessage };
}
