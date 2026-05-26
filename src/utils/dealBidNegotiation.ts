/** Wspólna logika „czyja kolej” w negocjacji ceny — mobile + spójność z API. */

export type DealNegotiationSnapshot = {
  respondToBidId: number | null;
  respondToBidAmount: number | null;
  respondToBidSenderId: number | null;
  waitingOnOther: boolean;
  myPendingBidId: number | null;
  myPendingBidAmount: number | null;
};

export function isPositiveUserId(id: unknown): id is number {
  const n = Number(id);
  return Number.isFinite(n) && n > 0;
}

export function isMessageFromUser(msg: { senderId?: unknown } | null | undefined, userId: unknown): boolean {
  if (!isPositiveUserId(userId)) return false;
  if (!isPositiveUserId(msg?.senderId)) return false;
  return Number(msg.senderId) === Number(userId);
}

export function resolveEventBidId(event: { bidId?: unknown; id?: unknown } | null | undefined): number | null {
  const bidId = Number(event?.bidId ?? 0);
  if (bidId > 0) return bidId;
  return null;
}

export function findLatestActionableBidEvent(
  bidEvents: Array<{ msg?: { senderId?: unknown }; event?: { action?: unknown; amount?: unknown; bidId?: unknown } }>,
  userId: unknown
): (typeof bidEvents)[number] | null {
  for (let i = bidEvents.length - 1; i >= 0; i -= 1) {
    const entry = bidEvents[i];
    if (isMessageFromUser(entry.msg, userId)) continue;
    const action = String(entry.event?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) continue;
    if (Number(entry.event?.amount || 0) <= 0) continue;
    if (!resolveEventBidId(entry.event)) continue;
    return entry;
  }
  return null;
}

export function buildBidEventFromSnapshot(
  snapshot: DealNegotiationSnapshot | null | undefined
): { bidId: number; amount: number; action: string; senderId: number | null } | null {
  if (!snapshot?.respondToBidId) return null;
  return {
    bidId: snapshot.respondToBidId,
    amount: Number(snapshot.respondToBidAmount || 0),
    action: 'COUNTERED',
    senderId: snapshot.respondToBidSenderId,
  };
}
