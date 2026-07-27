import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { buildEstateOsGuideContext } from '@/lib/estateOsGuideContext';
import { buildDiscoveryBuyerBrief } from '@/lib/discoveryInsights';
import { DISCOVERY_ENGINE_VERSION } from '@/lib/discovery/types';

/**
 * Personal Discovery profile for logged-in WWW users.
 * Cold start returns empty-but-valid shape — never 500 for missing profile.
 */
export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Zaloguj się, aby zobaczyć swój kierunek.' }, { status: 401 });
    }

    const [profile, tropes, guide, recentRaw] = await Promise.all([
      prisma.discoveryProfile.findUnique({ where: { userId } }),
      prisma.discoveryTrope.findMany({
        where: { userId },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 8,
        select: {
          offerId: true,
          status: true,
          priority: true,
          visitOutcome: true,
          updatedAt: true,
        },
      }),
      buildEstateOsGuideContext(userId),
      prisma.discoveryEvent.findMany({
        where: {
          userId,
          eventType: {
            in: [
              'DISCOVERY_LIKE',
              'DISCOVERY_DISLIKE',
              'DISCOVERY_PRIORITY',
              'DISCOVERY_DEPTH_OPEN',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 16,
        select: {
          id: true,
          eventType: true,
          offerId: true,
          reasonCode: true,
          source: true,
          platform: true,
          at: true,
          createdAt: true,
        },
      }),
    ]);

    const offerIds = Array.from(
      new Set(
        [...tropes.map((t) => t.offerId), ...recentRaw.map((e) => e.offerId)]
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );

    const offers =
      offerIds.length > 0
        ? await prisma.offer.findMany({
            where: { id: { in: offerIds } },
            select: {
              id: true,
              title: true,
              city: true,
              district: true,
              price: true,
              images: true,
            },
          })
        : [];
    const offerById = new Map(offers.map((o) => [o.id, o]));

    const brief = buildDiscoveryBuyerBrief({
      likesCount: profile?.likesCount || 0,
      dislikesCount: profile?.dislikesCount || 0,
      fastTrackCount: profile?.fastTrackCount || 0,
      opensCount: profile?.opensCount || 0,
      cityStats: profile?.cityStats,
      districtStats: profile?.districtStats,
      propertyStats: profile?.propertyStats,
      reasonStats: profile?.reasonStats,
    });

    const mapOffer = (offerId: number | null | undefined) => {
      if (!offerId) return null;
      const offer = offerById.get(offerId);
      if (!offer) return { id: offerId, title: `Oferta #${offerId}`, city: null, imageUrl: null };
      let imageUrl: string | null = null;
      try {
        const parsed = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
        if (Array.isArray(parsed) && parsed[0]) imageUrl = String(parsed[0]);
        else if (typeof parsed === 'string' && parsed) imageUrl = parsed;
      } catch {
        if (typeof offer.images === 'string' && offer.images.startsWith('http')) imageUrl = offer.images;
      }
      return {
        id: offer.id,
        title: offer.title || `Oferta #${offer.id}`,
        city: offer.city || offer.district || null,
        imageUrl,
      };
    };

    return NextResponse.json(
      {
        success: true,
        profile: {
          ...brief,
          confidence: profile?.confidence ?? 0,
          contradictionIndex: profile?.contradictionIndex ?? 0,
          explorationHunger: profile?.explorationHunger ?? 1,
          searchPhase: profile?.searchPhase || 'ACTIVE',
          engineVersion: profile?.engineVersion || DISCOVERY_ENGINE_VERSION,
          hasProfile: Boolean(profile),
          updatedAt: profile?.updatedAt?.toISOString() || null,
        },
        tropes: tropes.map((t) => ({
          ...t,
          updatedAt: t.updatedAt.toISOString(),
          offer: mapOffer(t.offerId),
        })),
        recent: recentRaw.map((e) => ({
          id: String(e.id),
          eventType: e.eventType,
          reasonCode: e.reasonCode,
          source: e.source,
          platform: e.platform,
          at: (e.at || e.createdAt).toISOString(),
          offer: mapOffer(e.offerId),
        })),
        guide,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[DISCOVERY WEB PROFILE ERROR]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
