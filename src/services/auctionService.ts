import { API_URL } from '../config/network';
import type {
  AuctionEventRecord,
  AuctionMyBidRecord,
  AuctionTickerItem,
} from '../contracts/auctionContract';

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

export async function fetchAuctionTicker(token?: string | null): Promise<AuctionTickerItem[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/ticker`, {
    headers: authHeaders(token ?? null),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.items) ? json.items : [];
}

export async function fetchLiveAuctionEvents(token?: string | null): Promise<AuctionEventRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events?scope=live`, {
    headers: authHeaders(token ?? null),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.events) ? json.events : [];
}

export async function fetchHostAuctionEvents(token: string): Promise<AuctionEventRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events?scope=host`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.events) ? json.events : [];
}

export async function fetchMyAuctionBids(token: string): Promise<AuctionMyBidRecord[]> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events?scope=bids`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return Array.isArray(json?.bids) ? json.bids : [];
}

export async function fetchAuctionEvent(
  token: string | null,
  eventId: number
): Promise<AuctionEventRecord | null> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events/${eventId}`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return json?.success && json?.event ? json.event : null;
}

export async function fetchAuctionForOffer(
  token: string | null,
  offerId: number
): Promise<AuctionEventRecord | null> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/offers/${offerId}`, {
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return json?.success && json?.event ? json.event : null;
}

export async function createAuctionEvent(
  token: string,
  payload: {
    offerId: number;
    title?: string;
    description?: string;
    startPrice: number;
    reservePrice?: number | null;
    minIncrement?: number | null;
    startsAt: string;
    endsAt: string;
    publish?: boolean;
  }
): Promise<{ event?: AuctionEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się utworzyć licytacji.' };
  }
  return { event: json.event };
}

export async function cancelAuctionEvent(
  token: string,
  eventId: number
): Promise<{ event?: AuctionEventRecord; message?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events/${eventId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'CANCELLED' }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się anulować licytacji.' };
  }
  return { event: json.event };
}

export async function placeAuctionBid(
  token: string,
  eventId: number,
  amount: number
): Promise<{ event?: AuctionEventRecord; message?: string; code?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/auction/events/${eventId}/bids`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ amount }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.success) {
    return { message: json?.message || 'Nie udało się złożyć oferty.', code: json?.code };
  }
  return { event: json.event };
}

export function defaultAuctionStartIso(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return d.toISOString();
}

export function defaultAuctionEndIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}
