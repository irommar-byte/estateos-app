import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';
import { prisma } from '@/lib/prisma';

const SCHEDULE_KINDS = [
  JOURNEY_ACTIVITY.MEETING,
  JOURNEY_ACTIVITY.MEETING_CHANGE,
  JOURNEY_ACTIVITY.MEETING_CONFIRMED,
  JOURNEY_ACTIVITY.PRESENTATION,
  JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
  JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
] as const;

function startsAtFromMeta(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).startsAt;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Soft-archive clients and remove future/pending schedule activities + push subscriptions.
 * Keeps the CRM card, signed acquisition docs, and audit history for admin archive.
 */
export async function archiveAgencyClients(params: {
  agencyUserId: number;
  clientIds: number[];
}): Promise<{ archivedIds: number[]; clearedActivities: number; clearedPush: number }> {
  const ids = [...new Set(params.clientIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return { archivedIds: [], clearedActivities: 0, clearedPush: 0 };

  const owned = await prisma.agencyClient.findMany({
    where: { agencyUserId: params.agencyUserId, id: { in: ids }, status: 'ACTIVE' },
    select: { id: true },
  });
  const ownedIds = owned.map((row) => row.id);
  if (!ownedIds.length) return { archivedIds: [], clearedActivities: 0, clearedPush: 0 };

  const now = Date.now();
  const activities = await prisma.agencyClientActivity.findMany({
    where: {
      clientId: { in: ownedIds },
      kind: { in: [...SCHEDULE_KINDS] },
    },
    select: { id: true, metadata: true },
  });

  const activityIdsToDelete = activities
    .filter((row) => {
      const startsAt = startsAtFromMeta(row.metadata);
      // Drop future/pending slots; keep historical past meetings in archive trail via other activities.
      return !startsAt || startsAt.getTime() >= now - 2 * 60 * 60 * 1000;
    })
    .map((row) => row.id);

  const result = await prisma.$transaction(async (tx) => {
    if (activityIdsToDelete.length) {
      await tx.agencyClientActivity.deleteMany({ where: { id: { in: activityIdsToDelete } } });
    }
    const push = await tx.clientPortalPushSubscription.deleteMany({
      where: { clientId: { in: ownedIds } },
    });
    await tx.agencyClient.updateMany({
      where: { id: { in: ownedIds }, agencyUserId: params.agencyUserId },
      data: { status: 'ARCHIVED' },
    });
    await tx.agencyClientActivity.createMany({
      data: ownedIds.map((clientId) => ({
        clientId,
        agencyUserId: params.agencyUserId,
        kind: 'CLIENT_ARCHIVED',
        title: 'Klient przeniesiony do archiwum',
        body: 'Spotkania i planowania zostały wyczyszczone. Kartę może trwale usunąć tylko administrator.',
        metadata: { archivedAt: new Date().toISOString() },
      })),
    });
    return { clearedPush: push.count };
  });

  return {
    archivedIds: ownedIds,
    clearedActivities: activityIdsToDelete.length,
    clearedPush: result.clearedPush,
  };
}

export async function restoreAgencyClient(params: {
  clientId: number;
}): Promise<boolean> {
  const updated = await prisma.agencyClient.updateMany({
    where: { id: params.clientId, status: 'ARCHIVED' },
    data: { status: 'ACTIVE' },
  });
  return updated.count > 0;
}
