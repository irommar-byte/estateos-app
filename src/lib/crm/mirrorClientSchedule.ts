import { prisma } from '@/lib/prisma';
import { emailClientSchedule } from '@/lib/crm/clientScheduleNotify';
import { counterpartIdFromMeta, positiveClientId } from '@/lib/crm/scheduleCounterpart';

export { counterpartIdFromMeta, positiveClientId } from '@/lib/crm/scheduleCounterpart';

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export async function findPresentationCounterpartId(params: {
  agencyUserId: number;
  actorClientId: number;
  actorType: string;
  offerId?: number | null;
  metadata?: unknown;
}): Promise<number | null> {
  const fromMeta = counterpartIdFromMeta(
    params.actorClientId,
    params.actorType,
    params.metadata,
  );
  if (fromMeta) return fromMeta;

  const offerId =
    positiveClientId(params.offerId) ||
    positiveClientId(asMeta(params.metadata).offerId);
  if (!offerId) return null;

  const type = String(params.actorType || '').toUpperCase();
  if (type === 'BUYER') {
    const seller = await prisma.agencyClient.findFirst({
      where: {
        agencyUserId: params.agencyUserId,
        type: 'SELLER',
        linkedOfferId: offerId,
        status: 'ACTIVE',
        id: { not: params.actorClientId },
      },
      select: { id: true },
    });
    return seller?.id || null;
  }

  const match = await prisma.agencyClientMatch.findFirst({
    where: {
      offerId,
      clientId: { not: params.actorClientId },
      client: {
        agencyUserId: params.agencyUserId,
        type: 'BUYER',
        status: 'ACTIVE',
      },
    },
    orderBy: [{ notifiedAt: 'desc' }, { id: 'desc' }],
    select: { clientId: true },
  });
  return match?.clientId || null;
}

export async function mirrorPresentationActivity(params: {
  agencyUserId: number;
  sourceClientId: number;
  sourceClientType: string;
  sourceClientName: string;
  kind: string;
  title: string;
  body: string;
  offerId?: number | null;
  metadata: Record<string, unknown>;
  emailMode?: 'proposed' | 'confirmed' | 'changed' | null;
}): Promise<{ mirroredTo: number | null }> {
  if (params.metadata.mirroredFromClientId) {
    return { mirroredTo: null };
  }

  const counterpartId = await findPresentationCounterpartId({
    agencyUserId: params.agencyUserId,
    actorClientId: params.sourceClientId,
    actorType: params.sourceClientType,
    offerId: params.offerId ?? null,
    metadata: params.metadata,
  });
  if (!counterpartId) return { mirroredTo: null };

  const type = String(params.sourceClientType || '').toUpperCase();
  const buyerClientId = type === 'BUYER' ? params.sourceClientId : counterpartId;
  const sellerClientId = type === 'SELLER' ? params.sourceClientId : counterpartId;

  await prisma.agencyClientActivity.create({
    data: {
      clientId: counterpartId,
      agencyUserId: params.agencyUserId,
      offerId: params.offerId ?? null,
      kind: params.kind,
      title: params.title,
      body: params.body,
      metadata: {
        ...params.metadata,
        offerId: params.offerId ?? params.metadata.offerId ?? null,
        buyerClientId,
        sellerClientId,
        mirroredFromClientId: params.sourceClientId,
        counterpartName: params.sourceClientName,
      },
    },
  });

  if (params.emailMode) {
    const startsAt = new Date(String(params.metadata.startsAt || ''));
    if (Number.isFinite(startsAt.getTime())) {
      await emailClientSchedule({
        clientId: counterpartId,
        kind: 'presentation',
        mode: params.emailMode,
        startsAt,
        location: params.metadata.location ? String(params.metadata.location) : null,
        notes: params.metadata.notes ? String(params.metadata.notes) : null,
        reason: params.metadata.reason ? String(params.metadata.reason) : null,
      });
    }
  }

  return { mirroredTo: counterpartId };
}
