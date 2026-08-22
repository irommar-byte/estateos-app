import { prisma } from '@/lib/prisma';
import { fetchOfferPriceHistory, resolveEffectiveListPricePln } from '@/lib/offerPriceHistory';
import { recordSellerSaleUpdate } from '@/lib/crm/sellerSaleUpdates';

export type SellerReportData = {
  offer: {
    id: number;
    title: string | null;
    status: string;
    pricePln: number | null;
    listPricePln: number | null;
    city: string | null;
    district: string | null;
    area: number | null;
    rooms: number | null;
    createdAt: string;
  };
  metrics: {
    views: number;
    inquiries: number;
    interestedBuyers: number;
    presentations: number;
    openHouseGuests: number;
    activeMatches: number;
  };
  publications: Array<{ kind: string; title: string; at: string; url?: string | null }>;
  presentations: Array<{ at: string; title: string; body?: string | null }>;
  debriefs: Array<{ at: string; title: string; metadata?: unknown }>;
  priceHistory: Array<{ at: string; pricePln: number; changeType: string }>;
  marketComparison: Array<{
    id: number;
    title: string | null;
    pricePln: number | null;
    area: number | null;
    pricePerM2: number | null;
    status: string;
  }>;
  priceRecommendation: {
    currentPrice: number;
    listPrice: number;
    discountPercent: number | null;
    vsMarketMedian: number | null;
    recommendation: string;
  };
  observations: string[];
};

async function countViews(offerId: number) {
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

export async function buildSellerReport(params: {
  offerId: number;
  agencyUserId: number;
  clientId?: number | null;
}): Promise<SellerReportData | null> {
  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.agencyUserId },
    select: {
      id: true,
      title: true,
      status: true,
      pricePln: true,
      price: true,
      listPricePln: true,
      city: true,
      district: true,
      area: true,
      rooms: true,
      createdAt: true,
      transactionType: true,
      propertyType: true,
    },
  });
  if (!offer) return null;

  const clientId =
    params.clientId ||
    (
      await prisma.agencyClient.findFirst({
        where: { linkedOfferId: params.offerId, agencyUserId: params.agencyUserId },
        select: { id: true },
      })
    )?.id;

  const [views, matches, activities, history, ohGuests, comparable] = await Promise.all([
    countViews(params.offerId),
    prisma.agencyClientMatch.findMany({
      where: { offerId: params.offerId },
      include: { client: { select: { firstName: true, lastName: true, agencyUserId: true } } },
    }),
    clientId
      ? prisma.agencyClientActivity.findMany({
          where: { clientId, offerId: params.offerId },
          orderBy: { createdAt: 'desc' },
          take: 80,
        })
      : Promise.resolve([]),
    fetchOfferPriceHistory(params.offerId),
    prisma.openHouseReservation.count({
      where: { slot: { event: { offerId: params.offerId } } },
    }).catch(() => 0),
    prisma.offer.findMany({
      where: {
        userId: params.agencyUserId,
        status: 'ACTIVE',
        city: offer.city || undefined,
        district: offer.district || undefined,
        id: { not: params.offerId },
      },
      take: 8,
      select: { id: true, title: true, pricePln: true, area: true, status: true },
    }),
  ]);

  const agencyMatches = matches.filter((m) => m.client.agencyUserId === params.agencyUserId);
  const hotCount = agencyMatches.filter((m) => m.score >= 80).length;

  const publications = activities
    .filter((a) => ['EXTERNAL_PORTAL', 'LISTING_FEATURED', 'DESK_LISTING'].includes(a.kind))
    .map((a) => ({
      kind: a.kind,
      title: a.title || a.kind,
      at: a.createdAt.toISOString(),
      url: (a.metadata as Record<string, unknown> | null)?.url as string | undefined,
    }));

  const presentations = activities
    .filter((a) => a.kind.includes('PRESENTATION'))
    .map((a) => ({
      at: a.createdAt.toISOString(),
      title: a.title || 'Prezentacja',
      body: a.body,
    }));

  const debriefs = activities
    .filter((a) => a.kind === 'DESK_DEBRIEF')
    .map((a) => ({
      at: a.createdAt.toISOString(),
      title: a.title || 'Debrief',
      metadata: a.metadata,
    }));

  const currentPrice = Number(offer.pricePln || offer.price || 0);
  const listPrice = resolveEffectiveListPricePln(offer as Record<string, unknown>);
  const discountPercent =
    listPrice > currentPrice ? Math.round(((listPrice - currentPrice) / listPrice) * 100) : null;

  const compPrices = comparable
    .map((c) => Number(c.pricePln))
    .filter((p) => Number.isFinite(p) && p > 0);
  const median =
    compPrices.length > 0
      ? compPrices.sort((a, b) => a - b)[Math.floor(compPrices.length / 2)]
      : null;
  const vsMarketMedian =
    median && currentPrice ? Math.round(((currentPrice - median) / median) * 100) : null;

  let recommendation = 'Utrzymaj obecną strategię — monitoruj feedback z prezentacji.';
  if (discountPercent != null && discountPercent >= 5) {
    recommendation = 'Obniżka już widoczna — aktywnie kontaktuj HOT kupujących z Radaru.';
  } else if (views > 20 && agencyMatches.length < 3) {
    recommendation = 'Duży ruch, mało dopasowań — rozważ korektę ceny lub lepsze zdjęcia/opis.';
  } else if (vsMarketMedian != null && vsMarketMedian > 8) {
    recommendation = 'Cena powyżej mediany rynku w dzielnicy — rozważ obniżkę 3–5%.';
  } else if (vsMarketMedian != null && vsMarketMedian < -5) {
    recommendation = 'Konkurencyjna cena — maksymalizuj prezentacje i negocjacje.';
  }

  const observations: string[] = [];
  if (views > 0) observations.push(`${views} wyświetleń ogłoszenia.`);
  if (agencyMatches.length > 0) observations.push(`${agencyMatches.length} dopasowanych kupujących (${hotCount} HOT).`);
  if (presentations.length > 0) observations.push(`${presentations.length} prezentacji w timeline.`);
  if (debriefs.length > 0) observations.push(`${debriefs.length} debriefów — ${debriefs.filter((d) => (d.metadata as any)?.temperature === 'HOT').length} HOT.`);
  if (ohGuests > 0) observations.push(`${ohGuests} gości Open House.`);
  if (history.filter((h) => h.changeType === 'DECREASE').length > 0) {
    observations.push('Historia obniżek ceny — wykorzystaj Radar do ponownego wysyłania.');
  }

  return {
    offer: {
      id: offer.id,
      title: offer.title,
      status: offer.status,
      pricePln: offer.pricePln,
      listPricePln: offer.listPricePln,
      city: offer.city,
      district: offer.district,
      area: offer.area,
      rooms: offer.rooms,
      createdAt: offer.createdAt.toISOString(),
    },
    metrics: {
      views,
      inquiries: agencyMatches.filter((m) => m.sharedAt || m.notifiedAt).length,
      interestedBuyers: hotCount,
      presentations: presentations.length,
      openHouseGuests: ohGuests,
      activeMatches: agencyMatches.length,
    },
    publications,
    presentations,
    debriefs,
    priceHistory: history.map((h) => ({
      at: h.recordedAt.toISOString(),
      pricePln: h.pricePln,
      changeType: h.changeType,
    })),
    marketComparison: comparable.map((c) => {
      const price = Number(c.pricePln || 0);
      const area = Number(c.area || 0);
      return {
        id: c.id,
        title: c.title,
        pricePln: c.pricePln,
        area: c.area,
        pricePerM2: area > 0 ? Math.round(price / area) : null,
        status: c.status,
      };
    }),
    priceRecommendation: {
      currentPrice,
      listPrice,
      discountPercent,
      vsMarketMedian,
      recommendation,
    },
    observations,
  };
}

