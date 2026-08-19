import { prisma } from '@/lib/prisma';
import {
  passesBuyerThreshold,
  scoreOfferForBuyerPref,
} from '@/lib/agencyClientShape';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';

const OFFER_SELECT = {
  id: true,
  title: true,
  description: true,
  transactionType: true,
  propertyType: true,
  price: true,
  pricePln: true,
  priceCurrency: true,
  area: true,
  rooms: true,
  yearBuilt: true,
  city: true,
  district: true,
  lat: true,
  lng: true,
  hasBalcony: true,
  hasGarden: true,
  hasElevator: true,
  hasParking: true,
  isFurnished: true,
  images: true,
  status: true,
  expiresAt: true,
} as const;

export async function refreshAgencyClientMatches(clientId: number) {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: { buyerPreference: true },
  });
  if (!client || !client.buyerPreference) {
    return { upserted: 0, matches: [] };
  }

  const now = new Date();
  const candidates = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: OFFER_SELECT,
  });
  const publicIds = await activePublicationOfferIds(candidates.map((offer) => offer.id));
  const offers = candidates.filter((offer) => canShowOfferOnPublicMarket(offer, publicIds));

  const upserts: { offerId: number; score: number }[] = [];
  for (const offer of offers) {
    const score = scoreOfferForBuyerPref(client.buyerPreference, offer as Record<string, unknown>);
    if (!passesBuyerThreshold(client.buyerPreference, score)) continue;
    upserts.push({ offerId: offer.id, score: Math.round(score) });
  }

  upserts.sort((a, b) => b.score - a.score);

  const existingBefore = await prisma.agencyClientMatch.findMany({
    where: { clientId },
    select: { offerId: true },
  });
  const existingOfferIds = new Set(existingBefore.map((e) => e.offerId));
  const newlyCreated: { offerId: number; score: number }[] = [];

  for (const row of upserts.slice(0, 100)) {
    const wasNew = !existingOfferIds.has(row.offerId);
    await prisma.agencyClientMatch.upsert({
      where: { clientId_offerId: { clientId, offerId: row.offerId } },
      create: { clientId, offerId: row.offerId, score: row.score },
      update: { score: row.score },
    });
    if (wasNew) newlyCreated.push(row);
  }

  const keepIds = new Set(upserts.slice(0, 100).map((u) => u.offerId));
  const existing = await prisma.agencyClientMatch.findMany({
    where: { clientId },
    select: { id: true, offerId: true, notifiedAt: true, sharedAt: true },
  });
  const stale = existing.filter(
    (e) => !keepIds.has(e.offerId) && !e.notifiedAt && !e.sharedAt,
  );
  if (stale.length) {
    await prisma.agencyClientMatch.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  }

  if (upserts.length > 0) {
    await prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId: client.agencyUserId,
        kind: 'MATCH_REFRESH',
        title: 'Odświeżono dopasowania',
        body: `Znaleziono ${upserts.length} ofert spełniających kryteria klienta.`,
        metadata: { count: upserts.length, newCount: newlyCreated.length },
      },
    });
  }

  if (newlyCreated.length > 0) {
    const { sendNotification } = await import('@/lib/core/notification.core');
    const top = newlyCreated.sort((a, b) => b.score - a.score)[0];
    await sendNotification({
      userId: client.agencyUserId,
      type: 'CRM_EVENT',
      title: 'Nowe dopasowanie do klienta',
      body: `${client.firstName} ${client.lastName}: ${newlyCreated.length} nowych ofert (top ${top.score}%).`,
      data: crmAgentPushData(clientId, {
        notificationType: 'crm_client_match',
        offerId: top.offerId,
        matchCount: newlyCreated.length,
      }),
      idempotencyKey: `client-match-${clientId}-${top.offerId}-${newlyCreated.length}`,
    }).catch(() => {});
  }

  return { upserted: upserts.length, newMatches: newlyCreated.length, matches: upserts };
}

