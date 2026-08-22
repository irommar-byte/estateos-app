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
  acquisition: 'Pozysk',
  sale: 'Sprzedaż',
  transaction: 'Transakcja',
  finalization: 'Finalizacja',
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
  const offerActive =
    normalizedOfferStatus === 'ACTIVE' ||
    normalizedOfferStatus === 'PUBLISHED' ||
    (Boolean(client.linkedOfferId) && !['DRAFT', 'PENDING', 'INACTIVE'].includes(normalizedOfferStatus));

  const activities = (client as AgencyClientDetail & { activities?: Array<{ kind: string; title: string | null; body: string | null }> })
    .activities || [];

  const presentationConfirmed = client.presentation?.status === 'confirmed';

  return computeSellerPipeline({
    meetingConfirmed,
    acquisitionSigned,
    offerActive,
    notaryScheduled: activityHintsNotary(activities) || presentationConfirmed,
    handoverComplete:
      activityHintsHandover(activities) ||
      normalizedOfferStatus === 'SOLD' ||
      normalizedOfferStatus === 'ARCHIVED',
  });
}

export function hasLiveMeetingCountdown(startsAt?: string | null, nowMs = Date.now()) {
  if (!startsAt) return false;
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return false;
  return nowMs <= start + 60 * 60 * 1000;
}
