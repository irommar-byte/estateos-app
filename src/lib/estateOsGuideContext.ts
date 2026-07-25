import { prisma } from '@/lib/prisma';

export async function buildEstateOsGuideContext(userId: number) {
  const [profile, tropes] = await Promise.all([
    prisma.discoveryProfile.findUnique({
      where: { userId },
      select: { confidence: true, contradictionIndex: true, searchPhase: true, updatedAt: true },
    }),
    prisma.discoveryTrope.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { offerId: true, status: true, priority: true, visitOutcome: true, updatedAt: true },
    }),
  ]);
  const priority = tropes.find((trope) => trope.status === 'SERIOUS' || trope.priority);
  const nextStep =
    profile?.searchPhase === 'COMPLETED'
      ? { key: 'JOURNEY_COMPLETE', title: 'Twoja faza poszukiwania jest domknięta.', action: 'PROFILE' }
      : priority
        ? { key: 'SERIOUS_TROPE', title: 'Masz ważny trop, który warto spokojnie pogłębić.', action: 'TROPES', offerId: priority.offerId }
        : (profile?.contradictionIndex || 0) >= 0.55
          ? { key: 'CONTRADICTION_CARE', title: 'Możemy zwolnić i spokojnie uporządkować kierunek.', action: 'DISCOVERY' }
          : (profile?.confidence || 0) >= 0.35
            ? { key: 'CONTINUE_DISCOVERY', title: 'Twój kierunek jest coraz wyraźniejszy.', action: 'DISCOVERY' }
            : { key: 'START_DISCOVERY', title: 'Zacznijmy od miejsc, które coś w Tobie poruszą.', action: 'DISCOVERY' };

  return {
    confidence: profile?.confidence || 0,
    contradictionIndex: profile?.contradictionIndex || 0,
    searchPhase: profile?.searchPhase || 'ACTIVE',
    tropes,
    nextStep,
  };
}