export async function matchPublishedOfferToAgencyClients(
  offer: Record<string, unknown>,
  context: { publicationId?: number | string | bigint | null } = {},
) {
  const offerId = Number(offer.id);
  if (!Number.isFinite(offerId) || offerId <= 0) return { matched: 0, notified: 0 };

  const prefs = await prisma.agencyClientBuyerPreference.findMany({
    where: { client: { status: 'ACTIVE' } },
    include: {
      client: {
        select: {
          id: true,
          agencyUserId: true,
          firstName: true,
          lastName: true,
          linkedOfferId: true,
        },
      },
    },
  });
  if (!prefs.length) return { matched: 0, notified: 0 };

  const existing = await prisma.agencyClientMatch.findMany({
    where: { offerId, clientId: { in: prefs.map((row) => row.clientId) } },
    select: { clientId: true },
  });
  const existingIds = new Set(existing.map((row) => row.clientId));

  const hits: Array<{
    clientId: number;
    agencyUserId: number;
    name: string;
    score: number;
    wasNew: boolean;
  }> = [];

  for (const pref of prefs) {
    if (pref.client.linkedOfferId === offerId) continue;
    const score = scoreOfferForBuyerPref(pref, offer);
    if (!passesBuyerThreshold(pref, score)) continue;
    const rounded = Math.round(score);
    const wasNew = !existingIds.has(pref.clientId);
    await prisma.agencyClientMatch.upsert({
      where: { clientId_offerId: { clientId: pref.clientId, offerId } },
      create: { clientId: pref.clientId, offerId, score: rounded },
      update: { score: rounded },
    });
    hits.push({
      clientId: pref.clientId,
      agencyUserId: pref.client.agencyUserId,
      name: `${pref.client.firstName} ${pref.client.lastName}`.trim(),
      score: rounded,
      wasNew,
    });
  }

  const fresh = hits.filter((row) => row.wasNew);
  if (fresh.length) {
    const { sendNotification } = await import('@/lib/core/notification.core');
    const pub = context.publicationId != null && String(context.publicationId).trim() !== ''
      ? String(context.publicationId)
      : 'legacy';
    const title = String(offer.title || 'Nowa oferta');
    await Promise.allSettled(
      fresh.map((row) =>
        sendNotification({
          userId: row.agencyUserId,
          type: 'CRM_EVENT',
          title: 'Oferta pasuje do Twojego klienta',
          body: `${row.name} · ${row.score}% · ${title}`,
          data: crmAgentPushData(row.clientId, {
            notificationType: 'crm_client_match',
            offerId,
            matchScore: row.score,
          }),
          idempotencyKey: `crm-offer-match:${offerId}:pub:${pub}:client:${row.clientId}`,
        }),
      ),
    );
  }

  return { matched: hits.length, notified: fresh.length };
}

export async function buildAgencyClientReport(agencyUserId: number) {
  const [buyers, sellers, matches, activities] = await Promise.all([
    prisma.agencyClient.count({ where: { agencyUserId, type: 'BUYER', status: 'ACTIVE' } }),
    prisma.agencyClient.count({ where: { agencyUserId, type: 'SELLER', status: 'ACTIVE' } }),
    prisma.agencyClientMatch.count({
      where: { client: { agencyUserId, status: 'ACTIVE' } },
    }),
    prisma.agencyClientActivity.count({
      where: {
        agencyUserId,
        kind: { in: ['OFFER_SHARED', 'CLIENT_NOTIFIED'] },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const topMatches = await prisma.agencyClientMatch.findMany({
    where: { client: { agencyUserId, status: 'ACTIVE', type: 'BUYER' } },
    orderBy: { score: 'desc' },
    take: 5,
    include: {
      client: { select: { firstName: true, lastName: true } },
      offer: { select: { id: true, title: true, city: true, price: true } },
    },
  });

  return {
    buyers,
    sellers,
    totalMatches: matches,
    outreachLast30Days: activities,
    topMatches: topMatches.map((m) => ({
      clientName: `${m.client.firstName} ${m.client.lastName}`.trim(),
      offerId: m.offer.id,
      offerTitle: m.offer.title,
      city: m.offer.city,
      price: m.offer.price,
      score: m.score,
    })),
  };
}
