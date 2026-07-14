import { API_URL } from '../config/network';

export type PromoteCarResult =
  | { ok: true; promotedUntil: string }
  | { ok: false; status: number; message: string };

export async function promoteMobileCarListing(
  token: string,
  carId: number,
): Promise<PromoteCarResult> {
  const res = await fetch(`${API_URL}/api/cars/${carId}/promote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.ok && body?.success !== false) {
    const until = String(body?.promotedUntil || '').trim();
    if (until) return { ok: true, promotedUntil: until };
    return { ok: true, promotedUntil: new Date(Date.now() + 7 * 86400000).toISOString() };
  }

  return {
    ok: false,
    status: res.status,
    message: String(body?.error || body?.message || 'Nie udało się wyróżnić ogłoszenia auta.'),
  };
}
