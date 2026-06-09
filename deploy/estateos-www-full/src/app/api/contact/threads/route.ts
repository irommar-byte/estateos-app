import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveContactUserId } from '@/lib/contactRequestAuth';
import { contactThreadPair, contactPeerId } from '@/lib/contactThreadPair';
import { formatContactLastMessagePreview } from '@/lib/contactAttachmentShared';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  phone: true,
  planType: true,
  isPro: true,
  role: true,
} as const;

async function isBlocked(a: number, b: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM MobileUserBlock
    WHERE (blockerUserId = ${a} AND blockedUserId = ${b})
       OR (blockerUserId = ${b} AND blockedUserId = ${a})
    LIMIT 1
  `;
  return rows.length > 0;
}

function formatThreadRow(
  thread: {
    id: number;
    userLowId: number;
    userHighId: number;
    updatedAt: Date;
    userLow: { id: number; name: string | null; email: string | null; image: string | null };
    userHigh: { id: number; name: string | null; email: string | null; image: string | null };
    messages: Array<{ id: number; content: string; attachment?: string | null; createdAt: Date; senderId: number }>;
  },
  viewerId: number,
  unread: number
) {
  const peerId = contactPeerId(thread, viewerId);
  const peer = thread.userLowId === peerId ? thread.userLow : thread.userHigh;
  const lastMsg = thread.messages[0];
  const peerName =
    peer?.name?.trim() ||
    (peer?.email ? String(peer.email).split('@')[0] : null) ||
    `Użytkownik #${peerId}`;
  return {
    id: thread.id,
    peerUserId: peerId,
    peerUserName: peerName,
    peer: {
      id: peerId,
      name: peerName,
      email: peer?.email || null,
      image: peer?.image || null,
    },
    lastMessage: lastMsg ? formatContactLastMessagePreview(lastMsg) : '',
    time: (lastMsg?.createdAt || thread.updatedAt).toISOString(),
    unread,
    unreadCount: unread,
    updatedAt: thread.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const userId = await resolveContactUserId(req);
    if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const threads = await prisma.contactThread.findMany({
      where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
      include: {
        userLow: { select: USER_SELECT },
        userHigh: { select: USER_SELECT },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, attachment: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = await Promise.all(
      threads.map(async (thread) => {
        const unread = await prisma.contactMessage.count({
          where: { threadId: thread.id, senderId: { not: userId }, isRead: false },
        });
        return formatThreadRow(thread, userId, unread);
      })
    );

    const totalUnread = formatted.reduce((sum, row) => sum + (row.unread || 0), 0);

    return NextResponse.json({ threads: formatted, items: formatted, totalUnread });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT WWW THREADS GET]', message);
    return NextResponse.json({ threads: [], error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await resolveContactUserId(req);
    if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const body = (await req.json()) as { peerUserId?: number; userId?: number };
    const peerUserId = Number(body?.peerUserId ?? body?.userId);
    if (!Number.isFinite(peerUserId) || peerUserId <= 0) {
      return NextResponse.json({ error: 'Nie podano ID rozmówcy.' }, { status: 400 });
    }
    if (peerUserId === userId) {
      return NextResponse.json({ error: 'Nie możesz napisać do siebie.' }, { status: 400 });
    }

    const peer = await prisma.user.findUnique({ where: { id: peerUserId }, select: USER_SELECT });
    if (!peer) return NextResponse.json({ error: 'Użytkownik nie istnieje.' }, { status: 404 });

    if (await isBlocked(userId, peerUserId)) {
      return NextResponse.json({ error: 'Kontakt z tym użytkownikiem jest zablokowany.' }, { status: 403 });
    }

    const pair = contactThreadPair(userId, peerUserId);
    const thread = await prisma.contactThread.upsert({
      where: { userLowId_userHighId: pair },
      update: {},
      create: pair,
      include: {
        userLow: { select: USER_SELECT },
        userHigh: { select: USER_SELECT },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, attachment: true, createdAt: true, senderId: true },
        },
      },
    });

    const unread = await prisma.contactMessage.count({
      where: { threadId: thread.id, senderId: { not: userId }, isRead: false },
    });

    return NextResponse.json({
      success: true,
      thread: formatThreadRow(thread, userId, unread),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT WWW THREADS POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
