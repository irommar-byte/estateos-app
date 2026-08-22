import { prisma } from '@/lib/prisma';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';

/**
 * After OfferPriceHistory records a decrease, wire Desk SELL case:
 * matching → Radar task → timeline → NBA.
 */
export async function dispatchDeskPriceDropForOffer(params: {
  offerId: number;
  changeType: 'DECREASE' | 'INCREASE' | 'INITIAL';
  pricePln: number;
  previousPricePln?: number | null;
  source?: string;
}) {
  if (params.changeType !== 'DECREASE') return { dispatched: 0 };

  await ensureDeskSchema();

  const offer = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { id: true, userId: true, title: true, city: true },
  });
  if (!offer?.userId) return { dispatched: 0 };

  const cases = await prisma.deskCase.findMany({
    where: {
      linkedOfferId: params.offerId,
      kind: 'SELL',
      agencyUserId: offer.userId,
      pipelineStage: { notIn: ['LOST', 'AFTERCARE'] },
    },
    select: { id: true, agencyUserId: true },
  });

  let dispatched = 0;
  for (const row of cases) {
    try {
      await dispatchDeskWorkflow({
        agencyUserId: row.agencyUserId,
        caseId: row.id,
        trigger: 'PRICE_CHANGED',
        payload: {
          offerId: params.offerId,
          pricePln: params.pricePln,
          previousPricePln: params.previousPricePln ?? null,
          source: params.source || 'price_history',
          auto: true,
        },
      });
      dispatched += 1;
    } catch {
      /* best-effort per case */
    }
  }

  // Also match cases linked via client.linkedOfferId
  if (dispatched === 0) {
    const clientLinked = await prisma.agencyClient.findMany({
      where: { linkedOfferId: params.offerId, agencyUserId: offer.userId },
      select: { id: true, agencyUserId: true, deskCases: { where: { kind: 'SELL' }, take: 1 } },
    });
    for (const cl of clientLinked) {
      const dc = cl.deskCases[0];
      if (!dc) continue;
      try {
        await prisma.deskCase.update({
          where: { id: dc.id },
          data: { linkedOfferId: params.offerId },
        });
        await dispatchDeskWorkflow({
          agencyUserId: cl.agencyUserId,
          caseId: dc.id,
          trigger: 'PRICE_CHANGED',
          payload: {
            offerId: params.offerId,
            pricePln: params.pricePln,
            previousPricePln: params.previousPricePln ?? null,
            source: params.source || 'price_history',
            auto: true,
          },
        });
        dispatched += 1;
      } catch {
        /* skip */
      }
    }
  }

  return { dispatched };
}
