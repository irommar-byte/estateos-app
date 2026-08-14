import { prisma } from '@/lib/prisma';
import {
  buyerPrefToRadarRecord,
  passesBuyerThreshold,
  scoreOfferForBuyerPref,
} from '@/lib/agencyClientShape';

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
} as const;

export async function refreshAgencyClientMatches(clientId: number) {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: { buyerPreference: true },
  });
  if (!client || client.type !== 'BUYER' || !client.buyerPreference) {
    return { upserted: 0, matches: [] };
  }

  const offers = await prisma.offer.findMany({
    where: { status: 'ACTIVE' },
    select: OFFER_SELECT,
  });

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
    select: { id: true, offerId: true },
  });
  const stale = existing.filter((e) => !keepIds.has(e.offerId));
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
      data: {
        clientId,
        href: `/moje-konto/crm?tab=klienci&clientId=${clientId}`,
      },
      idempotencyKey: `client-match-${clientId}-${top.offerId}-${newlyCreated.length}`,
    }).catch(() => {});
  }

  return { upserted: upserts.length, newMatches: newlyCreated.length, matches: upserts };
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
