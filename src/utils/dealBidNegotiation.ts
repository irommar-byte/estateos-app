/** Wspólna logika „czyja kolej” w negocjacji ceny — mobile + spójność z API. */

export type DealNegotiationSnapshot = {
  respondToBidId: number | null;
  respondToBidAmount: number | null;
  respondToBidSenderId: number | null;
  waitingOnOtherBid: boolean;
  myPendingBidId: number | null;
  myPendingBidAmount: number | null;
  respondToAppointmentId: number | null;
  respondToAppointmentDate: string | null;
  respondToAppointmentProposerId: number | null;
  waitingOnOtherAppointment: boolean;
  myPendingAppointmentId: number | null;
  /** @deprecated API v1 alias */
  waitingOnOther?: boolean;
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
    const action = String(entry.event?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) continue;
    if (Number(entry.event?.amount || 0) <= 0) continue;
    if (!resolveEventBidId(entry.event)) continue;
    if (isMessageFromUser(entry.msg, userId)) return null;
    return entry;
  }
  return null;
}

export function findLatestActionableAppointmentEvent(
  appointmentEvents: Array<{
    msg?: { senderId?: unknown };
    event?: { action?: unknown; proposedDate?: unknown };
  }>,
  userId: unknown
): (typeof appointmentEvents)[number] | null {
  for (let i = appointmentEvents.length - 1; i >= 0; i -= 1) {
    const entry = appointmentEvents[i];
    const action = String(entry.event?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) continue;
    if (!entry.event?.proposedDate) continue;
    if (isMessageFromUser(entry.msg, userId)) return null;
    return entry;
  }
  return null;
}

export function findLatestPendingAppointmentEntry(
  appointmentEvents: Array<{
    msg?: { senderId?: unknown };
    event?: { action?: unknown; proposedDate?: unknown };
  }>
): (typeof appointmentEvents)[number] | null {
  for (let i = appointmentEvents.length - 1; i >= 0; i -= 1) {
    const entry = appointmentEvents[i];
    const action = String(entry.event?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) continue;
    if (!entry.event?.proposedDate) continue;
    return entry;
  }
  return null;
}

export function normalizeNegotiationSnapshot(raw: unknown): DealNegotiationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as DealNegotiationSnapshot;
  return {
    ...n,
    waitingOnOther: n.waitingOnOtherBid ?? n.waitingOnOther ?? false,
  };
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
