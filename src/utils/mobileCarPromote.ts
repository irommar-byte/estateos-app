import { API_URL } from '../config/network';

export type PromoteCarResult =
  | { ok: true; promotedUntil: string; credits: number; days: number }
  | { ok: false; status: number; message: string };

export async function promoteMobileCarListing(
  token: string,
  carId: number,
  credits = 1,
): Promise<PromoteCarResult> {
  const safeCredits = Math.max(1, Math.min(12, Math.floor(Number(credits) || 1)));
  const res = await fetch(`${API_URL}/api/cars/${carId}/promote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credits: safeCredits }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

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

  return {
    ok: false,
    status: res.status,
    message: String(body?.error || body?.message || 'Nie udało się wyróżnić ogłoszenia auta.'),
  };
}
