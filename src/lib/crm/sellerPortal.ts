import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';

/**
 * Panel sprzedającego v2: statystyki ogłoszenia, oferty kupujących z rekomendacją agenta,
 * opinie z oglądań, konkurencja w okolicy i dane do wyliczenia „ile na rękę”.
 */

export const SHOWING_FEEDBACK_TAGS = {
  positive: ['Jasne wnętrza', 'Dobra lokalizacja', 'Dobry układ', 'Cicha okolica', 'Ładny widok', 'Dobry stan'],
  negative: ['Cena wysoka', 'Łazienka do remontu', 'Kuchnia do remontu', 'Głośno', 'Mały metraż', 'Brak parkingu', 'Wysokie opłaty'],
} as const;

const NEGATIVE = new Set<string>(SHOWING_FEEDBACK_TAGS.negative);

export type SellerFinance = {
  mortgageBalance: number | null;
  purchaseYear: number | null;
  purchasePrice: number | null;
  commissionPct: number | null;
  commissionVat: boolean;
  otherCosts: number | null;
};

export function parseSellerFinance(raw: unknown): SellerFinance {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (x: unknown) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    mortgageBalance: num(v.mortgageBalance),
    purchaseYear: num(v.purchaseYear),
    purchasePrice: num(v.purchasePrice),
    commissionPct: num(v.commissionPct),
    commissionVat: v.commissionVat !== false,
    otherCosts: num(v.otherCosts),
  };
}

/**
 * „Ile na rękę”: cena − spłata kredytu − wynagrodzenie biura (+VAT) − podatek − koszty.
 * Podatek: 19% od dochodu, gdy sprzedaż przed końcem 5 lat podatkowych od roku nabycia
 * (uproszczenie — bez ulgi mieszkaniowej; panel pokazuje to jako wyliczenie orientacyjne).
 */
export function computeNetProceeds(price: number, finance: SellerFinance, now = new Date()) {
  const commissionPct = finance.commissionPct ?? 0;
  const commissionNet = Math.round((price * commissionPct) / 100);
  const commission = finance.commissionVat ? Math.round(commissionNet * 1.23) : commissionNet;
  const mortgage = Math.round(finance.mortgageBalance ?? 0);
  const other = Math.round(finance.otherCosts ?? 300);
  let tax = 0;
  let taxNote = 'Brak danych o nabyciu — podatek do potwierdzenia.';
  if (finance.purchaseYear) {
    const taxFreeFrom = finance.purchaseYear + 6;
    if (now.getFullYear() >= taxFreeFrom) {
      tax = 0;
      taxNote = 'Podatek 0 zł — minęło 5 lat od końca roku nabycia.';
    } else if (finance.purchasePrice) {
      const gain = Math.max(0, price - finance.purchasePrice - commission - other);
      tax = Math.round(gain * 0.19);
      taxNote = `19% od dochodu (sprzedaż przed ${taxFreeFrom} r.). Ulga mieszkaniowa może go obniżyć do zera.`;
    } else {
      taxNote = `Sprzedaż przed ${taxFreeFrom} r. — podatek zależy od ceny zakupu.`;
    }
  }
  const net = price - mortgage - commission - tax - other;
  return { price, mortgage, commission, commissionPct, tax, taxNote, other, net };
}

export async function loadListingStats(clientId: number, offerId: number | null) {
  if (!offerId) return null;
  const [views, matches, showings, buyerOffers] = await Promise.all([
    prisma.offerViewLog.count({ where: { offerId } }).catch(() => 0),
    prisma.agencyClientMatch.count({ where: { offerId, notifiedAt: { not: null } } }).catch(() => 0),
    prisma.agencyClientActivity
      .count({ where: { offerId, kind: JOURNEY_ACTIVITY.PRESENTATION_HELD } })
      .catch(() => 0),
    prisma.sellerBuyerOffer.count({ where: { clientId } }).catch(() => 0),
  ]);
  return { views, matches, showings, buyerOffers };
}

