import { API_URL } from '../config/network';
import { emitOutboxQueued, type QueuedOutboxSummary } from '../lib/outboxEvents';

export type DealStage =
  | 'interested'
  | 'scheduling'
  | 'scheduled'
  | 'viewed'
  | 'feedback'
  | 'negotiation'
  | 'reserved'
  | 'preliminary'
  | 'deed'
  | 'closed'
  | 'lost';
export type TransactionStepId = 'preliminary' | 'deed' | 'handover' | 'commission';
export type TransactionStep = {
  date?: string | null;
  done?: boolean;
  doneAt?: string | null;
  place?: string | null;
  amount?: number | null;
  note?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
};
export type NegotiationOffer = {
  id: string;
  at: string;
  by: 'buyer' | 'seller';
  amount: number;
  note: string | null;
  status: 'open' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';
  sellerBuyerOfferId?: number | null;
  sentToSellerAt?: string | null;
  sentToBuyerAt?: string | null;
};
export type DealSentiment = 'like' | 'maybe' | 'dislike';
export type DealActor = 'agent' | 'buyer' | 'seller' | 'other_agent';

export type BuyerDeal = {
  id: number;
  offerId: number;
  status: 'ACTIVE' | 'PAUSED' | 'LOST' | 'WON';
  source: string;
  sourceLabel: string;
  offer: { id: number; title: string; address: string; price: number | null; imageUrl: string | null };
  seller: { clientId: number; name: string } | null;
  buyer:
    | { kind: 'client'; clientId: number; name: string; phone: string | null; email: string | null }
    | { kind: 'external'; agency: string | null; name: string | null; phone: string | null; email: string | null };
  stage: DealStage;
  phases: Array<{ id: 'presentation' | 'feedback' | 'negotiation' | 'transaction'; label: string; done: boolean; current: boolean; skipped: boolean }>;
  presentation: {
    startsAt: string;
    status: 'pending' | 'confirmed';
    proposedBy: 'agent' | 'client';
    proposedSlots: string[];
    heldAt: string | null;
    past: boolean;
  } | null;
  attendance: { signed: boolean; via: 'tablet' | 'scan' | null; documentId: string | null; url: string | null; name: string | null; at: string | null };
  feedback: { sentiment: DealSentiment; note: string | null; by: 'buyer' | 'agent'; at: string | null } | null;
  feedbackRequestedAt: string | null;
  sellerInformedAt: string | null;
  searchOther: { wanted: boolean; note: string | null; at: string } | null;
  negotiation: {
    startedAt?: string | null;
    skippedPresentation?: boolean;
    offers: NegotiationOffer[];
    financing?: { kind: 'cash' | 'mortgage' | 'mixed'; bank?: string | null; decision?: 'none' | 'pending' | 'approved' | 'rejected' } | null;
    terms?: { deposit?: number | null; preliminaryAt?: string | null; deedAt?: string | null; handoverAt?: string | null; note?: string | null } | null;
    reservation?: { until: string; at: string } | null;
    agreedPrice?: number | null;
    othersDecision?: 'paused' | 'backup' | null;
  };
  transaction: Partial<Record<TransactionStepId, TransactionStep>> & { documentsStartedAt?: string | null };
  documentsVisible: boolean;
  nextAction: string;
  timeline: Array<{ at: string; actor: DealActor; text: string }>;
  updatedAt: string;
};

export type DealAction =
  | { action: 'add_buyer'; offerId: number; buyerClientId?: number; newBuyer?: { firstName: string; lastName: string; phone?: string; email?: string }; external?: { agency?: string; name?: string; phone?: string; email?: string } }
  | { action: 'update_external'; dealId: number; external: { agency?: string; name?: string; phone?: string; email?: string } }
  | { action: 'schedule_external'; dealId: number; startsAt: string }
  | { action: 'mark_viewed'; dealId: number }
  | { action: 'set_feedback'; dealId: number; sentiment: DealSentiment; note?: string }
  | { action: 'request_feedback'; dealId: number }
  | { action: 'inform_seller'; dealId: number; message?: string }
  | { action: 'set_status'; dealId: number; status: 'ACTIVE' | 'PAUSED' | 'LOST'; searchOther?: boolean; searchNote?: string }
  | { action: 'start_negotiation'; dealId: number }
  | { action: 'add_offer'; dealId: number; by: 'buyer' | 'seller'; amount: number; note?: string }
  | { action: 'set_offer_status'; dealId: number; offerId: string; status: 'accepted' | 'rejected' | 'withdrawn' }
  | { action: 'send_offer_to_seller'; dealId: number; offerId: string; recommendation?: string; recommendationKind?: 'accept' | 'counter' | 'reject' }
  | { action: 'message_buyer'; dealId: number; message: string; offerId?: string }
  | {
      action: 'set_negotiation';
      dealId: number;
      financing?: { kind: 'cash' | 'mortgage' | 'mixed'; bank?: string; decision?: 'none' | 'pending' | 'approved' | 'rejected' };
      terms?: { deposit?: number | null; preliminaryAt?: string | null; deedAt?: string | null; handoverAt?: string | null; note?: string };
    }
  | { action: 'set_reservation'; dealId: number; until: string | null }
  | { action: 'decide_others'; dealId: number; decision: 'paused' | 'backup' }
  | { action: 'set_step'; dealId: number; step: TransactionStepId; date?: string | null; place?: string; amount?: number | null; note?: string; done?: boolean }
  | { action: 'start_documents'; dealId: number };

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (json && Array.isArray(json.outbox) && json.outbox.length) emitOutboxQueued(json.outbox as QueuedOutboxSummary[]);
  return json;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' };
}

