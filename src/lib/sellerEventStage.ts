export type SellerEventKind = 'open_house' | 'auction';

export type SellerEventStageId =
  | 'pending_approval'
  | 'confirmed'
  | 'upcoming'
  | 'live'
  | 'ended'
  | 'rejected';

export type SellerEventStage = {
  id: SellerEventStageId;
  label: string;
  kind: SellerEventKind | null;
};

export const SELLER_EVENT_STAGE_LABELS: Record<SellerEventStageId, string> = {
  pending_approval: 'Do akceptacji',
  confirmed: 'Potwierdzone',
  upcoming: 'Wkrótce',
  live: 'Trwa',
  ended: 'Zakończone',
  rejected: 'Odrzucone',
};

export type SellerEventProposalPayload = {
  source?: 'crm_plan';
  kind: SellerEventKind;
  offerId: number;
  startsAt?: string | null;
  endsAt?: string | null;
  slots?: Array<{ startsAt: string; endsAt: string; capacity?: number }>;
  visitMode?: 'FLEX' | 'SLOT_30' | 'SLOT_60' | null;
  startPrice?: number | null;
  reservePrice?: number | null;
  minIncrement?: number | null;
  eventId?: number | null;
  clientMessage?: string | null;
};

export function parseSellerEventProposal(raw: unknown): SellerEventProposalPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const kind = String(rec.kind || '');
  if (kind !== 'open_house' && kind !== 'auction') return null;
  const offerId = Number(rec.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  return {
    source: rec.source === 'crm_plan' ? 'crm_plan' : 'crm_plan',
    kind,
    offerId,
    startsAt: rec.startsAt ? String(rec.startsAt) : null,
    endsAt: rec.endsAt ? String(rec.endsAt) : null,
    slots: Array.isArray(rec.slots)
      ? rec.slots
          .map((slot) => {
            if (!slot || typeof slot !== 'object') return null;
            const row = slot as Record<string, unknown>;
            const startsAt = String(row.startsAt || '');
            const endsAt = String(row.endsAt || '');
            if (!startsAt || !endsAt) return null;
            return {
              startsAt,
              endsAt,
              capacity: row.capacity != null ? Number(row.capacity) : undefined,
            };
          })
          .filter(Boolean) as Array<{ startsAt: string; endsAt: string; capacity?: number }>
      : undefined,
    visitMode:
      rec.visitMode === 'FLEX' || rec.visitMode === 'SLOT_30' || rec.visitMode === 'SLOT_60'
        ? rec.visitMode
        : null,
    startPrice: rec.startPrice != null ? Number(rec.startPrice) : null,
    reservePrice: rec.reservePrice != null ? Number(rec.reservePrice) : null,
    minIncrement: rec.minIncrement != null ? Number(rec.minIncrement) : null,
    eventId: rec.eventId != null ? Number(rec.eventId) : null,
    clientMessage: rec.clientMessage != null ? String(rec.clientMessage) : null,
  };
}

export function computeSellerEventStage(input: {
  pendingKind?: SellerEventKind | null;
  rejectedKind?: SellerEventKind | null;
  openHouseStatus?: string | null;
  openHouseStartsAt?: string | null;
  openHouseEndsAt?: string | null;
  auctionStatus?: string | null;
  auctionStartsAt?: string | null;
  auctionEndsAt?: string | null;
  now?: Date;
}): SellerEventStage | null {
  const now = input.now || new Date();
  if (input.pendingKind) {
    return {
      id: 'pending_approval',
      label: SELLER_EVENT_STAGE_LABELS.pending_approval,
      kind: input.pendingKind,
    };
  }

  const auctionStatus = String(input.auctionStatus || '').toUpperCase();
  if (auctionStatus === 'LIVE') {
    return { id: 'live', label: SELLER_EVENT_STAGE_LABELS.live, kind: 'auction' };
  }
  if (auctionStatus === 'SCHEDULED') {
    const starts = input.auctionStartsAt ? new Date(input.auctionStartsAt) : null;
    const soon =
      starts && Number.isFinite(starts.getTime()) && starts.getTime() - now.getTime() < 48 * 3600_000;
    return {
      id: soon ? 'upcoming' : 'confirmed',
      label: soon ? SELLER_EVENT_STAGE_LABELS.upcoming : SELLER_EVENT_STAGE_LABELS.confirmed,
      kind: 'auction',
    };
  }
  if (auctionStatus === 'ENDED' || auctionStatus === 'SETTLED' || auctionStatus === 'CANCELLED') {
    return { id: 'ended', label: SELLER_EVENT_STAGE_LABELS.ended, kind: 'auction' };
  }

  const ohStatus = String(input.openHouseStatus || '').toUpperCase();
  if (ohStatus === 'PUBLISHED') {
    const starts = input.openHouseStartsAt ? new Date(input.openHouseStartsAt) : null;
    const ends = input.openHouseEndsAt ? new Date(input.openHouseEndsAt) : null;
    if (starts && ends && now >= starts && now <= ends) {
      return { id: 'live', label: SELLER_EVENT_STAGE_LABELS.live, kind: 'open_house' };
    }
    if (ends && now > ends) {
      return { id: 'ended', label: SELLER_EVENT_STAGE_LABELS.ended, kind: 'open_house' };
    }
    const soon =
      starts && Number.isFinite(starts.getTime()) && starts.getTime() - now.getTime() < 48 * 3600_000;
    return {
      id: soon ? 'upcoming' : 'confirmed',
      label: soon ? SELLER_EVENT_STAGE_LABELS.upcoming : SELLER_EVENT_STAGE_LABELS.confirmed,
      kind: 'open_house',
    };
  }
  if (ohStatus === 'COMPLETED' || ohStatus === 'CANCELLED') {
    return { id: 'ended', label: SELLER_EVENT_STAGE_LABELS.ended, kind: 'open_house' };
  }

  if (input.rejectedKind) {
    return {
      id: 'rejected',
      label: SELLER_EVENT_STAGE_LABELS.rejected,
      kind: input.rejectedKind,
    };
  }

  return null;
}
