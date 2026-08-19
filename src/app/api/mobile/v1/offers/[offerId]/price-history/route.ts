export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { findUniqueMobileListOffer } from '@/lib/offers/mobileOfferListQuery';
import { resolveOfferDetailAccess } from '@/lib/offerPublicAccess';
import { ensureOfferPriceHistorySchema, fetchOfferPriceHistory } from '@/lib/offerPriceHistory';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as { id?: number; userId?: number; sub?: number };
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function GET(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  try {
    await ensureOfferPriceHistorySchema();
    const authUserId = parseUserIdFromBearer(req);
    let viewerRole: string | null = null;
    if (authUserId) {
      const viewer = await prisma.user.findUnique({
        where: { id: authUserId },
        select: { id: true, role: true },
      });
      viewerRole = viewer?.role ?? null;
    }

    const offer = await findUniqueMobileListOffer(offerId);
    const portalToken = new URL(req.url).searchParams.get('portal');
    const access = await resolveOfferDetailAccess(prisma, offer as any, {
      userId: authUserId,
      role: viewerRole,
      portalToken,
    });
    if (access.notFound || !offer) {
      return NextResponse.json({ success: false, message: 'Nie znaleziono oferty' }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ success: false, message: 'Oferta niedostępna' }, { status: 404 });
    }

    const history = await fetchOfferPriceHistory(offerId);

    return NextResponse.json(
      {
        success: true,
        history: history.map((row) => ({
          ...row,
          recordedAt: row.recordedAt.toISOString(),
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}
