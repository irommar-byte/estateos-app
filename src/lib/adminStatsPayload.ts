import { prisma } from '@/lib/prisma';
import { buildTimelineInsights } from '@/lib/adminTimelineAnalytics';
import { serializeDbDateTime, serializeInstant } from '@/lib/datetime/warsaw';
import {
  aggregateVisitorsFromVisits,
  buildVisitorCountryStats,
  type RawPageVisit,
} from '@/lib/pageVisitAnalytics';
import { ensurePageVisitLogTable } from '@/lib/pageVisitLogTable';

export async function getAdminStatsPayload() {
  await ensurePageVisitLogTable();

  const [usersCount, totalOffers, activeOffers, marketOffersRaw, usersTimelineRaw, visitsRaw] =
    await Promise.all([
      prisma.user.count(),
      prisma.offer.count(),
      prisma.offer.count({ where: { status: 'ACTIVE' } }),
      prisma.offer.findMany({
        where: { status: 'ACTIVE' },
        select: {
          price: true,
          pricePln: true,
          pricePerSqm: true,
          area: true,
          district: true,
          city: true,
          status: true,
          propertyType: true,
          transactionType: true,
          localityCountry: true,
          localityCountryCode: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        select: { createdAt: true, role: true },
        orderBy: { createdAt: 'desc' },
        take: 3000,
      }),
      prisma.$queryRawUnsafe<RawPageVisit[]>(`
        SELECT ip, country, city, regionName, isp, geoSource, deviceType, path, userAgent, createdAt
        FROM PageVisitLog
        ORDER BY createdAt DESC
        LIMIT 3000
      `),
    ]);

  const visitors = aggregateVisitorsFromVisits(visitsRaw, 50);
  const visitorCountries = buildVisitorCountryStats(visitors);
  const plSharePct = visitorCountries.find((c) => c.countryCode === 'PL')?.sharePct ?? 0;
  const geoFromEdge = visitors.filter((v) => v.geoSource === 'cloudflare' || v.geoSource === 'vercel').length;
  const geoFromLookup = visitors.filter((v) => v.geoSource === 'ipapi').length;

  const totalValue = marketOffersRaw.reduce((acc, curr) => {
    const price = Number(curr.pricePln ?? curr.price ?? 0);
    return acc + (Number.isFinite(price) && price > 0 ? price : 0);
  }, 0);

  const pageViews = visitsRaw.length;
  const uniqueViews = new Set(visitsRaw.map((v) => String(v.ip || ''))).size;

  const timeline = {
    offers: marketOffersRaw.map((o) => ({
      price: o.price,
      pricePln: o.pricePln,
      pricePerSqm: o.pricePerSqm,
      area: o.area,
      district: o.district,
      city: o.city,
      status: o.status,
      propertyType: o.propertyType,
      transactionType: o.transactionType,
      localityCountry: o.localityCountry,
      localityCountryCode: o.localityCountryCode,
      createdAt: serializeDbDateTime(o.createdAt) ?? String(o.createdAt),
    })),
    visits: visitsRaw.map((v) => ({
      ip: v.ip,
      country: v.country,
      city: v.city,
      regionName: v.regionName,
      path: v.path,
      deviceType: v.deviceType,
      createdAt: serializeDbDateTime(v.createdAt) ?? String(v.createdAt),
    })),
    visitors: visitors.map((v) => ({
      ...v,
      firstVisit: serializeInstant(v.firstVisit),
      lastVisit: serializeInstant(v.lastVisit),
    })),
    visitorCountries,
    visitorGeoInsight: {
      uniqueVisitors: visitors.length,
      countriesDetected: visitorCountries.length,
      polandPageViewSharePct: plSharePct,
      geoFromEdge,
      geoFromLookup,
      note:
        plSharePct >= 95 && geoFromLookup === 0
          ? 'Prawie wszystkie wizyty mają kraj PL — sprawdź CDN/geo. Nowe wizyty używają lookup IP, gdy brak nagłówka.'
          : null,
    },
    users: usersTimelineRaw.map((u) => ({
      createdAt: serializeDbDateTime(u.createdAt) ?? String(u.createdAt),
      role: u.role,
    })),
  };

  return {
    kpis: {
      users: usersCount,
      offers: totalOffers,
      active: activeOffers,
      totalValue,
      pageViews,
      uniqueViews,
    },
    timeline,
    insights: buildTimelineInsights(timeline),
  };
}
