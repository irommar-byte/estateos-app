import { API_URL } from '../config/network';
import type { EnrichedLeadTransfer } from '../types/leadTransfer';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' };
}

export async function fetchLeadTransfers(token: string): Promise<EnrichedLeadTransfer[]> {
  const res = await fetch(`${API_URL}/api/concierge/leads?t=${Date.now()}`, {
    headers: authHeaders(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) return [];
  return Array.isArray(json.leads) ? json.leads : [];
}

export async function requestLeadTransfer(
  token: string,
  body: { offerId: number; agencyId: number },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/request`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się wysłać zapytania.') };
  return { ok: true };
}

export async function proposeLeadTerms(
  token: string,
  body: { leadId: number; commissionRate: string; commissionTerms: string },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/respond`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, status: 'TERMS_PROPOSED' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się wysłać warunków.') };
  return { ok: true };
}

export async function acceptLeadTransfer(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/accept`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się zaakceptować.') };
  return { ok: true };
}

export async function rejectLeadTransfer(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/concierge/reject`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się odrzucić.') };
  return { ok: true };
}

export async function fetchAgencyCatalog(): Promise<
  Array<{ id: number; displayName: string; image: string | null; averageRating: number | null; reviewsCount: number }>
> {
  const res = await fetch(`${API_URL}/api/agencje?t=${Date.now()}`);
  const json = await res.json().catch(() => ({}));
  return Array.isArray(json?.agencies) ? json.agencies : [];
}
