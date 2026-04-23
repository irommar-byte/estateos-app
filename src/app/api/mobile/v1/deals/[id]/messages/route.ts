import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalAny = global as any;
if (typeof globalAny.typingStore === 'undefined') {
  globalAny.typingStore = {};
}

export async function GET(req: Request) {
  try {
    // Pancerne wyciąganie ID z URL
    const match = req.url.match(/\/deals\/(\d+)\/messages/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealIdInt = parseInt(match[1]);

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    const decoded = jwt.decode(token) as any;
    const userId = decoded?.id || decoded?.userId;
    if (!userId) return NextResponse.json({ error: 'Bad token' }, { status: 401 });

    // Odznaczamy przeczytane
    await prisma.dealMessage.updateMany({
      where: { dealId: dealIdInt, senderId: { not: userId }, isRead: false },
      data: { isRead: true }
    });

    // Pobieramy historię
    const messages = await prisma.dealMessage.findMany({
      where: { dealId: dealIdInt },
      orderBy: { createdAt: 'asc' },
    });

    // Czytamy kropeczki
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
    const dealIdInt = parseInt(match[1]);

    const body = await req.json();
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.decode(token as string) as any;
    const userId = decoded?.id || decoded?.userId;

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const newMessage = await prisma.dealMessage.create({
      data: { dealId: dealIdInt, senderId: userId, content: body.content, isRead: false }
    });

    await prisma.deal.update({ where: { id: dealIdInt }, data: { updatedAt: new Date() } });

    if (globalAny.typingStore[dealIdInt]) {
      delete globalAny.typingStore[dealIdInt][userId];
    }

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error('[CHAT POST ERROR]', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
