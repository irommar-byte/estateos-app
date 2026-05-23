import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';

const globalAny = globalThis as typeof globalThis & { sseClients?: Set<{ send: (payload: unknown) => void }> };

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const dealId = Number(resolvedParams.id);

    const cookieStore = await cookies();
    const dealToken = cookieStore.get('deal_token')?.value;
    const sessionToken = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
    let token = dealToken;
    if (!token) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }
    let userId: number | null = null;
    const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
    if (token && secretRaw) {
      try {
        const secret = new TextEncoder().encode(secretRaw);
        const { payload } = await jwtVerify(token, secret);
        userId = Number(payload.id || payload.sub);
      } catch {
        // fallback to session cookie
      }
    }

    if (!userId && sessionToken) {
      const session = decryptSession(sessionToken);
      if (session?.id) {
        userId = Number(session.id);
      } else if (session?.email) {
        const user = await prisma.user.findFirst({ where: { email: String(session.email) }, select: { id: true } });
        userId = user?.id ?? null;
      }
    }

    if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    // Zmieniamy status wszystkich nieprzeczytanych wiadomości OD DRUGIEJ STRONY na "Odczytano"
    await prisma.dealMessage.updateMany({
      where: {
        dealId: dealId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });

    if (globalAny.sseClients) {
      globalAny.sseClients.forEach((c) => c.send({ type: 'READ', payload: { dealId } }));
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
