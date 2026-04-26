import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    // Szukamy naszych nowych, mocnych ciasteczek
    let token = cookieStore.get('deal_token')?.value || cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;

    if (!token) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }

    if (!token) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    if (token.startsWith('Bearer ')) {
      token = token.slice('Bearer '.length).trim();
    }
    if (!token) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const secretValue = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
    if (!secretValue) {
      return NextResponse.json({ success: false, error: 'Brak konfiguracji auth' }, { status: 500 });
    }

    let payload: any;
    try {
      const verified = await jwtVerify(token, new TextEncoder().encode(secretValue));
      payload = verified.payload;
    } catch {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy token' }, { status: 401 });
    }
    const userId = Number(payload.id || payload.sub);

    if (!userId) return NextResponse.json({ success: false, error: 'Nieprawidłowy token' }, { status: 401 });

    // Wyciągamy pokoje z bazy (Omijamy błąd 'sellerId' z messages, pobierając czyste pokoje)
    const deals = await prisma.deal.findMany({
      where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
      include: { offer: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' }
    });

    // Formatujemy dla Twojego Reacta (wymaga dealId zamiast id)
    const formattedDeals = deals.map(d => ({
        ...d,
        dealId: d.id,
        lastMessage: 'Otwórz Deal Room, aby rozpocząć negocjacje' // Fallback wiadomości
    }));

    return NextResponse.json({ success: true, deals: formattedDeals });
  } catch (e: unknown) {
    console.error("🔥 BŁĄD API POKOI:", e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: 'Błąd serwera: ' + errorMessage }, { status: 500 });
  }
}
