import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Brak sesji" }, { status: 401 });

    const session = decryptSession(sessionCookie);
    if (!session?.email) return NextResponse.json({ error: "Błąd sesji" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return NextResponse.json({ error: "Nieautoryzowany" }, { status: 401 });

    const data = await req.json();
    const { dealId, text, attachmentUrl, attachmentType } = data;

    if (!dealId || (!text && !attachmentUrl)) {
      return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
    }

    // 1. Zapis wiadomości
    const message = await prisma.dealMessage.create({
      data: {
        dealId,
        senderId: String(user.id),
        senderName: user.name || user.email.split('@')[0],
        text: text || "Załączono plik",
        attachmentUrl,
        attachmentType
      }
    });

    // 2. WYZWALACZ POWIADOMIEŃ (The Nervous System)
    // Identyfikujemy partnera z ID deala (Format: offerId_partnerId)
    const parts = dealId.split('_');
    const offerId = parts[0];
    const partnerIdFromDeal = parts[1];
    
    // Ustalanie kto jest kim w tej transakcji, by powiadomić właściwą osobę
    const offer = await prisma.offer.findUnique({ where: { id: parseInt(offerId) } });
    let targetUserId = "";

    if (offer && String(offer.userId) === String(user.id)) {
        // Jeśli ja jestem właścicielem oferty, powiadomienie idzie do partnera (kupującego)
        targetUserId = partnerIdFromDeal;
    } else if (offer) {
        // Jeśli nie jestem właścicielem, to powiadomienie idzie do właściciela (sprzedającego)
        targetUserId = String(offer.userId);
    }

    // Zapisujemy powiadomienie w bazie, aby dzwoneczek u góry się zaświecił
    if (targetUserId) {
        await prisma.notification.create({
            data: {
                userId: Number(targetUserId),
                title: "Nowa aktywność w Deal Room",
                message: `Otrzymałeś nową wiadomość od ${user.name || 'użytkownika'} w sprawie oferty.`,
                link: `/dealroom/${dealId}`,
                type: "DEAL_UPDATE"
            }
        });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Błąd zapisu wiadomości:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) return NextResponse.json({ error: "Brak ID deala" }, { status: 400 });

    const messages = await prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
