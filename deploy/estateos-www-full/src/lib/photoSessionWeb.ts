export type PhotoSessionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type PhotoSessionWaitingOn = 'ADMIN' | 'USER' | null;

export type PhotoSessionEventItem = {
  id: number;
  requestId: number;
  actorUserId: number;
  action: string;
  proposedAt?: string | null;
  note?: string | null;
  createdAt: string;
};

export type PhotoSessionRequestItem = {
  id: number;
  userId: number;
  status: PhotoSessionStatus;
  waitingOn?: PhotoSessionWaitingOn;
  proposedAt: string;
  note?: string | null;
  propertyLabel?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;
  isProFree: boolean;
  paymentLabel?: string | null;
  paymentAmountPln?: number;
  adminNote?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  requesterName?: string | null;
  requesterPhone?: string | null;
  requesterEmail?: string | null;
  events?: PhotoSessionEventItem[];
};

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchMyPhotoSessions(): Promise<PhotoSessionRequestItem[]> {
  const res = await fetch('/api/mobile/v1/photo-sessions', { credentials: 'include', cache: 'no-store' });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || 'Nie udało się pobrać rezerwacji.');
  return (data?.items || []) as PhotoSessionRequestItem[];
}

export async function createPhotoSession(payload: {
  proposedAt: string;
  note?: string;
  propertyLabel?: string;
  propertyType?: string;
  transactionType?: string;
}) {
  const res = await fetch('/api/mobile/v1/photo-sessions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || 'Nie udało się wysłać propozycji.');
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

export async function respondPhotoSession(
  id: number,
  payload: { action: 'accept' | 'counter' | 'decline'; proposedAt?: string; note?: string },
) {
  const res = await fetch(`/api/mobile/v1/photo-sessions/${id}/respond`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || 'Operacja nie powiodła się.');
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

export async function fetchAdminPhotoSessions(status: PhotoSessionStatus | 'ALL' = 'ALL') {
  const qs = `?status=${encodeURIComponent(status)}`;
  const res = await fetch(`/api/mobile/v1/admin/photo-sessions${qs}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || 'Nie udało się pobrać kolejki.');
  return (data?.items || []) as PhotoSessionRequestItem[];
}

export async function adminPhotoSessionAction(
  id: number,
  payload: { action: 'accept' | 'counter' | 'reject'; proposedAt?: string; adminNote?: string },
) {
  const res = await fetch('/api/mobile/v1/admin/photo-sessions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, id }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.message || 'Operacja nie powiodła się.');
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

export function paymentLabel(_isProFree: boolean) {
  return '199 zł — sesja płatna (Warszawa)';
}

export function buildNextDays(count = 30) {
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

export function buildHours() {
  const arr: string[] = [];
  for (let h = 8; h <= 20; h += 1) {
    arr.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) arr.push(`${String(h).padStart(2, '0')}:30`);
  }
  return arr;
}

export function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
