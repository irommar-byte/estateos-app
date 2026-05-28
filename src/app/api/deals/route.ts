import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';

export const dynamic = 'force-dynamic';

/** Lista Deal Roomów zalogowanego użytkownika (nie przyjmuje userId z query — tylko sesja). */
export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deals = await prisma.deal.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        offer: { select: { id: true, title: true, images: true, price: true, city: true } },
        buyer: { select: { id: true, name: true, image: true, email: true } },
        seller: { select: { id: true, name: true, image: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, deals });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Błąd pobierania listy Deal Roomów:', message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
