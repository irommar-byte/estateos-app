import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveContactUserId } from '@/lib/contactRequestAuth';
import { parseContactReactions } from '@/lib/contactMessageReactions';
import { parseContactAttachmentMeta } from '@/lib/contactAttachment';
import { sendContactThreadMessage } from '@/lib/contactSendMessage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const userId = await resolveContactUserId(req);
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
    console.error('[CONTACT WWW MSG GET]', message);
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

    const userId = await resolveContactUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    const body = (await req.json()) as { content?: string; attachment?: unknown };
    const content = String(body?.content ?? '').trim();
    const attachment = parseContactAttachmentMeta(body?.attachment);

    if (!content && !attachment) {
      return NextResponse.json(
        { success: false, error: 'Brak treści wiadomości ani załącznika.' },
        { status: 400 }
      );
    }

    const result = await sendContactThreadMessage({
      threadId,
      userId,
      content,
      attachment,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT WWW MSG POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