export async function loadSellerBuyerOffers(clientId: number) {
  const rows = await prisma.sellerBuyerOffer
    .findMany({ where: { clientId }, orderBy: [{ status: 'asc' }, { amount: 'desc' }], take: 20 })
    .catch(() => []);
  return rows.map((row) => ({
    id: row.id,
    buyerLabel: row.buyerLabel,
    amount: row.amount,
    financing: row.financing,
    deposit: row.deposit,
    deedWeeks: row.deedWeeks,
    handoverDays: row.handoverDays,
    note: row.note,
    recommendation: row.recommendation,
    recommendationKind: row.recommendationKind,
    status: row.status,
    clientResponse: row.clientResponse,
    clientComment: row.clientComment,
    counterAmount: row.counterAmount,
    respondBy: row.respondBy?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function loadShowingFeedbackSummary(clientId: number) {
  const rows = await prisma.sellerShowingFeedback
    .findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 60 })
    .catch(() => []);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : [];
    for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, negative: NEGATIVE.has(tag) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { showings: rows.length, items };
}

export async function loadSellerCompetition(offer: {
  id: number;
  city: string | null;
  district: string | null;
  area: number | null;
  rooms: number | null;
  price: unknown;
  createdAt: Date;
} | null) {
  if (!offer || !offer.city || !offer.area) return null;
  const area = Number(offer.area);
  const price = Number(offer.price);
  const similar = await prisma.offer
    .findMany({
      where: {
        id: { not: offer.id },
        status: 'ACTIVE',
        city: offer.city,
        ...(offer.district ? { district: offer.district } : {}),
        area: { gte: area * 0.8, lte: area * 1.2 },
        ...(offer.rooms ? { rooms: offer.rooms } : {}),
      },
      select: { price: true, area: true, createdAt: true },
      take: 40,
    })
    .catch(() => []);
  const ppsm = (p: unknown, a: unknown) => {
    const pp = Number(p);
    const aa = Number(a);
    return pp > 0 && aa > 0 ? pp / aa : null;
  };
  const similarPpsm = similar.map((o) => ppsm(o.price, o.area)).filter((v): v is number => v != null);
  const avg = similarPpsm.length ? similarPpsm.reduce((s, v) => s + v, 0) / similarPpsm.length : null;
  const avgDays = similar.length
    ? similar.reduce((s, o) => s + (Date.now() - o.createdAt.getTime()) / 86_400_000, 0) / similar.length
    : null;
  const stat = await prisma.marketAreaStat
    .findFirst({
      where: { city: offer.city, district: offer.district || '', periodDays: 365, marketType: 'all' },
      select: { medianPpsm: true, txnCount: true },
    })
    .catch(() => null);
  return {
    ownPpsm: ppsm(price, area) ? Math.round(ppsm(price, area) as number) : null,
    ownDays: Math.max(0, Math.round((Date.now() - offer.createdAt.getTime()) / 86_400_000)),
    similarCount: similar.length,
    similarPpsm: avg ? Math.round(avg) : null,
    similarDays: avgDays != null ? Math.round(avgDays) : null,
    transactionPpsm: stat?.medianPpsm ? Math.round(stat.medianPpsm) : null,
    transactionCount: stat?.txnCount ?? 0,
  };
}

export async function respondToBuyerOffer(params: {
  clientId: number;
  offerId: number;
  response: 'accept' | 'counter' | 'reject';
  counterAmount?: number | null;
  comment?: string | null;
}) {
  const row = await prisma.sellerBuyerOffer.findFirst({ where: { id: params.offerId, clientId: params.clientId } });
  if (!row) throw new Error('Nie znaleziono oferty kupującego.');
  if (row.status !== 'OPEN') throw new Error('Ta oferta jest już rozstrzygnięta.');
  const counter = params.response === 'counter' ? Math.round(Number(params.counterAmount || 0)) : null;
  if (params.response === 'counter' && (!counter || counter <= 0)) throw new Error('Podaj kwotę kontroferty.');
  return prisma.sellerBuyerOffer.update({
    where: { id: row.id },
    data: {
      clientResponse: params.response,
      counterAmount: counter,
      clientComment: String(params.comment || '').trim().slice(0, 1000) || null,
      status: params.response === 'counter' ? 'COUNTERED' : params.response === 'accept' ? 'ACCEPTED' : 'REJECTED',
      updatedAt: new Date(),
    },
  });
}