async function getDeals(token: string, query: string) {
  const res = await fetch(`${API_URL}/api/crm/offer-buyers?${query}`, { headers: headers(token) });
  const json = await parse(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się pobrać kupujących.') };
  return { ok: true as const, deals: (json.deals || []) as BuyerDeal[] };
}

export const fetchOfferBuyerDeals = (token: string, offerId: number) => getDeals(token, `offerId=${offerId}`);
export const fetchBuyerClientDeals = (token: string, buyerClientId: number) => getDeals(token, `buyerClientId=${buyerClientId}`);

export async function fetchBuyerDeal(token: string, dealId: number) {
  const res = await fetch(`${API_URL}/api/crm/offer-buyers?dealId=${dealId}`, { headers: headers(token) });
  const json = await parse(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się pobrać kupującego.') };
  return { ok: true as const, deal: json.deal as BuyerDeal };
}

export async function postBuyerDealAction(token: string, body: DealAction) {
  const res = await fetch(`${API_URL}/api/crm/offer-buyers`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parse(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się zapisać.') };
  return { ok: true as const, deal: json.deal as BuyerDeal, otherActive: Number(json.otherActive || 0) };
}

/** Skan potwierdzenia prezentacji (kind „attendance”) albo plik etapu transakcji (umowa, akt, protokół, faktura). */
export async function uploadDealFile(
  token: string,
  dealId: number,
  kind: 'attendance' | TransactionStepId,
  file: { uri: string; name: string; mimeType: string },
) {
  const payload = new FormData();
  payload.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as any);
  payload.append('dealId', String(dealId));
  payload.append('kind', kind);
  const res = await fetch(`${API_URL}/api/crm/offer-buyers`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: payload });
  const json = await parse(res);
  if (!res.ok) return { ok: false as const, message: String(json?.error || 'Nie udało się wgrać pliku.') };
  return { ok: true as const, deal: json.deal as BuyerDeal };
}

export const SENTIMENT_UI: Record<DealSentiment, { label: string; color: string; icon: 'heart' | 'help-circle' | 'close-circle' }> = {
  like: { label: 'Podoba się', color: '#34C759', icon: 'heart' },
  maybe: { label: 'Zastanawia się', color: '#FF9500', icon: 'help-circle' },
  dislike: { label: 'Nie pasuje', color: '#FF3B30', icon: 'close-circle' },
};

export const STAGE_UI: Record<DealStage, { label: string; color: string }> = {
  interested: { label: 'Zainteresowany', color: '#8E8E93' },
  scheduling: { label: 'Ustalanie terminu', color: '#FF9500' },
  scheduled: { label: 'Prezentacja umówiona', color: '#007AFF' },
  viewed: { label: 'Obejrzał', color: '#5856D6' },
  feedback: { label: 'Ma opinię', color: '#34C759' },
  negotiation: { label: 'Negocjacje', color: '#FF9500' },
  reserved: { label: 'Rezerwacja', color: '#AF52DE' },
  preliminary: { label: 'Umowa przedwstępna', color: '#007AFF' },
  deed: { label: 'Akt podpisany', color: '#30B0C7' },
  closed: { label: 'Sprzedane', color: '#34C759' },
  lost: { label: 'Zakończone', color: '#8E8E93' },
};

export function buyerDisplayName(deal: BuyerDeal): string {
  if (deal.buyer.kind === 'client') return deal.buyer.name;
  return deal.buyer.name || deal.buyer.agency || 'Kupujący bez karty';
}

export function formatDealWhen(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatPln(value: number | null | undefined): string {
  return value ? `${Math.round(value).toLocaleString('pl-PL')} zł` : '';
}

export function parseAmount(raw: string): number | null {
  const n = Math.round(Number(raw.replace(/[^\d,.]/g, '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? n : null;
}
