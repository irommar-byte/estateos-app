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
        // Pobieramy tylko ostatnią wiadomość, żeby wyświetlić ją w liście
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // 3. Formatowanie danych specjalnie pod natywny interfejs aplikacji mobilnej EstateOS
    const formattedDeals = deals.map(deal => {
      const lastMsg = deal.messages[0];
      
      // Formatowanie godziny (np. "14:30") dla ostatniej wiadomości
      const timeString = lastMsg 
        ? new Date(lastMsg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        : new Date(deal.updatedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

      return {
        id: deal.id,
        title: `Transakcja #${deal.offerId}`, // Jeśli masz relację do nazwy nieruchomości, można to tu wpiąć
        status: deal.status,
        lastMessage: lastMsg ? lastMsg.content : 'Deal otwarty. Brak nowych wiadomości.',
        time: timeString,
        unread: lastMsg && !lastMsg.isRead && lastMsg.senderId !== userId ? 1 : 0 // Prosty licznik nieprzeczytanych
      };
    });

    return NextResponse.json({ deals: formattedDeals });

  } catch (error) {
    console.error('MOBILE DEALS API ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
