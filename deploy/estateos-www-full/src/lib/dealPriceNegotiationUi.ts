import type { NegotiationEventEntry } from '@/components/crm/dealRoomUtils';

export const FINALIZED_DEAL_STATUSES = new Set([
  'FINALIZED',
  'CLOSED',
  'COMPLETED',
  'DONE',
  'SOLD',
  'CANCELLED',
]);

export function canFinalizeTransition(params: {
  dealStatus: unknown;
  acceptedBidId: unknown;
}): boolean {
  const status = String(params.dealStatus || '').trim().toUpperCase();
  const acceptedBidId = Number(params.acceptedBidId || 0);
  return status === 'AGREED' && Number.isFinite(acceptedBidId) && acceptedBidId > 0;
}

export function isDealTransactionFinalized(params: {
  dealStatus: unknown;
}): boolean {
  return FINALIZED_DEAL_STATUSES.has(String(params.dealStatus || '').trim().toUpperCase());
}

export type FinalAcceptanceContext = {
  bidId: number;
  amount: number;
  buyerSenderId: string;
};

/** Kupujący zaakceptował cenę właściciela (COUNTER ta sama kwota) — czeka na finalne „TAK” sprzedającego. */
export function detectFinalAcceptanceContext(
  bidEvents: NegotiationEventEntry[]
): FinalAcceptanceContext | null {
  if (bidEvents.length < 2) return null;
  const last = bidEvents[bidEvents.length - 1];
  const prev = bidEvents[bidEvents.length - 2];
  if (!last?.event || !prev?.event) return null;

  const lastAction = String(last.event.action || '').toUpperCase();
  const lastAmount = Number(last.event.amount || last.event.counterAmount || 0);
  const prevAmount = Number(prev.event.amount || prev.event.counterAmount || 0);
  const lastSenderId = String(last.msg?.senderId ?? '');
  const prevSenderId = String(prev.msg?.senderId ?? '');
  const lastNote = String(last.event.note || last.event.message || '').toLowerCase();

  const isCountered = lastAction === 'COUNTERED';
  const isExplicitIntent = String(last.event.intent || '').toUpperCase() === 'FINAL_ACCEPTANCE';
  const isSameAmount =
    lastAmount > 0 && prevAmount > 0 && Math.round(lastAmount) === Math.round(prevAmount);
  const notesAcceptance =
    lastNote.includes('akceptuję twoją cenę') ||
    lastNote.includes('akceptuje twoja cene') ||
    lastNote.includes('ostateczne potwierdzenie') ||
    lastNote.includes('ostateczne potw');

  const matches = isExplicitIntent || (isCountered && isSameAmount && notesAcceptance);
  if (!matches || lastSenderId === prevSenderId) return null;

  const bidId = Number(last.event.bidId || 0);
  if (!Number.isFinite(bidId) || bidId <= 0) return null;

  return {
    bidId,
    amount: Math.round(lastAmount),
    buyerSenderId: lastSenderId,
  };
}

export const BUYER_ACCEPT_OWNER_PRICE_NOTE =
  'Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży.';
