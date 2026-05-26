import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { finalizeDealWithOfferArchive } from '@/lib/dealFinalize';
import { resolveDealUserId } from '@/lib/dealRequestAuth';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = Number(id);

    if (!dealId || isNaN(dealId)) {
      return NextResponse.json({ error: 'Błędne ID' }, { status: 400 });
    }

    const userId = await resolveDealUserId(req);

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { offer: true },
    });

    if (!deal) {
      return NextResponse.json({ error: 'Nie znaleziono transakcji' }, { status: 404 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    if (userId !== deal.sellerId) {
      return NextResponse.json(
        { error: 'Tylko właściciel oferty może sfinalizować sprzedaż.' },
        { status: 403 }
      );
    }

    if (!deal.acceptedBidId || deal.status !== 'AGREED') {
      return NextResponse.json(
        { error: 'Transakcja musi być zaakceptowana przed finalizacją.' },
        { status: 400 }
      );
    }

    const acceptedBid = await prisma.bid.findUnique({
      where: { id: deal.acceptedBidId },
      select: { id: true, amount: true },
    });
    if (!acceptedBid) {
      return NextResponse.json({ error: 'Brak zaakceptowanej oferty ceny' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await finalizeDealWithOfferArchive(tx, {
        dealId,
        offerId: deal.offerId,
        sellerId: deal.sellerId,
        buyerId: deal.buyerId,
        actorUserId: userId,
        acceptedBidId: acceptedBid.id,
        finalPrice: acceptedBid.amount,
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Transakcja zakończona (system spójny)',
      status: 'FINALIZED',
      offerId: deal.offerId,
      finalPrice: acceptedBid.amount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'DEAL_ALREADY_FINALIZED') {
      return NextResponse.json({ error: 'Transakcja została już sfinalizowana' }, { status: 409 });
    }
    console.error('❌ FINALIZE ERROR:', message);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
