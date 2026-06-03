import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { ensurePageVisitLogTable } from '@/lib/pageVisitLogTable';
import {
  aggregateVisitorsFromVisits,
  buildVisitorCountryStats,
  type RawPageVisit,
} from '@/lib/pageVisitAnalytics';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensurePageVisitLogTable();

    const usersCount = await prisma.user.count();
    const totalOffers = await prisma.offer.count();
    const activeOffers = await prisma.offer.count({
      where: { status: 'ACTIVE' }
    });

    const offersRaw = await prisma.offer.findMany({
      select: {
        price: true,
        area: true,
        district: true,
        createdAt: true,
        status: true,
        propertyType: true
      }
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

    // BEZPIECZNE LICZENIE
    const totalValue = offersRaw.reduce((acc, curr) => {
      const price = Number(String(curr.price || "0").replace(/\D/g, ""));
      return acc + (isNaN(price) ? 0 : price);
    }, 0);

    const pageViews = visitsRaw.length;
    const uniqueViews = new Set(visitsRaw.map((v: any) => String(v.ip || ''))).size;

    return NextResponse.json({
      kpis: {
        users: usersCount,
        offers: totalOffers,
        active: activeOffers,
        totalValue,
        pageViews,
        uniqueViews
      },
      timeline: {
        offers: offersRaw,
        visits: visitsRaw,
        visitors,
        visitorCountries,
        visitorGeoInsight: {
          uniqueVisitors: visitors.length,
          countriesDetected: visitorCountries.length,
          polandPageViewSharePct: plSharePct,
          geoFromEdge,
          geoFromLookup,
          note:
            plSharePct >= 95 && geoFromLookup === 0
              ? 'Prawie wszystkie wizyty mają kraj PL — sprawdź, czy strona jest za Cloudflare/Vercel (nagłówki geo). Nowe wizyty używają lookup IP, gdy brak nagłówka CDN.'
              : null,
        },
        users: usersTimelineRaw.map((u) => ({
          createdAt: u.createdAt,
          // W obecnym modelu user jest jednocześnie buyer + seller.
          isBuyer: true,
          isSeller: true,
          role: u.role
        }))
      }
    });

  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Błąd obliczeń" }, { status: 500 });
  }
}
