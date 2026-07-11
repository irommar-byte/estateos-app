import { API_URL } from '../config/network';

export type PhotoSessionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type PhotoSessionWaitingOn = 'ADMIN' | 'USER' | null;
export type PhotoSessionEventAction = 'PROPOSED' | 'COUNTERED' | 'ACCEPTED' | 'DECLINED';

export type PhotoSessionEventItem = {
  id: number;
  requestId: number;
  actorUserId: number;
  action: PhotoSessionEventAction;
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
  acceptedAt?: string | null;
  createdAt: string;
  requesterName?: string | null;
  requesterPhone?: string | null;
  requesterEmail?: string | null;
  events?: PhotoSessionEventItem[];
};

export class PhotoSessionServiceError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PhotoSessionServiceError';
    this.status = status;
  }
}

function normalizeToken(token: string | null | undefined) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function createPhotoSessionRequest(
  payload: {
    proposedAt: string;
    note?: string;
    propertyLabel?: string;
    propertyType?: string;
    transactionType?: string;
  },
  token: string | null | undefined,
) {
  const safeToken = normalizeToken(token);
  if (!safeToken) throw new PhotoSessionServiceError('Brak sesji — zaloguj się ponownie.', 401);

  const res = await fetch(`${API_URL}/api/mobile/v1/photo-sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${safeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const fallback =
      res.status === 404 || res.status === 405
        ? 'Usługa rezerwacji sesji nie jest jeszcze dostępna na serwerze.'
        : 'Nie udało się wysłać propozycji terminu.';
    throw new PhotoSessionServiceError(data?.message || data?.error || fallback, res.status);
  }
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

export async function fetchMyPhotoSessionRequests(token: string | null | undefined) {
  const safeToken = normalizeToken(token);
  if (!safeToken) throw new PhotoSessionServiceError('Brak sesji — zaloguj się ponownie.', 401);

  const res = await fetch(`${API_URL}/api/mobile/v1/photo-sessions`, {
    headers: { Authorization: `Bearer ${safeToken}` },
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new PhotoSessionServiceError(data?.message || 'Nie udało się pobrać Twoich rezerwacji sesji.', res.status);
  }
  return (data?.items || []) as PhotoSessionRequestItem[];
}

export async function respondMyPhotoSessionRequest(
  requestId: number,
  payload: {
    action: 'accept' | 'counter' | 'decline';
    proposedAt?: string;
    note?: string;
  },
  token: string | null | undefined,
) {
  const safeToken = normalizeToken(token);
  if (!safeToken) throw new PhotoSessionServiceError('Brak sesji — zaloguj się ponownie.', 401);

  const res = await fetch(`${API_URL}/api/mobile/v1/photo-sessions/${requestId}/respond`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${safeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new PhotoSessionServiceError(data?.message || 'Nie udało się wysłać odpowiedzi.', res.status);
  }
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

export async function fetchAdminPhotoSessionQueue(
  status: PhotoSessionStatus | 'ALL' = 'PENDING',
  token: string | null | undefined,
) {
  const safeToken = normalizeToken(token);
  if (!safeToken) throw new PhotoSessionServiceError('Brak autoryzacji.', 401);

  const qs = status === 'ALL' ? '' : `?status=${encodeURIComponent(status)}`;
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/photo-sessions${qs}`, {
    headers: { Authorization: `Bearer ${safeToken}` },
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new PhotoSessionServiceError(data?.message || 'Nie udało się pobrać kolejki sesji.', res.status);
  }
  return (data?.items || []) as PhotoSessionRequestItem[];
}

export async function adminPhotoSessionAction(
  requestId: number,
  payload: {
    action: 'accept' | 'counter' | 'reject';
    proposedAt?: string;
    adminNote?: string | null;
  },
  token: string | null | undefined,
) {
  const safeToken = normalizeToken(token);
  if (!safeToken) throw new PhotoSessionServiceError('Brak autoryzacji.', 401);

  const res = await fetch(`${API_URL}/api/mobile/v1/admin/photo-sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${safeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: payload.action,
      id: requestId,
      proposedAt: payload.proposedAt,
      adminNote: payload.adminNote ?? null,
      note: payload.adminNote ?? null,
    }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new PhotoSessionServiceError(data?.message || 'Nie udało się zaktualizować rezerwacji.', res.status);
  }
  return data as { success: boolean; request: PhotoSessionRequestItem };
}

/** @deprecated use adminPhotoSessionAction */
export async function acceptPhotoSessionRequest(
  requestId: number,
  token: string | null | undefined,
  adminNote?: string | null,
) {
  return adminPhotoSessionAction(requestId, { action: 'accept', adminNote }, token);
}
