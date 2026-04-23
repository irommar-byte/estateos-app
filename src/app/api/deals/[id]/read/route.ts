import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const dealId = Number(resolvedParams.id);

    const cookieStore = await cookies();
    let token = cookieStore.get('deal_token')?.value || cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
    if (!token) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }
    if (!token) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    const userId = Number(payload.id || payload.sub);

    // Zmieniamy status wszystkich nieprzeczytanych wiadomości OD DRUGIEJ STRONY na "Odczytano"
    await prisma.dealMessage.updateMany({
      where: {
        dealId: dealId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });

    if (global.sseClients) {
        global.sseClients.forEach(c => c.send({ type: 'READ', payload: { dealId } }));
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
