import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';
import { notificationService } from '@/lib/services/notification.service';

const globalAny = globalThis as typeof globalThis & { sseClients?: Set<{ send: (payload: unknown) => void }> };

async function resolveUserId(req: Request): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
  const dealToken = cookieStore.get('deal_token')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;

  // 1) Priorytet: aktywna sesja web (najbardziej wiarygodna dla aktualnie zalogowanego usera).
  if (sessionToken) {
    const session = decryptSession(sessionToken);
    if (session?.id) {
      const userId = Number(session.id);
      if (Number.isFinite(userId) && userId > 0) return userId;
    }
    if (session?.email) {
      const user = await prisma.user.findFirst({ where: { email: String(session.email) }, select: { id: true } });
      if (user?.id) return user.id;
    }
  }

  // 2) Następnie bearer token (np. mobile/web hybrid flow).
  const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
  const tokensToTry = [bearerToken, dealToken].filter(Boolean) as string[];
  for (const token of tokensToTry) {
    if (!secretRaw) continue;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secretRaw));
      const userId = Number(payload.id || payload.sub);
      if (Number.isFinite(userId) && userId > 0) return userId;
    } catch {
      // try next token
    }
  }

  return null;
}

// POBIERANIE WIADOMOŚCI (GET)
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const messages = await prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Błąd pobierania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

// WYSYŁANIE WIADOMOŚCI (POST)
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const body = await req.json();
    const content = String(body?.content || '').trim();
    const senderIdFromBody = body?.senderId ? Number(body.senderId) : null;

    if (!content) {
      return NextResponse.json({ success: false, error: 'Brak treści wiadomości' }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, buyerId: true, sellerId: true } });
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Transakcja nie istnieje' }, { status: 404 });
    }

    let senderId = await resolveUserId(req);
    if (!senderId && senderIdFromBody && (senderIdFromBody === deal.buyerId || senderIdFromBody === deal.sellerId)) {
      senderId = senderIdFromBody;
    }
    if (!senderId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }
    if (senderId !== deal.buyerId && senderId !== deal.sellerId) {
      return NextResponse.json({ success: false, error: 'Brak dostępu do tej transakcji' }, { status: 403 });
    }

    const newMessage = await prisma.dealMessage.create({
      data: {
        dealId,
        senderId,
        content,
      }
    });

    await prisma.deal.update({
      where: { id: dealId },
      data: { updatedAt: new Date() }
    });

    const receiverId = deal.buyerId === senderId ? deal.sellerId : deal.buyerId;
    const senderUser = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    const shortPreview = content.slice(0, 120) || 'Nowa wiadomość';

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        type: 'DEAL_UPDATE',
        targetType: 'DEAL',
        targetId: String(dealId),
      }
    });

    try {
      await notificationService.sendPushToUser(receiverId, {
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        data: {
          targetType: 'DEAL',
          targetId: String(dealId),
          dealId: String(dealId),
          kind: 'deal_message',
          senderId: String(senderId),
          senderName: senderUser?.name || 'Użytkownik',
        }
      });
    } catch (pushError) {
      console.warn('[DEAL MESSAGE PUSH WARN]', pushError);
    }

    if (globalAny.sseClients) {
      globalAny.sseClients.forEach((c) => c.send({ type: 'NEW_MESSAGE', payload: { dealId, messageId: newMessage.id } }));
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Błąd wysyłania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
