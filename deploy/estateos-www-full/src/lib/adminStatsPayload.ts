import { prisma } from '@/lib/prisma';
import { buildTimelineInsights } from '@/lib/adminTimelineAnalytics';
import { serializeDbDateTime } from '@/lib/datetime/warsaw';
import {
  aggregateVisitorsFromVisits,
  buildVisitorCountryStats,
  type RawPageVisit,
} from '@/lib/pageVisitAnalytics';
import { ensurePageVisitLogTable } from '@/lib/pageVisitLogTable';

export async function getAdminStatsPayload() {
  await ensurePageVisitLogTable();

  const usersCount = await prisma.user.count();
  const totalOffers = await prisma.offer.count();
  const activeOffers = await prisma.offer.count({
    where: { status: 'ACTIVE' },
  });

  const offersRaw = await prisma.offer.findMany({
    select: {
      price: true,
      area: true,
      district: true,
      city: true,
      createdAt: true,
      status: true,
      propertyType: true,
      localityCountry: true,
      localityCountryCode: true,
    },
  });

  const usersTimelineRaw = await prisma.user.findMany({
    select: {
      createdAt: true,
      role: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const visitsRaw = await prisma.$queryRawUnsafe<RawPageVisit[]>(`
    SELECT ip, country, city, regionName, isp, geoSource, deviceType, path, userAgent, createdAt
    FROM PageVisitLog
    ORDER BY createdAt DESC
    LIMIT 5000
  `);

  const visitors = aggregateVisitorsFromVisits(visitsRaw, 50);
  const visitorCountries = buildVisitorCountryStats(visitors);
  const plSharePct = visitorCountries.find((c) => c.countryCode === 'PL')?.sharePct ?? 0;
  const geoFromEdge = visitors.filter((v) => v.geoSource === 'cloudflare' || v.geoSource === 'vercel').length;
  const geoFromLookup = visitors.filter((v) => v.geoSource === 'ipapi').length;

  const totalValue = offersRaw.reduce((acc, curr) => {
    const price = Number(String(curr.price || '0').replace(/\D/g, ''));
    return acc + (Number.isNaN(price) ? 0 : price);
  }, 0);

  const pageViews = visitsRaw.length;
  const uniqueViews = new Set(visitsRaw.map((v) => String(v.ip || ''))).size;

  const timeline = {
    offers: offersRaw.map((o) => ({
      ...o,
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
      firstVisit: serializeDbDateTime(v.firstVisit),
      lastVisit: serializeDbDateTime(v.lastVisit),
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
