import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deals = await prisma.deal.findMany({
      where: {
        OR: [
          { buyerId: parseInt(userId) },
          { sellerId: parseInt(userId) }
        ]
      },
      include: {
        offer: { select: { id: true, title: true, images: true, price: true, city: true } },
        buyer: { select: { id: true, name: true, image: true, email: true } },
        seller: { select: { id: true, name: true, image: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ success: true, deals });
  } catch (error: any) {
    console.error('Błąd pobierania listy Deal Roomów:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
