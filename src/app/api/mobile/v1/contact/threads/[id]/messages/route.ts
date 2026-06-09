import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';
import { contactPeerId } from '@/lib/contactThreadPair';
import { parseContactReactions } from '@/lib/contactMessageReactions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MESSAGE_DEDUP_WINDOW_MS = 10_000;

const globalAny = global as typeof globalThis & { contactTypingStore?: Record<number, Record<number, number>> };
if (!globalAny.contactTypingStore) globalAny.contactTypingStore = {};

async function assertThreadAccess(threadId: number, userId: number) {
  const thread = await prisma.contactThread.findUnique({
    where: { id: threadId },
    select: { id: true, userLowId: true, userHighId: true },
  });
  if (!thread) return { ok: false as const, status: 404, error: 'Wątek nie istnieje.' };
  if (thread.userLowId !== userId && thread.userHighId !== userId) {
    return { ok: false as const, status: 403, error: 'Brak dostępu do wątku.' };
  }
  return { ok: true as const, thread };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    if (!Number.isFinite(threadId)) return NextResponse.json({ error: 'Bad thread id' }, { status: 400 });

    const userId = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    await prisma.contactMessage.updateMany({
      where: { threadId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    const messages = await prisma.contactMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    let isTyping = false;
    const store = globalAny.contactTypingStore?.[threadId];
    if (store) {
      for (const [tUserId, timestamp] of Object.entries(store)) {
        if (Number(tUserId) !== userId && Date.now() - timestamp < 4000) {
          isTyping = true;
          break;
        }
      }
    }

    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        reactions: parseContactReactions((m as { reactions?: unknown }).reactions),
      })),
      isTyping,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT MSG GET]', message);
    return NextResponse.json({ messages: [], error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy wątek.' }, { status: 400 });
    }

    const userId = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    const body = (await req.json()) as { content?: string };
    const content = String(body?.content ?? '').trim();
    if (!content) {
      return NextResponse.json({ success: false, error: 'Brak treści wiadomości.' }, { status: 400 });
    }

    const dedupSince = new Date(Date.now() - MESSAGE_DEDUP_WINDOW_MS);
    const recentSame = await prisma.contactMessage.findFirst({
      where: {
        threadId,
        senderId: userId,
        content,
        createdAt: { gte: dedupSince },
      },
      orderBy: { createdAt: 'desc' },
    });

    const newMessage =
      recentSame ||
      (await prisma.contactMessage.create({
        data: { threadId, senderId: userId, content, isRead: false },
      }));

    await prisma.contactThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

    const receiverId = contactPeerId(access.thread, userId);
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const senderName =
      sender?.name?.trim() ||
      (sender?.email ? String(sender.email).split('@')[0] : null) ||
      `Użytkownik #${userId}`;
    const shortPreview = content.slice(0, 120);

    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          idempotencyKey: `contact_msg:thread:${threadId}:msg:${newMessage.id}`,
          title: 'EstateOS™ Contact',
          body: `${senderName}: ${shortPreview}`,
          type: 'MESSAGE',
          targetType: 'CHAT',
          targetId: String(threadId),
        },
      });
    } catch {
      /* idempotency duplicate — ok */
    }

    try {
      await notificationService.sendPushToUser(receiverId, {
        title: 'EstateOS™ Contact',
        body: `${senderName}: ${shortPreview}`,
        data: {
          target: 'contact',
          targetType: 'CONTACT',
          threadId: String(threadId),
          peerUserId: String(userId),
          peerName: senderName,
          notificationType: 'CONTACT_MESSAGE',
        },
      });
    } catch (pushErr) {
      console.error('[CONTACT MSG PUSH]', pushErr);
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT MSG POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
