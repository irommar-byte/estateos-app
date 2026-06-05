import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';
import {
  normalizeTapbackEmoji,
  parseContactReactions,
  serializeContactReactions,
} from '@/lib/contactMessageReactions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function assertMessageAccess(threadId: number, messageId: number, userId: number) {
  const message = await prisma.contactMessage.findFirst({
    where: { id: messageId, threadId },
    select: {
      id: true,
      threadId: true,
      reactions: true,
      thread: { select: { userLowId: true, userHighId: true } },
    },
  });
  if (!message) return { ok: false as const, status: 404, error: 'Wiadomość nie istnieje.' };
  const { userLowId, userHighId } = message.thread;
  if (userLowId !== userId && userHighId !== userId) {
    return { ok: false as const, status: 403, error: 'Brak dostępu.' };
  }
  return { ok: true as const, message };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const { id, messageId: messageIdRaw } = await ctx.params;
    const threadId = parseInt(id, 10);
    const messageId = parseInt(messageIdRaw, 10);
    if (!Number.isFinite(threadId) || !Number.isFinite(messageId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe parametry.' }, { status: 400 });
    }

    const userId = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertMessageAccess(threadId, messageId, userId);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    const body = (await req.json()) as { emoji?: string | null };
    const requested = body?.emoji == null || body.emoji === '' ? null : normalizeTapbackEmoji(body.emoji);
    if (body?.emoji != null && body.emoji !== '' && !requested) {
      return NextResponse.json({ success: false, error: 'Niedozwolona reakcja.' }, { status: 400 });
    }

    const reactions = parseContactReactions((access.message as { reactions?: unknown }).reactions);
    const userKey = String(userId);
    const current = reactions[userKey] ?? null;

    if (!requested || current === requested) {
      delete reactions[userKey];
    } else {
      reactions[userKey] = requested;
    }

    const updated = await prisma.contactMessage.update({
      where: { id: messageId },
      data: { reactions: serializeContactReactions(reactions) },
    });

    return NextResponse.json({
      success: true,
      message: {
        ...updated,
        reactions: parseContactReactions(updated.reactions),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT REACTION POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
