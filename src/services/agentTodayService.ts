import { API_URL } from '../config/network';
import { postAgencyClientAction } from './agencyClientService';

/** Ekran „Dziś” agenta — kształt odpowiedzi GET /api/crm/today. */

export type TodayOffer = {
  id: number;
  title: string;
  price: number | null;
  city: string | null;
  district: string | null;
  street: string | null;
  area: number | null;
  rooms: number | null;
  imageUrl: string;
};

export type TodayApproval = {
  approvalId: number;
  clientId: number;
  clientName: string;
  offer: TodayOffer | null;
  score: number | null;
  clientWhy: string | null;
  createdAt: string;
};

export type TodayOwnerCall = TodayApproval & {
  owner: { phone: string | null; directOwner: boolean; note: string | null; sourceUrl: string | null } | null;
  lastOutcome: 'no_answer' | null;
  attempts: number;
};

export type TodayReply = {
  id: string;
  kind: 'viewing' | 'question' | 'handoff' | 'stalled' | 'message';
  clientId: number;
  clientName: string;
  title: string;
  body: string;
  createdAt: string;
  activityId: number | null;
  matchId: number | null;
  offerId: number | null;
  unreadCount?: number;
};

export type TodayScheduleItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  clientId: number | null;
  offerId: number | null;
};

export type TodayStaleClient = {
  clientId: number;
  clientName: string;
  type: 'BUYER' | 'SELLER';
  phone: string | null;
  lastActivityAt: string;
  days: number;
};

export type TodayOutboxItem = {
  id: number;
  clientId: number;
  clientName: string;
  category: string;
  categoryLabel: string;
  channels: string[];
  recipient: string | null;
  subject: string | null;
  previewText: string | null;
  createdAt: string;
};

export type AgentToday = {
  generatedAt: string;
  counts: { outbox?: number; ownerCalls: number; approvals: number; replies: number; schedule: number; stale: number; total: number };
  /** Wiadomości do klientów czekające na akceptację (starsze serwery mogą nie zwracać). */
  outbox?: TodayOutboxItem[];
  ownerCalls: TodayOwnerCall[];
  approvals: TodayApproval[];
  replies: TodayReply[];
  schedule: TodayScheduleItem[];
  stale: TodayStaleClient[];
};

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json' };
}

export async function fetchAgentToday(
  token: string,
): Promise<{ ok: true; today: AgentToday } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/crm/today`, { headers: headers(token) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.today) {
      return { ok: false, message: String(json?.error || 'Nie udało się wczytać planu dnia.') };
    }
    return { ok: true, today: json.today as AgentToday };
  } catch {
    return { ok: false, message: 'Brak połączenia z serwerem.' };
  }
}

export async function reportOwnerCall(
  token: string,
  approvalId: number,
  outcome: 'available' | 'sold' | 'no_answer',
): Promise<{ ok: true; snoozedUntil?: string; skippedOthers?: number } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/crm/today`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ action: 'owner_call_result', approvalId, outcome }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: String(json?.error || 'Nie udało się zapisać wyniku rozmowy.') };
    return { ok: true, snoozedUntil: json.snoozedUntil, skippedOthers: json.skippedOthers };
  } catch {
    return { ok: false, message: 'Brak połączenia z serwerem.' };
  }
}

export function decideIntelligenceApproval(
  token: string,
  clientId: number,
  approvalId: number,
  decision: 'approve' | 'skip',
) {
  return postAgencyClientAction(token, clientId, {
    action: decision === 'approve' ? 'intelligence_approve' : 'intelligence_skip',
    activityId: approvalId,
  });
}

export function resolveClientTask(token: string, clientId: number, activityId: number) {
  return postAgencyClientAction(token, clientId, { action: 'resolve_buyer_agent_task', activityId });
}
