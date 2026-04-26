import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalAny = global as any;
if (typeof globalAny.typingStore === 'undefined') {
  globalAny.typingStore = {};
}

export async function GET(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/messages/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealIdInt = parseInt(match[1], 10);

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    const decoded = jwt.decode(token) as any;
    const userId = Number(decoded?.id || decoded?.userId);
    if (!userId) return NextResponse.json({ error: 'Bad token' }, { status: 401 });

    await prisma.dealMessage.updateMany({
      where: { dealId: dealIdInt, senderId: { not: userId }, isRead: false },
      data: { isRead: true }
    });

    const messages = await prisma.dealMessage.findMany({
      where: { dealId: dealIdInt },
      orderBy: { createdAt: 'asc' },
    });

    let isPartnerTyping = false;
    if (globalAny.typingStore[dealIdInt]) {
      for (const [tUserId, timestamp] of Object.entries(globalAny.typingStore[dealIdInt])) {
        if (Number(tUserId) !== userId && (Date.now() - (timestamp as number) < 4000)) {
          isPartnerTyping = true;
          break;
        }
      }
    }

    return NextResponse.json({ messages, isTyping: isPartnerTyping });
  } catch (error: any) {
    console.error('[CHAT GET ERROR]', error);
    return NextResponse.json({ messages: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/messages/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealIdInt = parseInt(match[1], 10);

    const body = await req.json();
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.decode(token as string) as any;
    const userId = Number(decoded?.id || decoded?.userId);

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deal = await prisma.deal.findUnique({
      where: { id: dealIdInt },
      select: { id: true, buyerId: true, sellerId: true }
    });
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const content = String(body?.content || '').trim();
    if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 });

    const newMessage = await prisma.dealMessage.create({
      data: { dealId: dealIdInt, senderId: userId, content, isRead: false }
    });

    await prisma.deal.update({ where: { id: dealIdInt }, data: { updatedAt: new Date() } });

    const receiverId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const shortPreview = content.slice(0, 120) || 'Nowa wiadomość';

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        type: 'DEAL_UPDATE',
        targetType: 'DEAL',
        targetId: String(dealIdInt)
      }
    });

    try {
      await notificationService.sendPushToUser(receiverId, {
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        data: {
          targetType: 'DEAL',
          targetId: String(dealIdInt),
          kind: 'deal_message'
        }
      });
    } catch (pushError) {
      console.warn('[CHAT PUSH WARN]', pushError);
    }

    if (globalAny.typingStore[dealIdInt]) {
      delete globalAny.typingStore[dealIdInt][userId];
    }

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error('[CHAT POST ERROR]', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
