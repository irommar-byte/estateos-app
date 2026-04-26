import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');

    if (!session) {
      return NextResponse.json({ deals: [] });
    }

    let user: any = {};
    try {
      user = decryptSession(session.value);
    } catch (e) {}

    if (!user?.id) {
      return NextResponse.json({ deals: [] });
    }

    const deals = await prisma.deal.findMany({
      where: {
        OR: [{ buyerId: Number(user.id) }, { sellerId: Number(user.id) }],
      },
      include: {
        offer: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedDeals = deals.map((deal) => ({
      ...deal,
      dealId: deal.id,
      lastMessage: deal.messages[0]?.content || 'Brak wiadomości',
      updatedAt: deal.messages[0]?.createdAt || deal.updatedAt,
    }));
    return NextResponse.json({ deals: mappedDeals });

  } catch (e) {
    console.error("Dealroom error: ", e);
    return NextResponse.json({ deals: [] }, { status: 500 });
  }
}
