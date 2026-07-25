import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import { formatOfferPropertyType } from '@/lib/offerDisplayLabels';
import {
  DISCOVERY_META,
  areaAffinityDelta,
  asStatMap,
  metaAvg,
  priceAffinityDelta,
} from '@/lib/discoveryInsights';

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
          pricePln: true,
          priceCurrency: true,
          listPricePln: true,
          city: true,
          district: true,
          propertyType: true,
          transactionType: true,
          area: true,
          rooms: true,
          hasBalcony: true,
          hasParking: true,
          isFurnished: true,
          status: true,
          expiresAt: true,
          images: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const activePublicationIds = await activePublicationOfferIds(
      offers.map((offer) => Number(offer.id)).filter((id) => Number.isFinite(id))
    );

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

    const cityStats = asStatMap(profile?.cityStats);
    const districtStats = asStatMap(profile?.districtStats);
    const propertyStats = asStatMap(profile?.propertyStats);
    const reasonStats = asStatMap(profile?.reasonStats);

    const likedAvgPrice = metaAvg(reasonStats, DISCOVERY_META.priceLikedSum, DISCOVERY_META.priceLikedN);
    const dislikedAvgPrice = metaAvg(
      reasonStats,
      DISCOVERY_META.priceDislikedSum,
      DISCOVERY_META.priceDislikedN,
    );
    const likedAvgArea = metaAvg(reasonStats, DISCOVERY_META.areaLikedSum, DISCOVERY_META.areaLikedN);
    const sellPref = Number(reasonStats[DISCOVERY_META.txSell] || 0);
    const rentPref = Number(reasonStats[DISCOVERY_META.txRent] || 0);

    const priceTooHighPenalty = Number(reasonStats.PRICE_TOO_HIGH || 0);
    const locationPenalty = Number(reasonStats.LOCATION_MISMATCH || 0);
    const layoutPenalty = Number(reasonStats.LAYOUT_MISMATCH || 0);
    const qualityPenalty = Number(reasonStats.QUALITY_LOW || 0);

    const ranked = offers
      .filter((offer) => canShowOfferOnPublicMarket(offer, activePublicationIds))
      .filter((o) => !likedOfferIds.has(Number(o.id)))
      .map((offer) => {
        let raw = 55;
        const reasons: string[] = [];
        const price = Number(offer.pricePln ?? offer.price ?? 0);

        const cityAffinity = statValue(cityStats, offer.city);
        const districtAffinity = statValue(districtStats, offer.district);
        const typeAffinity = statValue(propertyStats, String(offer.propertyType));

        raw += cityAffinity * 2.0;
        raw += districtAffinity * 2.8;
        raw += typeAffinity * 3.2;

        if (cityAffinity > 0) reasons.push(`pasuje do miasta: ${offer.city}`);
        if (districtAffinity > 0) reasons.push(`zgodna dzielnica: ${offer.district}`);
        if (typeAffinity > 0) {
          const typeLabel = formatOfferPropertyType(offer.propertyType, 'pl') || '';
          if (typeLabel) reasons.push(`preferowany typ: ${typeLabel}`);
        }

        const priceDelta = priceAffinityDelta(price, likedAvgPrice, dislikedAvgPrice);
        raw += priceDelta;
        if (priceDelta >= 10) reasons.push('cena w Twoim zakresie');
        else if (priceDelta <= -8) reasons.push('cena poza preferowanym zakresem');

        const areaDelta = areaAffinityDelta(Number(offer.area || 0), likedAvgArea);
        raw += areaDelta;
        if (areaDelta >= 8) reasons.push('metraż zbliżony do lubianych');

        if (sellPref + rentPref >= 3) {
          const isRent = String(offer.transactionType) === 'RENT';
          if (isRent && rentPref > sellPref) {
            raw += 8;
            reasons.push('wynajem — zgodnie z Twoimi swipe’ami');
          } else if (!isRent && sellPref > rentPref) {
            raw += 8;
            reasons.push('sprzedaż — zgodnie z Twoimi swipe’ami');
          } else if ((isRent && sellPref > rentPref * 2) || (!isRent && rentPref > sellPref * 2)) {
            raw -= 10;
          }
        }

        if (dislikedOfferIds.has(Number(offer.id))) {
          raw -= 45;
          reasons.push('już odrzucona');
        }
        if (priceTooHighPenalty > 0 && price > 0) {
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
          (score >= 70
            ? 'dopasowanie do historii interakcji'
            : score >= 50
              ? 'neutralne dopasowanie'
              : 'niskie dopasowanie');

        return {
          id: offer.id,
          offerId: offer.id,
          score,
          matchScore: score,
          reason,
          title: offer.title,
          city: offer.city,
          district: offer.district,
          propertyType: offer.propertyType,
          transactionType: offer.transactionType,
          price: offer.price,
          pricePln: offer.pricePln,
          priceCurrency: offer.priceCurrency,
          listPricePln: offer.listPricePln,
          area: offer.area,
          rooms: offer.rooms,
          images: offer.images,
          status: offer.status,
          expiresAt: offer.expiresAt,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
          hasBalcony: offer.hasBalcony,
          hasParking: offer.hasParking,
          isFurnished: offer.isFurnished,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({
      items: ranked,
      profile: {
        preferredBudgetPln: likedAvgPrice,
        preferredAreaM2: likedAvgArea,
        interactions: recentEvents.length,
      },
    });
  } catch (error) {
    console.error('[DISCOVERY FEED ERROR]', error);
    // Backward compatibility: app fallback na standardowy feed.
    return NextResponse.json({ items: [] });
  }
}
