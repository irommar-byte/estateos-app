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

    const [profile, tropes, guide] = await Promise.all([
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
    ]);

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
        tropes,
        guide,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[DISCOVERY WEB PROFILE ERROR]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
