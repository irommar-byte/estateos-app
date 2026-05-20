import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { finalizeDealWithOfferArchive } from '@/lib/dealFinalize';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as { id?: number; userId?: number; sub?: number };
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  return Number.isFinite(verifiedId) && verifiedId > 0 ? verifiedId : null;
}

export async function POST(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/finalize/);
    const dealId = Number(match?.[1]);
    if (!dealId || Number.isNaN(dealId)) {
      return NextResponse.json({ success: false, error: 'Bad URL' }, { status: 400 });
    }

    const actorId = parseUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!actorId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Transakcja nie istnieje' }, { status: 404 });
    }
    if (deal.sellerId !== actorId) {
      return NextResponse.json(
        { success: false, error: 'Tylko wlasciciel moze sfinalizowac transakcje' },
        { status: 403 }
      );
    }
    if (!deal.acceptedBidId || deal.status !== 'AGREED') {
      return NextResponse.json(
        { success: false, error: 'Transakcja musi miec zaakceptowana cene przed finalizacja' },
        { status: 400 }
      );
    }

    const acceptedBid = await prisma.bid.findUnique({
      where: { id: deal.acceptedBidId },
      select: { id: true, amount: true },
    });
    if (!acceptedBid) {
      return NextResponse.json({ success: false, error: 'Brak zaakceptowanej oferty ceny' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await finalizeDealWithOfferArchive(tx, {
        dealId,
        offerId: deal.offerId,
        sellerId: deal.sellerId,
        buyerId: deal.buyerId,
        actorUserId: actorId,
        acceptedBidId: acceptedBid.id,
        finalPrice: acceptedBid.amount,
      });
    });

    return NextResponse.json({
      success: true,
      status: 'FINALIZED',
      finalized: true,
      offerId: deal.offerId,
      finalPrice: acceptedBid.amount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'DEAL_ALREADY_FINALIZED') {
      return NextResponse.json({ success: false, error: 'Transakcja zostala juz sfinalizowana' }, { status: 409 });
    }
    console.error('MOBILE DEAL FINALIZE ERROR:', error);
    return NextResponse.json({ success: false, error: 'Blad serwera' }, { status: 500 });
  }
}