export async function sendSellerReportEmail(params: {
  clientId: number;
  agencyUserId: number;
  offerId: number;
  report: SellerReportData;
}) {
  const summary = params.report.observations.slice(0, 4).join(' ');
  const html = `<div style="font-family:-apple-system,sans-serif;padding:24px;color:#111">
    <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9a7b3c;font-weight:800">EstateOS™ · raport sprzedaży</p>
    <h2 style="margin:8px 0 12px">${params.report.offer.title || 'Twoja nieruchomość'}</h2>
    <p><strong>Cena:</strong> ${params.report.priceRecommendation.currentPrice.toLocaleString('pl-PL')} PLN</p>
    <p><strong>Wyświetlenia:</strong> ${params.report.metrics.views} · <strong>Zainteresowani:</strong> ${params.report.metrics.interestedBuyers}</p>
    <p><strong>Prezentacje:</strong> ${params.report.metrics.presentations} · <strong>OH goście:</strong> ${params.report.metrics.openHouseGuests}</p>
    <p style="margin-top:16px">${params.report.priceRecommendation.recommendation}</p>
    <p style="color:#666;font-size:14px;margin-top:12px">${summary}</p>
    <p style="margin-top:20px"><a href="{{portalUrl}}" style="display:inline-block;background:#9a7b3c;color:#fff;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Panel współpracy</a></p>
  </div>`;

  return recordSellerSaleUpdate({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: 'SELLER_REPORT',
    offerId: params.offerId,
    title: 'Raport sprzedaży — podsumowanie tygodnia',
    body: summary,
    metadata: {
      metrics: params.report.metrics,
      recommendation: params.report.priceRecommendation.recommendation,
    },
    emailSubject: `Raport sprzedaży · ${params.report.offer.title || 'EstateOS™'}`,
    emailHtml: html,
  });
}
