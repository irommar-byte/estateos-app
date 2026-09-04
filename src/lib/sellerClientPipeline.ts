import type { AgencyClientDetail } from '../services/agencyClientService';
import type { AcquisitionRecord } from '../services/agencyClientService';

export type SellerPipelineStageId =
  | 'meeting'
  | 'acquisition'
  | 'sale'
  | 'transaction'
  | 'finalization';

export type SellerPipelineStage = {
  id: SellerPipelineStageId;
  label: string;
  done: boolean;
  current: boolean;
};

export const SELLER_PIPELINE_LABELS: Record<SellerPipelineStageId, string> = {
  meeting: 'Umówienie spotkania',
  acquisition: 'Umowa',
  sale: 'Ogłoszenie',
  transaction: 'Prezentacje',
  finalization: 'Transakcja',
};

export type SellerPipelineInput = {
  meetingConfirmed: boolean;
  acquisitionSigned: boolean;
  offerActive: boolean;
  notaryScheduled: boolean;
  handoverComplete: boolean;
};

export function computeSellerPipeline(input: SellerPipelineInput): SellerPipelineStage[] {
  const doneFlags: Record<SellerPipelineStageId, boolean> = {
    meeting: input.meetingConfirmed,
    acquisition: input.acquisitionSigned,
    sale: input.offerActive,
    transaction: input.notaryScheduled,
    finalization: input.handoverComplete,
  };

  const order: SellerPipelineStageId[] = [
    'meeting',
    'acquisition',
    'sale',
    'transaction',
    'finalization',
  ];

  const firstOpen = order.findIndex((id) => !doneFlags[id]);

  return order.map((id, index) => ({
    id,
    label: SELLER_PIPELINE_LABELS[id],
    done: doneFlags[id],
    current: firstOpen === -1 ? index === order.length - 1 : index === firstOpen,
  }));
}

function activityHintsNotary(activities: Array<{ kind?: string; title?: string | null; body?: string | null }>) {
  return activities.some((a) => {
    const blob = `${a.kind || ''} ${a.title || ''} ${a.body || ''}`.toLowerCase();
    return blob.includes('notariusz') || blob.includes('akt notarialny') || blob.includes('u notariusza');
  });
}

function activityHintsHandover(activities: Array<{ kind?: string; title?: string | null; body?: string | null }>) {
  return activities.some((a) => {
    const blob = `${a.kind || ''} ${a.title || ''} ${a.body || ''}`.toLowerCase();
    return (
      blob.includes('protokół') ||
      blob.includes('protokol') ||
      blob.includes('odbiór') ||
      blob.includes('odbior') ||
      blob.includes('przekazanie kluczy') ||
      blob.includes('klucze')
    );
  });
}

export function sellerPipelineFromClientDetail(
  client: AgencyClientDetail,
  acquisition: AcquisitionRecord | null,
  offerStatus?: string | null,
): SellerPipelineStage[] {
  const meetingConfirmed =
    Boolean(client.meeting?.startsAt) &&
    (client.meeting?.status === 'confirmed' || Boolean(client.upcomingMeetingStartsAt));

  const acquisitionSigned =
    acquisition?.status === 'SIGNED' || Boolean(acquisition?.signedAt);

  const normalizedOfferStatus = String(offerStatus || '').toUpperCase();
  const offerPrepared =
    Boolean(client.linkedOfferId) ||
    normalizedOfferStatus === 'ACTIVE' ||
    normalizedOfferStatus === 'PUBLISHED' ||
    normalizedOfferStatus === 'PENDING' ||
    normalizedOfferStatus === 'IN_DEAL';

  const activities = (client as AgencyClientDetail & { activities?: Array<{ kind: string; title: string | null; body: string | null }> })
    .activities || [];

  const presentationConfirmed = client.presentation?.status === 'confirmed';

  return computeSellerPipeline({
    meetingConfirmed,
    acquisitionSigned,
    offerActive: offerPrepared,
    notaryScheduled: presentationConfirmed,
    handoverComplete:
      activityHintsNotary(activities) ||
      activityHintsHandover(activities) ||
      normalizedOfferStatus === 'SOLD' ||
      normalizedOfferStatus === 'ARCHIVED',
  });
}

// ─── Buyer Pipeline ───

export type BuyerPipelineStageId =
  | 'criteria'
  | 'radar'
  | 'sending'
  | 'presentation'
  | 'deal';

export type BuyerPipelineStage = {
  id: BuyerPipelineStageId;
  label: string;
  done: boolean;
  current: boolean;
};

export const BUYER_PIPELINE_LABELS: Record<BuyerPipelineStageId, string> = {
  criteria: 'Kryteria',
  radar: 'Radar',
  sending: 'Wysyłka',
  presentation: 'Prezentacja',
  deal: 'Transakcja',
};

export function computeBuyerPipeline(input: {
  hasCriteria: boolean;
  hasMatches: boolean;
  hasSent: boolean;
  presentationConfirmed: boolean;
  dealClosed: boolean;
}): BuyerPipelineStage[] {
  const doneFlags: Record<BuyerPipelineStageId, boolean> = {
    criteria: input.hasCriteria,
    radar: input.hasMatches,
    sending: input.hasSent,
    presentation: input.presentationConfirmed,
    deal: input.dealClosed,
  };
  const order: BuyerPipelineStageId[] = ['criteria', 'radar', 'sending', 'presentation', 'deal'];
  const firstOpen = order.findIndex((id) => !doneFlags[id]);
  return order.map((id, index) => ({
    id,
    label: BUYER_PIPELINE_LABELS[id],
    done: doneFlags[id],
    current: firstOpen === -1 ? index === order.length - 1 : index === firstOpen,
  }));
}

export function buyerPipelineFromClientDetail(client: AgencyClientDetail): BuyerPipelineStage[] {
  const hasCriteria = Boolean(client.buyerFilters) || (client.matchCount || 0) > 0;
  const matches = client.matches || [];
  const hasMatches = matches.length > 0;
  const hasSent = (client.sentCount || 0) > 0 || matches.some((m) => Boolean(m.notifiedAt || m.sharedAt));
  const presentationConfirmed = client.presentation?.status === 'confirmed';
  const dealClosed = client.dealClosed === true;
  return computeBuyerPipeline({ hasCriteria, hasMatches, hasSent, presentationConfirmed, dealClosed });
}

export function hasLiveMeetingCountdown(startsAt?: string | null, nowMs = Date.now()) {
  if (!startsAt) return false;
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return false;
  return nowMs <= start + 60 * 60 * 1000;
}
