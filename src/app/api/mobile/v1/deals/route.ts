import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: Request) {
  try {
    // 1. Sprawdzanie luksusowego "biletu wstępu" (Tokenu JWT)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Dekodowanie tokenu (wyciągamy ID zalogowanego użytkownika)
    // Używamy jwt.decode jako bezpiecznego fallbacku dla API mobilnego
    const decoded = jwt.decode(token) as { id?: number, userId?: number } | null;
    const userId = decoded?.id || decoded?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    // 2. Pobieranie transakcji (Deali) z bazy Prisma, gdzie user to kupiec lub sprzedawca
    const deals = await prisma.deal.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ],
        isActive: true
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true, phone: true, image: true },
        },
        seller: {
          select: { id: true, name: true, email: true, phone: true, image: true },
        },
        // Pobieramy tylko ostatnią wiadomość, żeby wyświetlić ją w liście
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
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
          },
        });
        return [deal.id, unread] as const;
      })
    );
    const unreadMap = new Map<number, number>(unreadCounters);

    // 3. Formatowanie danych specjalnie pod natywny interfejs aplikacji mobilnej EstateOS
    const formattedDeals = deals.map(deal => {
      const lastMsg = deal.messages[0];
      
      // Formatowanie godziny (np. "14:30") dla ostatniej wiadomości
      const timeString = lastMsg 
        ? new Date(lastMsg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        : new Date(deal.updatedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

      const otherParty = deal.buyerId === userId ? deal.seller : deal.buyer;
      const otherPartyName =
        otherParty?.name ||
        (otherParty?.email ? String(otherParty.email).split('@')[0] : null) ||
        `Użytkownik #${otherParty?.id || '?'}`;

      return {
        id: deal.id,
        offerId: deal.offerId,
        title: `Transakcja #${deal.offerId}`, // Jeśli masz relację do nazwy nieruchomości, można to tu wpiąć
        status: deal.status,
        lastMessage: lastMsg ? lastMsg.content : 'Deal otwarty. Brak nowych wiadomości.',
        time: timeString,
        unread: unreadMap.get(deal.id) || 0,
        unreadCount: unreadMap.get(deal.id) || 0,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
        buyer: deal.buyer || null,
        seller: deal.seller || null,
        otherUserId: otherParty?.id || null,
        otherUserName: otherPartyName,
        otherParty: otherParty
          ? {
              id: otherParty.id,
              name: otherPartyName,
              email: otherParty.email || null,
              phone: otherParty.phone || null,
              image: otherParty.image || null,
            }
          : null,
        lastMessageSenderName: lastMsg?.sender?.name || null,
      };
    });

    return NextResponse.json({ deals: formattedDeals });

  } catch (error) {
    console.error('MOBILE DEALS API ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
