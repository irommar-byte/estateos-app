import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';
import { resolveEliteBadges } from '@/lib/eliteStatus';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const dealToken = cookieStore.get('deal_token')?.value;
    const sessionToken = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
    let authToken = dealToken;

    if (!authToken) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) authToken = authHeader.split(" ")[1];
    }

    if (authToken?.startsWith('Bearer ')) {
      authToken = authToken.slice('Bearer '.length).trim();
    }

    let userId: number | null = null;
    if (authToken) {
      const secretValue = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
      if (secretValue) {
        try {
          const verified = await jwtVerify(authToken, new TextEncoder().encode(secretValue));
          userId = Number(verified.payload.id || verified.payload.sub);
        } catch {
          // fallback do sesji poniżej
        }
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

    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    // Pełny kontekst pokoi: wiadomości, propozycje, statusy i strony transakcji.
    const deals = await prisma.deal.findMany({
      where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
      include: {
        offer: true,
        buyer: true,
        seller: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true }
            }
          }
        },
        bids: {
          where: { status: { in: ['PENDING', 'COUNTER_OFFER'] } },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        appointments: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const unreadCounters = await Promise.all(
      deals.map(async (deal) => {
        const unread = await prisma.dealMessage.count({
          where: {
            dealId: deal.id,
            senderId: { not: userId },
            isRead: false,
          }
        });
        return [deal.id, unread] as const;
      })
    );
    const unreadMap = new Map<number, number>(unreadCounters);

    // Formatujemy pod listę transakcji.
    const formattedDeals = deals.map((d) => {
      const lastMsg = d.messages?.[0];
      const otherParty = d.buyerId === userId ? d.seller : d.buyer;
      return {
        ...d,
        dealId: d.id,
        unreadCount: unreadMap.get(d.id) || 0,
        lastMessage: lastMsg?.content || 'Otwórz Deal Room, aby rozpocząć negocjacje',
        lastMessageAt: lastMsg?.createdAt || d.updatedAt || d.createdAt,
        lastMessageSenderName: lastMsg?.sender?.name || null,
        otherParty: otherParty
          ? {
              id: otherParty.id,
              name: otherParty.name || (otherParty.email ? otherParty.email.split('@')[0] : 'Użytkownik'),
              email: otherParty.email || null,
              image: otherParty.image || null,
              role: (otherParty as any).role || null,
              accountType: (otherParty as any).accountType || null,
              planType: (otherParty as any).planType || null,
              isPro: Boolean((otherParty as any).isPro),
              badges: resolveEliteBadges(otherParty),
            }
          : null,
        pendingBidCount: d.bids?.length || 0,
        pendingAppointmentCount: d.appointments?.length || 0,
      };
    });

    return NextResponse.json({ success: true, deals: formattedDeals });
  } catch (e: unknown) {
    console.error("🔥 BŁĄD API POKOI:", e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: 'Błąd serwera: ' + errorMessage }, { status: 500 });
  }
}
