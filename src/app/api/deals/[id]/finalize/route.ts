import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getUserIdFromToken(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const payload = jwt.verify(token, secret) as any;
    return Number(payload?.id || payload?.sub) || null;
  } catch {
    return null;
  }
}

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

    const userId = getUserIdFromToken(req.headers.get('authorization'));

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { offer: true }
    });

    if (!deal) {
      return NextResponse.json({ error: 'Nie znaleziono transakcji' }, { status: 404 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    // 🔥 Twarda walidacja biznesowa
    if (!deal.acceptedBidId || deal.status !== 'AGREED') {
      return NextResponse.json({
        error: 'Transakcja musi być zaakceptowana przed finalizacją.'
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {

      // 🔒 ATOMIC LOCK NA DEAL
      const updated = await tx.deal.updateMany({
        where: {
          id: dealId,
          status: { notIn: ['FINALIZED', 'CANCELLED'] }
        },
        data: {
          status: 'FINALIZED',
          isActive: false,
          updatedAt: new Date()
        }
      });

      if (updated.count === 0) {
        throw new Error('Deal już zamknięty (race condition blocked)');
      }

      // 🔒 OFERTA → SOLD (zabezpieczone)
      await tx.offer.updateMany({
        where: {
          id: deal.offerId,
          status: { not: 'SOLD' }
        },
        data: {
          status: 'SOLD'
        }
      });

      // 💬 SYSTEM MESSAGE (winner)
      await tx.dealMessage.create({
        data: {
          dealId,
          senderId: userId,
          content: `[SYSTEM_FINALIZED] Nieruchomość została sprzedana. Gratulacje! 🎉`
        }
      });

      // 🔔 POWIADOMIENIA (winnerzy)
      await tx.notification.createMany({
        data: [
          {
            userId: deal.buyerId,
            type: 'SYSTEM_ALERT',
            title: '🎉 Transakcja zakończona',
            body: 'Zakup został sfinalizowany.',
            targetType: 'DEAL',
            targetId: String(dealId),
          },
          {
            userId: deal.sellerId,
            type: 'SYSTEM_ALERT',
            title: '🎉 Transakcja zakończona',
            body: 'Sprzedaż została zakończona sukcesem.',
            targetType: 'DEAL',
            targetId: String(dealId),
          }
        ]
      });

      // 🔥 AUTO-CANCEL KONKURENCJI
      const otherDeals = await tx.deal.findMany({
        where: {
          offerId: deal.offerId,
          id: { not: dealId },
          status: { notIn: ['CANCELLED', 'FINALIZED'] }
        },
        select: { id: true, buyerId: true }
      });

      if (otherDeals.length > 0) {

        // CANCEL
        await tx.deal.updateMany({
          where: {
            offerId: deal.offerId,
            id: { not: dealId }
          },
          data: {
            status: 'CANCELLED',
            isActive: false,
            updatedAt: new Date()
          }
        });

        // 🔔 POWIADOMIENIA (losers)
        await tx.notification.createMany({
          data: otherDeals.map(d => ({
            userId: d.buyerId,
            type: 'SYSTEM_ALERT',
            title: '❌ Oferta niedostępna',
            body: 'Nieruchomość została sprzedana innemu klientowi.',
            targetType: 'DEAL',
            targetId: String(d.id),
          }))
        });

        // 💬 SYSTEM MESSAGE (losers)
        await tx.dealMessage.createMany({
          data: otherDeals.map(d => ({
            dealId: d.id,
            senderId: deal.sellerId,
            content: `[SYSTEM_CANCELLED] Oferta została sprzedana innemu klientowi.`
          }))
        });
      }

    });

    return NextResponse.json({
      success: true,
      message: 'Transakcja zakończona (system spójny)'
    });

  } catch (error: any) {
    console.error('❌ FINALIZE ERROR:', error.message);

    return NextResponse.json({
      error: 'Błąd serwera'
    }, { status: 500 });
  }
}
