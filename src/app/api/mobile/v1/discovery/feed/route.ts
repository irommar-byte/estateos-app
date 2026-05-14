import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(decodedId) && decodedId > 0 ? decodedId : null;
}

type ProfileMap = Record<string, number>;

function statValue(stats: ProfileMap | null | undefined, key: string | null | undefined) {
  if (!stats || !key) return 0;
  return Number(stats[String(key)] || 0);
}

export async function GET(req: Request) {
  try {
    const userId = parseUserIdFromAuthHeader(
      req.headers.get('authorization') || req.headers.get('Authorization')
    );
    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || 'for_you');
    const limitRaw = Number(url.searchParams.get('limit') || 40);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 80) : 40;

    if (mode !== 'for_you') {
      return NextResponse.json({ items: [] });
    }

    const [profile, recentEvents, offers] = await Promise.all([
      prisma.discoveryProfile.findUnique({
        where: { userId },
        select: { cityStats: true, districtStats: true, propertyStats: true, reasonStats: true },
      }),
      prisma.discoveryEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 600,
        select: { eventType: true, offerId: true, reasonCode: true },
      }),
      prisma.offer.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 240,
        select: {
          id: true,
          title: true,
          price: true,
          city: true,
          district: true,
          propertyType: true,
          area: true,
          rooms: true,
          hasBalcony: true,
          hasParking: true,
          isFurnished: true,
        },
      }),
    ]);

    const dislikedOfferIds = new Set(
      recentEvents
        .filter((e) => e.eventType === 'DISCOVERY_DISLIKE' || e.eventType === 'DISCOVERY_DISLIKE_REASON')
        .map((e) => Number(e.offerId))
    );
    const likedOfferIds = new Set(
      recentEvents
        .filter((e) => e.eventType === 'DISCOVERY_LIKE' || e.eventType === 'DISCOVERY_FAST_TRACK')
        .map((e) => Number(e.offerId))
    );

    const cityStats = (profile?.cityStats as ProfileMap | null) || {};
    const districtStats = (profile?.districtStats as ProfileMap | null) || {};
    const propertyStats = (profile?.propertyStats as ProfileMap | null) || {};
    const reasonStats = (profile?.reasonStats as ProfileMap | null) || {};

    const priceTooHighPenalty = Number(reasonStats.PRICE_TOO_HIGH || 0);
    const locationPenalty = Number(reasonStats.LOCATION_MISMATCH || 0);
    const layoutPenalty = Number(reasonStats.LAYOUT_MISMATCH || 0);
    const qualityPenalty = Number(reasonStats.QUALITY_LOW || 0);

    const ranked = offers
      .filter((o) => !likedOfferIds.has(Number(o.id)))
      .map((offer) => {
        let raw = 55;
        const reasons: string[] = [];

        const cityAffinity = statValue(cityStats, offer.city);
        const districtAffinity = statValue(districtStats, offer.district);
        const typeAffinity = statValue(propertyStats, String(offer.propertyType));

        raw += cityAffinity * 2.0;
        raw += districtAffinity * 2.8;
        raw += typeAffinity * 3.2;

        if (cityAffinity > 0) reasons.push(`pasuje do miasta: ${offer.city}`);
        if (districtAffinity > 0) reasons.push(`zgodna dzielnica: ${offer.district}`);
        if (typeAffinity > 0) reasons.push(`preferowany typ: ${offer.propertyType}`);

        if (dislikedOfferIds.has(Number(offer.id))) {
          raw -= 45;
          reasons.push('podobna do odrzuconych');
        }
        if (priceTooHighPenalty > 0 && Number(offer.price || 0) > 0) {
          raw -= Math.min(18, priceTooHighPenalty * 0.9);
        }
        if (locationPenalty > 0) {
          raw -= Math.min(12, locationPenalty * 0.6);
        }
        if (layoutPenalty > 0 && Number(offer.rooms || 0) <= 1) {
          raw -= Math.min(10, layoutPenalty * 0.7);
        }
        if (qualityPenalty > 0 && !offer.hasBalcony && !offer.hasParking) {
          raw -= Math.min(8, qualityPenalty * 0.5);
        }

        const score = Math.max(0, Math.min(100, Math.round(raw)));
        const reason =
          reasons[0] ||
          (score >= 70 ? 'dopasowanie do historii interakcji' : score >= 50 ? 'neutralne dopasowanie' : 'niskie dopasowanie');

        return {
          id: offer.id,
          offerId: offer.id,
          score,
          matchScore: score,
          reason,
          title: offer.title,
          city: offer.city,
          district: offer.district,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({ items: ranked });
  } catch (error) {
    console.error('[DISCOVERY FEED ERROR]', error);
    // Backward compatibility: app fallback na standardowy feed.
    return NextResponse.json({ items: [] });
  }
}
