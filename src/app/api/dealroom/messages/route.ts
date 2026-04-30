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
    const { dealId, text, attachmentUrl } = data;

    const numericDealId = Number(dealId);
    if (!numericDealId || (!text && !attachmentUrl)) {
      return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
    }

    // 1. Zapis wiadomości
    const message = await prisma.dealMessage.create({
      data: {
        dealId: numericDealId,
        senderId: user.id,
        content: text || "Załączono plik",
        attachment: attachmentUrl || null,
      }
    });

    // 2. WYZWALACZ POWIADOMIEŃ (The Nervous System)
    const deal = await prisma.deal.findUnique({ where: { id: numericDealId } });
    let targetUserId: number | null = null;
    if (deal) {
      targetUserId = deal.buyerId === user.id ? deal.sellerId : deal.buyerId;
    }

    // Zapisujemy powiadomienie w bazie, aby dzwoneczek u góry się zaświecił
    if (targetUserId) {
        await prisma.notification.create({
            data: {
                userId: targetUserId,
                title: "Nowa aktywność w Deal Room",
                body: `Otrzymałeś nową wiadomość od ${user.name || 'użytkownika'} w sprawie oferty.`,
                targetType: 'DEAL',
                targetId: String(numericDealId),
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

    const numericDealId = Number(dealId);
    if (!numericDealId) return NextResponse.json({ error: "Brak ID deala" }, { status: 400 });

    const messages = await prisma.dealMessage.findMany({
      where: { dealId: numericDealId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    const normalized = messages.map((m) => ({
      id: m.id,
      dealId: m.dealId,
      senderId: m.senderId,
      senderName: m.sender?.name || 'Uczestnik',
      text: m.content,
      content: m.content,
      attachmentUrl: m.attachment || null,
      attachmentType: m.attachment?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null,
      isRead: m.isRead,
      createdAt: m.createdAt,
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
