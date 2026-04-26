import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ wymaga await na params
    const resolvedParams = await context.params;
    const dealId = Number(resolvedParams.id);
    
    if (!dealId) return NextResponse.json({ success: false, error: 'Brak ID' }, { status: 400 });

    const cookieStore = await cookies();
    let token = cookieStore.get('deal_token')?.value || cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;

    if (!token) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }

    if (!token) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    const userId = Number(payload.id || payload.sub);

    // Wyciągamy cały pokój wraz z historią wiadomości!
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        offer: true,
        buyer: true,
        seller: true,
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!deal) return NextResponse.json({ success: false, error: 'Nie znaleziono' }, { status: 404 });
    if (deal.buyerId !== userId && deal.sellerId !== userId) return NextResponse.json({ success: false, error: 'Odmowa dostępu' }, { status: 403 });

    return NextResponse.json({ success: true, deal });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
