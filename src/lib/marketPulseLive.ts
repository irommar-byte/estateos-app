import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";
import type {
  DemandLevel,
  PulseEvent,
  PulseHeadline,
} from "@/types/marketPulse";

export type { PulseHeadline, PulseEvent, DemandLevel } from "@/types/marketPulse";

export type MarketPulsePayload = {
  updatedAt: string;
  metrics: {
    avgPricePerSqm: number | null;
    activeOffers: number;
    newOffers24h: number;
    marketCities: number;
    demandLevel: DemandLevel;
  };
  headlines: PulseHeadline[];
  events: PulseEvent[];
};

function parsePrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number.parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function propertyLabel(type: string | null | undefined, locale: Locale): string {
  const pl: Record<string, string> = {
    FLAT: "mieszkanie",
    HOUSE: "dom",
    PLOT: "działka",
    COMMERCIAL: "lokal użytkowy",
    GARAGE: "garaż",
    WAREHOUSE: "magazyn",
  };
  const en: Record<string, string> = {
    FLAT: "apartment",
    HOUSE: "house",
    PLOT: "plot",
    COMMERCIAL: "commercial unit",
    GARAGE: "garage",
    WAREHOUSE: "warehouse",
  };
  const map = locale === "pl" ? pl : en;
  const key = String(type ?? "FLAT").toUpperCase();
  return map[key] ?? (locale === "pl" ? "nieruchomość" : "property");
}

