import { API_URL } from '../config/network';
import type {
  OpenHouseEventRecord,
  OpenHouseReservationRecord,
  OpenHouseTickerItem,
} from '../contracts/openHouseContract';

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchOpenHouseTicker(token?: string | null): Promise<OpenHouseTickerItem[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/ticker`, {
    headers: authHeaders(token ?? null),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.items) ? json.items : [];
}

export async function fetchPublishedOpenHouseEvents(token?: string | null): Promise<OpenHouseEventRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events?scope=published`, {
    headers: authHeaders(token ?? null),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.events) ? json.events : [];
}

export async function fetchHostOpenHouseEvents(token: string): Promise<OpenHouseEventRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events?scope=host`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.events) ? json.events : [];
}

export async function fetchMyOpenHouseReservations(token: string): Promise<OpenHouseReservationRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events?scope=reservations`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.reservations) ? json.reservations : [];
}

export async function fetchOpenHouseEvent(
  token: string | null,
  eventId: number
): Promise<OpenHouseEventRecord | null> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events/${eventId}`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return json?.success && json?.event ? json.event : null;
}

export async function fetchOpenHouseForOffer(
  token: string | null,
  offerId: number
): Promise<OpenHouseEventRecord | null> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/offers/${offerId}`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return json?.success && json?.event ? json.event : null;
}

export async function createOpenHouseEvent(
  token: string,
  payload: {
    offerId: number;
    title?: string;
    description?: string;
    slots: Array<{ startsAt: string; endsAt: string; capacity: number }>;
    publish?: boolean;
  }
): Promise<{ event?: OpenHouseEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się utworzyć wydarzenia.' };
  }
  return { event: json.event };
}

export async function updateOpenHouseEvent(
  token: string,
  eventId: number,
  payload: Record<string, unknown>
): Promise<{ event?: OpenHouseEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/events/${eventId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się zaktualizować wydarzenia.' };
  }
  return { event: json.event };
}

export async function reserveOpenHouseSlot(
  token: string,
  slotId: number,
  payload: { guestCount?: number; note?: string }
): Promise<{ event?: OpenHouseEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/slots/${slotId}/reservations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się zarezerwować terminu.' };
  }
  return { event: json.event };
}

export async function cancelOpenHouseReservation(
  token: string,
  reservationId: number
): Promise<{ event?: OpenHouseEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/open-house/reservations/${reservationId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się anulować rezerwacji.' };
  }
  return { event: json.event };
}

export function slotDraftToApiPayload(
  drafts: Array<{ date: Date; startHour: string; endHour: string; capacity: number }>
) {
  return drafts.map((draft) => {
    const [sh, sm] = draft.startHour.split(':').map(Number);
    const [eh, em] = draft.endHour.split(':').map(Number);
    const startsAt = new Date(draft.date);
    startsAt.setHours(sh, sm || 0, 0, 0);
    const endsAt = new Date(draft.date);
    endsAt.setHours(eh, em || 0, 0, 0);
    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity: draft.capacity,
    };
  });
}

export function buildOpenHouseHours(): string[] {
  const hours: string[] = [];
  for (let h = 8; h <= 20; h += 1) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) hours.push(`${String(h).padStart(2, '0')}:30`);
  }
  return hours;
}

export function buildOpenHouseDays(count = 21): Date[] {
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}
