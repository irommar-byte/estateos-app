import { prisma } from '@/lib/prisma';
import { buildDeskTimeline, type DeskTimelineItem } from '@/lib/desk/timeline';
import { fetchOfferPriceHistory } from '@/lib/offerPriceHistory';

type ActivityRow = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId?: number | null;
  metadata?: unknown;
  createdAt: Date | string;
  agencyUserId?: number;
};

type TaskRow = {
  id: number;
  title: string;
  status: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  trigger?: string | null;
  metadata?: unknown;
};

async function fetchViewCount(offerId: number): Promise<number> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      offerId,
    )) as Array<{ total: bigint | number }>;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

/** Unified 360° timeline — aggregates existing data sources, no duplicate comms. */
export async function buildAggregateDeskTimeline(params: {
  clientId: number;
  caseId: number;
  agencyUserId: number;
  linkedOfferId?: number | null;
  activities: ActivityRow[];
  tasks: TaskRow[];
}): Promise<DeskTimelineItem[]> {
  const base = buildDeskTimeline({ activities: params.activities, tasks: params.tasks });
  const extra: DeskTimelineItem[] = [];

  const offerId = params.linkedOfferId;
  if (offerId) {
    const ownedOffer = await prisma.offer.findFirst({
      where: { id: offerId, userId: params.agencyUserId },
      select: { id: true },
    });
    if (!ownedOffer) {
      const merged = [...base];
      merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      return merged;
    }

    try {
      const history = await fetchOfferPriceHistory(offerId);
      for (const row of history) {
        if (row.changeType === 'INITIAL') continue;
        extra.push({
          id: `price-${row.id}`,
          at: row.recordedAt.toISOString(),
          kind: 'PRICE_HISTORY',
          title: row.changeType === 'DECREASE' ? 'Obniżka ceny' : 'Podwyżka ceny',
          body: `${Math.round(row.pricePln).toLocaleString('pl-PL')} PLN`,
          source: 'system',
          offerId,
          metadata: row,
        });
      }
    } catch {
      /* optional */
    }

    const [matches, deals, ohEvents, viewCount] = await Promise.all([
      prisma.agencyClientMatch.findMany({
        where: { offerId, client: { agencyUserId: params.agencyUserId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { client: { select: { firstName: true, lastName: true, agencyUserId: true } } },
      }),
      prisma.deal.findMany({
        where: { offerId, sellerId: params.agencyUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          buyer: { select: { name: true, email: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 5 },
          bids: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      }),
      prisma.openHouseEvent.findMany({
        where: { offerId, hostUserId: params.agencyUserId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          slots: {
            include: {
              reservations: {
                include: { user: { select: { name: true, email: true } } },
              },
            },
          },
        },
      }),
      fetchViewCount(offerId),
    ]);

    if (viewCount > 0) {
      extra.push({
        id: `views-${offerId}`,
        at: new Date().toISOString(),
        kind: 'OFFER_VIEWS',
        title: 'Wyświetlenia oferty',
        body: `${viewCount} unikalnych odwiedzin`,
        source: 'system',
        offerId,
      });
    }

    for (const m of matches) {
      extra.push({
        id: `match-${m.id}`,
        at: m.createdAt.toISOString(),
        kind: 'MATCHING',
        title: `Dopasowanie ${m.score}%`,
        body: `${m.client.firstName} ${m.client.lastName}`,
        source: 'system',
        offerId,
        metadata: { score: m.score, notifiedAt: m.notifiedAt, sharedAt: m.sharedAt },
      });
    }

    for (const d of deals) {
      extra.push({
        id: `deal-${d.id}`,
        at: d.createdAt.toISOString(),
        kind: 'DEAL_ROOM',
        title: `Deal · ${d.status}`,
        body: d.buyer?.name || d.buyer?.email || 'Kupujący',
        source: 'deal',
        offerId,
        metadata: { dealId: d.id, status: d.status },
      });
      for (const msg of d.messages) {
        extra.push({
          id: `deal-msg-${msg.id}`,
          at: msg.createdAt.toISOString(),
          kind: 'DEAL_MESSAGE',
          title: 'Deal Room — wiadomość',
          body: msg.content.slice(0, 200),
          source: 'deal',
          offerId,
          metadata: { dealId: d.id, senderId: msg.senderId },
        });
      }
      for (const bid of d.bids) {
        extra.push({
          id: `deal-bid-${bid.id}`,
          at: bid.createdAt.toISOString(),
          kind: 'BID',
          title: `Oferta cenowa · ${Math.round(bid.amount).toLocaleString('pl-PL')} PLN`,
          body: bid.message?.slice(0, 120) || null,
          source: 'deal',
          offerId,
          metadata: { dealId: d.id, status: bid.status },
        });
      }
    }

    for (const ev of ohEvents) {
      extra.push({
        id: `oh-${ev.id}`,
        at: ev.createdAt.toISOString(),
        kind: 'OPEN_HOUSE',
        title: `Open House · ${ev.status}`,
        source: 'system',
        offerId,
        metadata: { eventId: ev.id, visitMode: ev.visitMode },
      });
      for (const slot of ev.slots) {
        for (const res of slot.reservations) {
          extra.push({
            id: `oh-guest-${res.id}`,
            at: res.createdAt.toISOString(),
            kind: 'OH_GUEST',
            title: 'Rezerwacja OH',
            body: res.user.name || res.user.email || null,
            source: 'system',
            offerId,
          });
        }
      }
    }

    const auctions = await prisma.auctionEvent.findMany({
      where: { offerId, hostUserId: params.agencyUserId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        bids: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { user: { select: { name: true } } },
        },
      },
    }).catch(() => [] as Array<never>);

    for (const auc of auctions) {
      extra.push({
        id: `auction-${auc.id}`,
        at: auc.createdAt.toISOString(),
        kind: 'AUCTION',
        title: `Aukcja · ${auc.status}`,
        source: 'system',
        offerId,
      });
      for (const bid of auc.bids) {
        extra.push({
          id: `auction-bid-${bid.id}`,
          at: bid.createdAt.toISOString(),
          kind: 'AUCTION_BID',
          title: `Licytacja · ${Math.round(Number(bid.amount)).toLocaleString('pl-PL')} PLN`,
          body: bid.user?.name || null,
          source: 'system',
          offerId,
        });
      }
    }
  }

  const merged = [...base, ...extra];
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged;
}