function demandFromNewOffers(count: number): DemandLevel {
  if (count >= 5) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export async function buildMarketPulse(locale: Locale): Promise<MarketPulsePayload> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const isPl = locale === "pl";

  const [
    activeOffers,
    newOffers24h,
    citiesRaw,
    recentOffers,
    topCities,
    flats,
    recentBids,
    acceptedAppointments,
    newProUsers,
  ] = await Promise.all([
    prisma.offer.count({ where: { status: "ACTIVE" } }),
    prisma.offer.count({
      where: { status: "ACTIVE", createdAt: { gte: dayAgo } },
    }),
    prisma.offer.groupBy({
      by: ["city"],
      where: { status: "ACTIVE" },
    }),
    prisma.offer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        city: true,
        title: true,
        transactionType: true,
        propertyType: true,
        createdAt: true,
      },
    }),
    prisma.offer.groupBy({
      by: ["city"],
      where: { status: "ACTIVE" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
    prisma.offer.findMany({
      where: { status: "ACTIVE", propertyType: "FLAT", area: { gt: 0 } },
      select: { price: true, area: true },
      take: 500,
    }),
    prisma.bid.findMany({
      where: { createdAt: { gte: twoDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        deal: {
          select: {
            offer: { select: { id: true, city: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { status: "ACCEPTED", createdAt: { gte: twoDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        deal: {
          select: {
            offer: { select: { id: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        createdAt: { gte: twoDaysAgo },
        OR: [{ isPro: true }, { planType: { not: "NONE" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, buyerType: true, isPro: true },
    }),
  ]);

  let totalPrice = 0;
  let totalArea = 0;
  for (const o of flats) {
    const p = parsePrice(o.price);
    const a = parsePrice(o.area);
    if (p > 0 && a > 0) {
      totalPrice += p;
      totalArea += a;
    }
  }
  const avgPricePerSqm = totalArea > 0 ? Math.round(totalPrice / totalArea) : null;
  const marketCities = citiesRaw.map((c) => c.city).filter(Boolean).length;
  const demandLevel = demandFromNewOffers(newOffers24h);

  const sourceLive = isPl ? "EstateOS Live" : "EstateOS Live";
  const sourceAnalytics = isPl ? "EstateOS Analytics" : "EstateOS Analytics";
  const sourceTerminal = isPl ? "EstateOS Terminal" : "EstateOS Terminal";
  const sourceIntel = isPl ? "EstateOS Intel" : "EstateOS Intel";

  const headlines: PulseHeadline[] = [];

  for (const o of recentOffers) {
    const rent = String(o.transactionType).toUpperCase() === "RENT";
    const city = o.city?.trim() || (isPl ? "Polska" : "Poland");
    const prop = propertyLabel(o.propertyType, locale);
    const tx = rent ? (isPl ? "wynajem" : "lease") : isPl ? "sprzedaż" : "sale";
    headlines.push({
      id: `offer-${o.id}`,
      type: "LISTING",
      title: isPl
        ? `${city}: ${tx} — ${prop} (#${o.id}) na radarze inwestorów.`
        : `${city}: ${tx} — ${prop} (#${o.id}) on the investor radar.`,
      source: sourceLive,
    });
  }

  if (activeOffers > 0) {
    headlines.push({
      id: "metric-active",
      type: "METRIC",
      title: isPl
        ? `Rynek: ${activeOffers.toLocaleString("pl-PL")} aktywnych ofert w ${marketCities} lokalizacjach.`
        : `Market: ${activeOffers.toLocaleString("en-US")} active listings across ${marketCities} locations.`,
      source: sourceAnalytics,
    });
  }

  if (newOffers24h > 0) {
    headlines.push({
      id: "metric-new24",
      type: "METRIC",
      title: isPl
        ? `+${newOffers24h} nowych publikacji w ostatnich 24 godzinach na platformie.`
        : `+${newOffers24h} new listings published in the last 24 hours.`,
      source: sourceTerminal,
    });
  }

  if (avgPricePerSqm) {
    headlines.push({
      id: "metric-avg",
      type: "METRIC",
      title: isPl
        ? `Średnia rynkowa: ${avgPricePerSqm.toLocaleString("pl-PL")} zł/m² (mieszkania na EstateOS™).`
        : `Market average: ${avgPricePerSqm.toLocaleString("en-US")} PLN/m² (flats on EstateOS™).`,
      source: sourceAnalytics,
    });
  }

  for (const row of topCities) {
    const city = row.city?.trim();
    const count = row._count.id;
    if (!city || count < 2) continue;
    headlines.push({
      id: `city-${city}`,
      type: "METRIC",
      title: isPl
        ? `${city}: ${count} aktywnych ofert — jeden z najgorętszych rynków na platformie.`
        : `${city}: ${count} active listings — among the hottest markets on the platform.`,
      source: sourceLive,
    });
  }

  headlines.push({
    id: "intel-premarket",
    type: "INTEL",
    title: isPl
      ? "Premiera: nowe oferty przez pierwsze 24 h widzą PRO i właściciel — potem trafiają na szeroki rynek."
      : "Pre-market: new listings are visible to PRO and owners for 24h — then they hit the open market.",
    source: sourceIntel,
  });

  const events: PulseEvent[] = [];

  for (const bid of recentBids) {
    const offerId = bid.deal?.offer?.id;
    const city = bid.deal?.offer?.city;
    const amount = Math.round(bid.amount).toLocaleString(isPl ? "pl-PL" : "en-US");
    events.push({
      id: `bid-${bid.id}`,
      icon: "HandCoins",
      color: "text-yellow-400",
      text: isPl
        ? `LICYTACJA: Oferta #${offerId ?? "?"}${city ? ` (${city})` : ""} — propozycja ${amount} PLN`
        : `BID: Listing #${offerId ?? "?"}${city ? ` (${city})` : ""} — offer ${amount} PLN`,
    });
  }

  for (const app of acceptedAppointments) {
    const offerId = app.deal?.offer?.id;
    events.push({
      id: `app-${app.id}`,
      icon: "CheckCircle2",
      color: "text-blue-400",
      text: isPl
        ? `SUKCES: Zaakceptowano termin prezentacji — oferta #${offerId ?? "?"}`
        : `SUCCESS: Viewing slot accepted — listing #${offerId ?? "?"}`,
    });
  }

  for (const u of newProUsers) {
    const label =
      u.buyerType === "agency"
        ? isPl
          ? "Agencja"
          : "Agency"
        : isPl
          ? "Inwestor PRO"
          : "PRO investor";
    events.push({
      id: `user-${u.id}`,
      icon: "UserPlus",
      color: "text-emerald-400",
      text: isPl ? `ZAREJESTROWANO: Nowy użytkownik ${label}` : `REGISTERED: New ${label} user`,
    });
  }

  if (newOffers24h > 0) {
    events.push({
      id: "sys-radar",
      icon: "Zap",
      color: "text-purple-400",
      text: isPl
        ? `SYSTEM: Radar przeliczył ${newOffers24h} nowych dopasowań (24 h)`
        : `SYSTEM: Radar recalculated ${newOffers24h} new matches (24h)`,
    });
  }

  if (demandLevel === "high") {
    events.push({
      id: "trend-demand",
      icon: "TrendingUp",
      color: "text-emerald-400",
      text: isPl
        ? `POPYT: Wysoka aktywność inwestycyjna — ${newOffers24h} nowych ofert w 24 h`
        : `DEMAND: High investment activity — ${newOffers24h} new listings in 24h`,
    });
  }

  if (events.length === 0) {
    events.push({
      id: "idle",
      icon: "Zap",
      color: "text-white/40",
      text: isPl
        ? "SYSTEM: Oczekiwanie na zdarzenia rynkowe — synchronizacja aktywna"
        : "SYSTEM: Awaiting market events — sync active",
    });
  }

  return {
    updatedAt: now.toISOString(),
    metrics: {
      avgPricePerSqm,
      activeOffers,
      newOffers24h,
      marketCities,
      demandLevel,
    },
    headlines: headlines.slice(0, 24),
    events: events.slice(0, 20),
  };
}
