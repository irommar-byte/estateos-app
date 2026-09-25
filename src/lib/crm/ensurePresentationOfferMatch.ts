import { prisma } from '@/lib/prisma';

/** Upewnij się, że kupujący ma match na ofertę prezentacji (wzór pod Intelligence / stos „Nowe”). */
export async function ensurePresentationOfferMatch(params: {
  buyerClientId: number;
  offerId: number;
}): Promise<{ created: boolean; matchId: number | null }> {
  const offerId = Number(params.offerId);
  const buyerClientId = Number(params.buyerClientId);
  if (!Number.isFinite(offerId) || offerId <= 0 || !Number.isFinite(buyerClientId) || buyerClientId <= 0) {
    return { created: false, matchId: null };
  }

  const existing = await prisma.agencyClientMatch.findUnique({
    where: { clientId_offerId: { clientId: buyerClientId, offerId } },
    select: { id: true },
  });
  if (existing) return { created: false, matchId: existing.id };

  const offer = await prisma.offer.findFirst({
    where: { id: offerId },
    select: { id: true },
  });
  if (!offer) return { created: false, matchId: null };

  const created = await prisma.agencyClientMatch.create({
    data: {
      clientId: buyerClientId,
      offerId,
      score: 100,
      notifiedAt: new Date(),
      sharedAt: new Date(),
      intelligenceSent: false,
      intelligenceReason: 'Seed z umówionej prezentacji — wzór pod kolejne propozycje.',
      clientFeedback: JSON.stringify({
        sentiment: 'view',
        source: 'presentation_seed',
        note: 'Oferta umówiona do oglądania — pierwsza propozycja w panelu.',
      }),
    },
    select: { id: true },
  });
  return { created: true, matchId: created.id };
}
